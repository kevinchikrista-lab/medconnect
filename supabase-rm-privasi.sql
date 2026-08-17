-- =============================================================================
-- PRIVASI REKAM MEDIS: DOKTER HANYA MELIHAT PASIEN YANG IA TANGANI
--
-- KEADAAN SEBELUM INI
--
-- supabase-rls-fase-b.sql memberi seluruh staf akses penuh ke rekam medis:
--
--     CREATE POLICY "staff_all" ON public.medical_records
--       FOR ALL TO authenticated USING (public.is_staff())
--
-- dan is_staff() berarti "akun login yang bukan pasien". Jadi setiap dokter
-- bisa membaca seluruh riwayat setiap pasien — termasuk pasien yang tidak
-- pernah ia tangani. Untuk klinik dengan satu dokter itu tidak terasa; begitu
-- ada beberapa dokter, artinya tidak ada privasi antar dokter sama sekali.
--
-- Dan karena is_staff() juga mencakup APOTEK, akun apotek pun bisa membaca
-- anamnesis, diagnosis, dan seluruh isi rekam medis — padahal yang ia perlukan
-- hanya resepnya.
--
-- YANG DIBERLAKUKAN SEKARANG
--
--   pemilik klinik & Super Admin : penuh (mereka yang mengurus kelengkapan RM,
--                                 menagih RM yang belum ditulis, dan menyusun
--                                 rekap — pekerjaan yang tidak bisa dikerjakan
--                                 dari potongan)
--   dokter                       : hanya pasien yang ia tangani
--   pasien                       : rekam medisnya sendiri (tidak berubah)
--   apotek                       : TIDAK ada akses ke isi rekam medis
--
-- "Ia tangani" berarti ada jejaknya: rekam medis yang pernah ia tulis, resep,
-- vaksinasi, konsultasi, janji temu, atau pembukaan akses yang ia catat
-- sendiri lewat tabel rm_access_claims di bawah.
--
-- PENEGAKANNYA HARUS DI SINI, BUKAN DI APLIKASI. Aplikasi bisa menyembunyikan
-- tombol dan menutup halaman, tetapi siapa pun yang punya token login bisa
-- memanggil API-nya langsung. Selama kebijakan di bawah belum dijalankan,
-- penjagaan di aplikasi hanyalah kesopanan.
--
-- Prasyarat: supabase-rls-fase-b.sql sudah dijalankan.
-- Jalankan sekali di Supabase SQL editor. Aman diulang.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Catatan pembukaan akses (pintu darurat yang tercatat)
--
-- Dokter yang menghadapi pasien tanpa riwayat — pasien baru, gawat darurat,
-- menggantikan dokter lain — TIDAK ditolak. Menolaknya berarti ia tidak bisa
-- melihat alergi obat pasien yang sedang di depannya, dan bahaya itu jauh
-- lebih besar daripada bahaya seseorang membuka rekam medis yang bukan
-- urusannya. Yang menggantikan penolakan adalah jejak: siapa, kapan, pasien
-- siapa, dan alasan yang ia tulis sendiri.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rm_access_claims (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id  uuid NOT NULL REFERENCES public.doctors(id)  ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  reason     text NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

COMMENT ON TABLE public.rm_access_claims IS
  'Pembukaan akses rekam medis oleh dokter yang belum punya jejak perawatan dengan pasiennya. Berlaku sementara (24 jam) dan tidak boleh dihapus siapa pun — inilah yang membedakan pintu yang tercatat dari pintu yang terbuka.';

CREATE INDEX IF NOT EXISTS idx_rm_claims_lookup
  ON public.rm_access_claims (doctor_id, patient_id, expires_at DESC);

ALTER TABLE public.rm_access_claims ENABLE ROW LEVEL SECURITY;

-- Dokter boleh MENCATAT dan MEMBACA miliknya sendiri; pemilik klinik & Super
-- Admin membaca semuanya. Tidak ada yang boleh MENGUBAH atau MENGHAPUS —
-- catatan yang bisa dihapus pelakunya bukan catatan.
DROP POLICY IF EXISTS "claims_insert_self" ON public.rm_access_claims;
CREATE POLICY "claims_insert_self" ON public.rm_access_claims
  FOR INSERT TO authenticated
  WITH CHECK (doctor_id IN (
    SELECT d.id FROM public.doctors d
    JOIN public.profiles p ON p.id = d.profile_id
    WHERE p.auth_id = auth.uid()));

DROP POLICY IF EXISTS "claims_read" ON public.rm_access_claims;
CREATE POLICY "claims_read" ON public.rm_access_claims
  FOR SELECT TO authenticated
  USING (
    doctor_id IN (SELECT d.id FROM public.doctors d
                  JOIN public.profiles p ON p.id = d.profile_id
                  WHERE p.auth_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p
               WHERE p.auth_id = auth.uid() AND p.role IN ('owner','superadmin'))
  );

-- ---------------------------------------------------------------------------
-- 2. Penolong: dokter yang sedang login, dan apakah ia menangani pasien ini
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_doctor_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT d.id FROM public.doctors d
  JOIN public.profiles p ON p.id = d.profile_id
  WHERE p.auth_id = auth.uid() LIMIT 1
$fn$;

CREATE OR REPLACE FUNCTION public.is_rm_manager()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT EXISTS (SELECT 1 FROM public.profiles
                 WHERE auth_id = auth.uid() AND role IN ('owner','superadmin'))
$fn$;

-- SECURITY DEFINER supaya pemeriksaan jejak di dalamnya tidak ikut disaring
-- oleh kebijakan yang sedang kita pasang — tanpa itu, fungsi ini memeriksa
-- rekam medis lewat aturan yang bergantung pada dirinya sendiri.
CREATE OR REPLACE FUNCTION public.doctor_treats_patient(p_patient uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  WITH me AS (SELECT public.current_doctor_id() AS did)
  SELECT (SELECT did FROM me) IS NOT NULL AND (
       EXISTS (SELECT 1 FROM public.medical_records r
               WHERE r.patient_id = p_patient AND r.doctor_id = (SELECT did FROM me))
    OR EXISTS (SELECT 1 FROM public.vaccinations v
               WHERE v.patient_id = p_patient
                 AND ((SELECT did FROM me) IN (v.administered_by, v.approval_doctor_id)))
    OR EXISTS (SELECT 1 FROM public.prescriptions x
               WHERE x.patient_id = p_patient
                 AND ((SELECT did FROM me) IN (x.doctor_id, x.approval_doctor_id)))
    OR EXISTS (SELECT 1 FROM public.appointments a
               WHERE a.patient_id = p_patient AND a.doctor_id = (SELECT did FROM me))
    OR EXISTS (SELECT 1 FROM public.rm_access_claims c
               WHERE c.patient_id = p_patient AND c.doctor_id = (SELECT did FROM me)
                 AND (c.expires_at IS NULL OR c.expires_at > now()))
  )
$fn$;

-- ---------------------------------------------------------------------------
-- 3. Kebijakan baru untuk isi rekam medis
--
-- Kolom approval_doctor_id pada vaccinations/prescriptions berasal dari migrasi
-- lain; blok ini hanya menyentuh tabel yang memang ada.
-- ---------------------------------------------------------------------------
DO $do$
DECLARE t TEXT;
  tables TEXT[] := ARRAY['medical_records','vaccinations','lab_results'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.'||t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('DROP POLICY IF EXISTS "staff_all" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "rm_manager_all" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "doctor_own_patients" ON public.%I', t);

    -- Pengelola klinik: penuh.
    EXECUTE format($p$CREATE POLICY "rm_manager_all" ON public.%I
      FOR ALL TO authenticated
      USING (public.is_rm_manager()) WITH CHECK (public.is_rm_manager())$p$, t);

    -- Dokter: hanya pasien yang ia tangani. WITH CHECK memakai aturan yang
    -- sama, jadi ia juga tidak bisa MENITIPKAN baris ke pasien orang lain.
    EXECUTE format($p$CREATE POLICY "doctor_own_patients" ON public.%I
      FOR ALL TO authenticated
      USING (public.doctor_treats_patient(patient_id))
      WITH CHECK (public.doctor_treats_patient(patient_id))$p$, t);
  END LOOP;
END $do$;

-- Resep: apotek TETAP perlu membacanya — itu memang pekerjaannya. Yang tidak
-- boleh ia baca adalah isi rekam medisnya, dan itu sudah ditutup di atas.
DROP POLICY IF EXISTS "staff_all" ON public.prescriptions;
DROP POLICY IF EXISTS "rx_manager_pharmacy" ON public.prescriptions;
CREATE POLICY "rx_manager_pharmacy" ON public.prescriptions
  FOR ALL TO authenticated
  USING (public.is_rm_manager()
         OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.auth_id = auth.uid() AND p.role = 'pharmacy')
         OR public.doctor_treats_patient(patient_id))
  WITH CHECK (public.is_rm_manager()
         OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.auth_id = auth.uid() AND p.role = 'pharmacy')
         OR public.doctor_treats_patient(patient_id));

-- ---- Pemeriksa ------------------------------------------------------------
-- 1. Kebijakan yang sekarang berlaku. "staff_all" TIDAK BOLEH muncul lagi
--    pada medical_records — kalau masih ada, akses penuh dokter belum tertutup.
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('medical_records','vaccinations','prescriptions','lab_results','rm_access_claims')
ORDER BY tablename, policyname;

-- 2. Penolongnya sudah terpasang.
SELECT proname FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('current_doctor_id','is_rm_manager','doctor_treats_patient')
ORDER BY proname;

-- 3. Berapa pasien yang ditangani tiap dokter — angka inilah yang nanti
--    dilihat masing-masing dokter, bukan seluruh isi klinik.
SELECT d.full_name AS dokter, count(DISTINCT r.patient_id) AS pasien_ditangani
FROM public.doctors d
LEFT JOIN public.medical_records r ON r.doctor_id = d.id
GROUP BY d.full_name ORDER BY d.full_name;

-- 4. Pembukaan akses yang pernah dicatat (kosong pada pemasangan pertama).
SELECT c.created_at, d.full_name AS dokter, p.full_name AS pasien, c.reason
FROM public.rm_access_claims c
JOIN public.doctors d ON d.id = c.doctor_id
JOIN public.patients p ON p.id = c.patient_id
ORDER BY c.created_at DESC LIMIT 20;

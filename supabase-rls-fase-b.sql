-- =============================================
-- RLS FASE B — Isolasi data per-pasien
-- Tujuan: pasien yang LOGIN hanya bisa melihat DATA MILIKNYA sendiri.
--   Staf (owner/dokter/admin/apotek = SEMUA yang bukan 'patient') tetap akses penuh.
--
-- Prasyarat: Fase A sudah diterapkan (akses anonim sudah ditutup).
--
-- PRINSIP KEAMANAN:
--   • Rekam medis, resep, vaksinasi, lab = READ-ONLY bagi pasien
--     (pasien tidak boleh mengubah/menghapus riwayat medisnya sendiri).
--   • Booking & chat = pasien boleh membuat/melihat miliknya.
--   • is_staff() memakai "role <> 'patient'" → fail-safe: bila ada role staf
--     yang tak terduga, ia tetap dianggap staf (dapat akses), bukan terkunci.
--
-- REVERSIBLE: untuk kembali ke kondisi Fase A, cukup jalankan lagi:
--     supabase-rls-fase-a.sql
--
-- ⚠️  LANGKAH 0 (WAJIB, jalankan DULU & terpisah) — pastikan akun staf aman:
--     SELECT email, role, (auth_id IS NOT NULL) AS linked
--     FROM public.profiles ORDER BY role;
--     → Semua baris staf (owner/dokter/admin/apotek) HARUS: role BUKAN 'patient'
--       DAN linked = true. Bila ada staf yang role='patient' atau linked=false,
--       JANGAN lanjut — perbaiki dulu (kalau tidak, staf itu bisa terkunci).
--
-- Jalankan seluruh isi file ini sekali di Supabase SQL editor, saat jam sepi.
-- =============================================

-- ---- Helper: identitas user yang login (SECURITY DEFINER = lewati RLS) ----
CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT id FROM public.profiles WHERE auth_id = auth.uid() LIMIT 1
$fn$;

CREATE OR REPLACE FUNCTION public.current_patient_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT pt.id FROM public.patients pt
  JOIN public.profiles pr ON pr.id = pt.profile_id
  WHERE pr.auth_id = auth.uid() LIMIT 1
$fn$;

-- Staf = user login yang BUKAN pasien.
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_id = auth.uid() AND role <> 'patient'
  )
$fn$;

-- Utilitas kecil: hapus semua policy pada sebuah tabel (bila tabelnya ada).
CREATE OR REPLACE FUNCTION public._drop_all_policies(tbl TEXT)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE r RECORD;
BEGIN
  IF to_regclass('public.'||tbl) IS NULL THEN RETURN; END IF;
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=tbl LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, tbl);
  END LOOP;
END $fn$;

-- =============================================================
-- 1) REKAM KLINIS → staf penuh; pasien HANYA BACA miliknya (patient_id)
--    medical_records, prescriptions, vaccinations, lab_results
-- =============================================================
DO $do$
DECLARE t TEXT;
  tables TEXT[] := ARRAY['medical_records','prescriptions','vaccinations','lab_results'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.'||t) IS NULL THEN CONTINUE; END IF;
    PERFORM public._drop_all_policies(t);
    EXECUTE format('CREATE POLICY "staff_all" ON public.%I FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff())', t);
    EXECUTE format('CREATE POLICY "patient_read_own" ON public.%I FOR SELECT TO authenticated USING (patient_id = public.current_patient_id())', t);
  END LOOP;
END $do$;

-- prescription_items → ikut kepemilikan resep induknya (read-only bagi pasien)
SELECT public._drop_all_policies('prescription_items');
CREATE POLICY "staff_all" ON public.prescription_items FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "patient_read_own" ON public.prescription_items FOR SELECT TO authenticated
  USING (prescription_id IN (SELECT id FROM public.prescriptions WHERE patient_id = public.current_patient_id()));

-- =============================================================
-- 2) APPOINTMENTS → staf penuh; pasien HANYA BACA miliknya.
--    (Respons pasien "hadir/ganti hari" lewat RPC SECURITY DEFINER, bukan tulis
--     tabel langsung — jadi cukup izin baca di sini.)
-- =============================================================
SELECT public._drop_all_policies('appointments');
CREATE POLICY "staff_all" ON public.appointments FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "patient_read_own" ON public.appointments FOR SELECT TO authenticated
  USING (patient_id = public.current_patient_id());

-- =============================================================
-- 3) NOTIFICATIONS → staf penuh; pasien BACA + TANDAI-DIBACA miliknya.
-- =============================================================
SELECT public._drop_all_policies('notifications');
CREATE POLICY "staff_all" ON public.notifications FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "patient_read_own" ON public.notifications FOR SELECT TO authenticated
  USING (profile_id = public.current_profile_id());
CREATE POLICY "patient_update_own" ON public.notifications FOR UPDATE TO authenticated
  USING (profile_id = public.current_profile_id()) WITH CHECK (profile_id = public.current_profile_id());

-- =============================================================
-- 4) BOOKINGS → tamu(anon) boleh buat; staf penuh; pasien buat/lihat miliknya.
-- =============================================================
SELECT public._drop_all_policies('bookings');
CREATE POLICY "public_insert" ON public.bookings FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "staff_all" ON public.bookings FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "patient_own" ON public.bookings FOR ALL TO authenticated
  USING (patient_id = public.current_patient_id()) WITH CHECK (patient_id = public.current_patient_id());

-- =============================================================
-- 5) CHAT (consultations & consultation_messages) → staf penuh;
--    pasien kelola percakapan miliknya. (Guarded — tabel mungkin belum ada.)
-- =============================================================
DO $do$ BEGIN
  IF to_regclass('public.consultations') IS NOT NULL THEN
    PERFORM public._drop_all_policies('consultations');
    EXECUTE 'CREATE POLICY "staff_all" ON public.consultations FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff())';
    EXECUTE 'CREATE POLICY "patient_own" ON public.consultations FOR ALL TO authenticated USING (patient_id = public.current_patient_id()) WITH CHECK (patient_id = public.current_patient_id())';
  END IF;
  IF to_regclass('public.consultation_messages') IS NOT NULL THEN
    PERFORM public._drop_all_policies('consultation_messages');
    EXECUTE 'CREATE POLICY "staff_all" ON public.consultation_messages FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff())';
    EXECUTE 'CREATE POLICY "patient_own" ON public.consultation_messages FOR ALL TO authenticated USING (consultation_id IN (SELECT id FROM public.consultations WHERE patient_id = public.current_patient_id())) WITH CHECK (consultation_id IN (SELECT id FROM public.consultations WHERE patient_id = public.current_patient_id()))';
  END IF;
END $do$;

-- =============================================================
-- 6) PROFILES & PATIENTS → identitas.
--    profiles : anon boleh DAFTAR; staf penuh; pasien BACA profilnya saja
--               (tidak boleh ubah role → cegah naik-hak jadi staf).
--    patients : anon boleh DAFTAR; staf penuh; pasien baca+ubah data dirinya.
-- =============================================================
SELECT public._drop_all_policies('profiles');
CREATE POLICY "anon_register" ON public.profiles FOR INSERT TO anon WITH CHECK (role = 'patient');
CREATE POLICY "staff_all" ON public.profiles FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "patient_read_own" ON public.profiles FOR SELECT TO authenticated
  USING (id = public.current_profile_id());

SELECT public._drop_all_policies('patients');
CREATE POLICY "anon_register" ON public.patients FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "staff_all" ON public.patients FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "patient_read_own" ON public.patients FOR SELECT TO authenticated
  USING (id = public.current_patient_id());
CREATE POLICY "patient_update_own" ON public.patients FOR UPDATE TO authenticated
  USING (id = public.current_patient_id()) WITH CHECK (id = public.current_patient_id());

-- =============================================================
-- 7) TABEL KHUSUS STAF (pasien tidak perlu) → hanya staf.
--    inventory, home_care_claims, home_care_claim_items
--    pharmacies → boleh dibaca semua user login (nama apotek pada resep),
--                 tapi hanya staf yang boleh menulis.
-- =============================================================
DO $do$
DECLARE t TEXT;
  tables TEXT[] := ARRAY['inventory','home_care_claims','home_care_claim_items'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.'||t) IS NULL THEN CONTINUE; END IF;
    PERFORM public._drop_all_policies(t);
    EXECUTE format('CREATE POLICY "staff_all" ON public.%I FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff())', t);
  END LOOP;
END $do$;

SELECT public._drop_all_policies('pharmacies');
CREATE POLICY "read_auth" ON public.pharmacies FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff_write" ON public.pharmacies FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- Catatan: health_services, doctors, articles, certificates TIDAK diubah di Fase B
-- (kebijakan publik dari Fase A tetap berlaku — dibutuhkan halaman publik & pasien).

SELECT 'RLS Fase B applied — pasien kini hanya melihat datanya sendiri' as status;

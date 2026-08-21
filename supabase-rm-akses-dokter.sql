-- =============================================================================
-- REKAM MEDIS TERBUKA UNTUK SELURUH DOKTER
--
-- MENGGANTIKAN sebagian supabase-rm-privasi.sql. Jalankan SESUDAH berkas itu.
--
-- KENAPA DIUBAH
--
-- supabase-rm-privasi.sql membatasi dokter pada pasien yang punya jejak
-- dengannya. Di klinik ini hasilnya kacau: memilih pasien untuk diperiksa
-- justru mendarat di layar terkunci, padahal orangnya sedang berdiri di depan
-- meja — dan jejaknya memang belum ada, karena pemeriksaannya belum dimulai.
-- Pintu darurat yang tercatat tetap satu langkah tambahan pada setiap pasien
-- baru, dan langkah tambahan pada pekerjaan yang berulang puluhan kali sehari
-- akan dicari jalan memutarnya.
--
-- YANG BERLAKU SEKARANG
--
--   pemilik klinik & Super Admin : penuh
--   DOKTER                       : penuh atas SELURUH pasien klinik
--   pasien                       : rekam medisnya sendiri (tidak berubah)
--   apotek                       : TIDAK ada akses ke isi rekam medis
--                                  (tidak berubah — hanya resep)
--
-- Yang tetap dibatasi bukan pasiennya, melainkan panel Rekam Medis di
-- aplikasi: seorang dokter hanya melihat KUNJUNGAN yang ia tangani sendiri di
-- sana. Riwayat lengkap pasien — termasuk kunjungan dokter lain — terbuka
-- begitu pasiennya dibuka satu per satu. Itu pembatasan tampilan, bukan
-- pembatasan izin, dan memang begitu maksudnya.
--
-- Tabel rm_access_claims TIDAK dihapus: menjatuhkan tabel tidak bisa
-- dibatalkan, dan isinya adalah catatan pembukaan akses yang pernah terjadi.
-- Ia berhenti dipakai, bukan dihilangkan.
--
-- Jalankan sekali di Supabase SQL editor. Aman diulang.
-- =============================================================================

-- Penolong: akun yang sedang login adalah dokter.
CREATE OR REPLACE FUNCTION public.is_doctor()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT EXISTS (SELECT 1 FROM public.profiles
                 WHERE auth_id = auth.uid() AND role = 'doctor')
$fn$;

-- is_rm_manager() sudah dibuat oleh supabase-rm-privasi.sql. Dibuat lagi di
-- sini supaya berkas ini tetap bisa dijalankan sendiri.
CREATE OR REPLACE FUNCTION public.is_rm_manager()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT EXISTS (SELECT 1 FROM public.profiles
                 WHERE auth_id = auth.uid() AND role IN ('owner','superadmin'))
$fn$;

DO $do$
DECLARE t TEXT;
  tables TEXT[] := ARRAY['medical_records','vaccinations','lab_results'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.'||t) IS NULL THEN CONTINUE; END IF;

    -- Kebijakan lama yang menyaring per dokter dicabut...
    EXECUTE format('DROP POLICY IF EXISTS "doctor_own_patients" ON public.%I', t);
    -- ...dan "staff_all" TIDAK dihidupkan lagi: itulah yang dulu memberi akses
    -- penuh kepada APOTEK juga.
    EXECUTE format('DROP POLICY IF EXISTS "staff_all" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "rm_manager_all" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "rm_dokter_penuh" ON public.%I', t);

    EXECUTE format($p$CREATE POLICY "rm_manager_all" ON public.%I
      FOR ALL TO authenticated
      USING (public.is_rm_manager()) WITH CHECK (public.is_rm_manager())$p$, t);

    EXECUTE format($p$CREATE POLICY "rm_dokter_penuh" ON public.%I
      FOR ALL TO authenticated
      USING (public.is_doctor()) WITH CHECK (public.is_doctor())$p$, t);
  END LOOP;
END $do$;

-- Resep: apotek TETAP membacanya — itu memang pekerjaannya. Yang berubah
-- hanya bagian dokternya, dari "pasien yang ia tangani" jadi seluruh pasien.
DROP POLICY IF EXISTS "staff_all" ON public.prescriptions;
DROP POLICY IF EXISTS "rx_manager_pharmacy" ON public.prescriptions;
CREATE POLICY "rx_manager_pharmacy" ON public.prescriptions
  FOR ALL TO authenticated
  USING (public.is_rm_manager() OR public.is_doctor()
         OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.auth_id = auth.uid() AND p.role = 'pharmacy'))
  WITH CHECK (public.is_rm_manager() OR public.is_doctor()
         OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.auth_id = auth.uid() AND p.role = 'pharmacy'));

-- ---- Pemeriksa — satu perintah, semua bagian ikut tampil -------------------
SELECT 'kebijakan' AS bagian,
       tablename || ' / ' || policyname AS yang_diperiksa,
       'ada' AS keadaan
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('medical_records','vaccinations','lab_results','prescriptions')

UNION ALL
-- "staff_all" TIDAK BOLEH muncul lagi: itulah yang membuka isi rekam medis
-- untuk akun apotek.
SELECT 'apotek tertutup dari isi RM', 'staff_all sudah dicabut',
       CASE WHEN EXISTS (SELECT 1 FROM pg_policies
                         WHERE schemaname='public' AND tablename='medical_records'
                           AND policyname='staff_all')
            THEN 'MASIH ADA — apotek bisa baca isi RM' ELSE 'OK' END

UNION ALL
SELECT 'dokter penuh', t,
       CASE WHEN EXISTS (SELECT 1 FROM pg_policies
                         WHERE schemaname='public' AND tablename=t
                           AND policyname='rm_dokter_penuh')
            THEN 'OK' ELSE 'BELUM' END
FROM unnest(ARRAY['medical_records','vaccinations','lab_results']) AS t

UNION ALL
SELECT 'penolong', f,
       CASE WHEN EXISTS (SELECT 1 FROM pg_proc
                         WHERE pronamespace='public'::regnamespace AND proname=f)
            THEN 'OK' ELSE 'BELUM' END
FROM unnest(ARRAY['is_doctor','is_rm_manager']) AS f
ORDER BY 1, 2;

-- =============================================
-- RLS FASE A — Tutup akses ANONIM
-- Tujuan: kunci publik (anon key) yang tertanam di aplikasi TIDAK BISA lagi
--   membaca/mengubah data pasien. User yang SUDAH LOGIN tetap berjalan normal.
-- Belum memisahkan "pasien hanya lihat datanya sendiri" (itu Fase B).
--
-- REVERSIBLE: untuk kembali ke kondisi semula, jalankan
--   supabase-rls-fase-a-rollback.sql
--
-- Jalankan seluruh isi file ini sekali di Supabase SQL editor.
-- =============================================

-- Kolom yang dipakai kebijakan publik (aman bila sudah ada).
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS is_public_listed BOOLEAN DEFAULT false;

-- ---- 1) TABEL SENSITIF → hanya user login (authenticated) ----
-- Anon (belum login) tidak mendapat kebijakan apa pun = akses ditolak.
DO $$
DECLARE t TEXT; r RECORD;
  tables TEXT[] := ARRAY[
    'pharmacies','medical_records','prescriptions','prescription_items',
    'appointments','vaccinations','notifications','inventory',
    'home_care_claims','home_care_claim_items',
    'consultations','consultation_messages','lab_results'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.'||t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, t);
    END LOOP;
    EXECUTE format('CREATE POLICY "authenticated_all" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

-- ---- 2) profiles & patients → login penuh + anon boleh DAFTAR (insert) ----
-- Pendaftaran pasien mandiri menulis baris baru sebelum login, jadi anon
-- diberi izin INSERT saja (tidak boleh baca/ubah/hapus). Profil hanya boleh
-- dibuat dengan peran 'patient' oleh anon.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='profiles' LOOP
    EXECUTE format('DROP POLICY %I ON public.profiles', r.policyname);
  END LOOP;
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='patients' LOOP
    EXECUTE format('DROP POLICY %I ON public.patients', r.policyname);
  END LOOP;
END $$;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_all" ON public.profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_register"     ON public.profiles FOR INSERT TO anon WITH CHECK (role = 'patient');

CREATE POLICY "authenticated_all" ON public.patients FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_register"     ON public.patients FOR INSERT TO anon WITH CHECK (true);

-- ---- 3) TABEL DENGAN KEBUTUHAN PUBLIK ----

-- health_services: publik boleh baca layanan AKTIF; staf kelola semua.
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='health_services' LOOP
    EXECUTE format('DROP POLICY %I ON public.health_services', r.policyname); END LOOP; END $$;
ALTER TABLE public.health_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_active" ON public.health_services FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "authenticated_all"  ON public.health_services FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- doctors: publik hanya baca dokter yang tampil di beranda; staf semua.
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='doctors' LOOP
    EXECUTE format('DROP POLICY %I ON public.doctors', r.policyname); END LOOP; END $$;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_listed" ON public.doctors FOR SELECT TO anon USING (is_public_listed = true);
CREATE POLICY "authenticated_all"  ON public.doctors FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- articles: publik boleh baca; staf tulis.
DO $$ DECLARE r RECORD; BEGIN
  IF to_regclass('public.articles') IS NOT NULL THEN
    FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='articles' LOOP
      EXECUTE format('DROP POLICY %I ON public.articles', r.policyname); END LOOP;
  END IF; END $$;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read"       ON public.articles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "authenticated_all" ON public.articles FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- bookings: tamu boleh MEMBUAT (insert); baca/kelola hanya staf.
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='bookings' LOOP
    EXECUTE format('DROP POLICY %I ON public.bookings', r.policyname); END LOOP; END $$;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_insert"     ON public.bookings FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "authenticated_all" ON public.bookings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- certificates: publik verifikasi (select) & catat (insert); staf ubah/hapus.
DO $$ DECLARE r RECORD; BEGIN
  IF to_regclass('public.certificates') IS NOT NULL THEN
    FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='certificates' LOOP
      EXECUTE format('DROP POLICY %I ON public.certificates', r.policyname); END LOOP;
  END IF; END $$;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read"    ON public.certificates FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_insert"  ON public.certificates FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "auth_update"    ON public.certificates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete"    ON public.certificates FOR DELETE TO authenticated USING (true);

SELECT 'RLS Fase A applied — akses anonim ditutup untuk tabel sensitif' as status;

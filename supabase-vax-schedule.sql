-- =============================================================================
-- JADWAL VAKSIN ANAK (IDAI) + PENCATATAN VAKSIN YANG DIBERIKAN DI LUAR
--
-- Dua hal sekaligus, karena keduanya baru berguna kalau ada bersamaan.
--
-- 1) TABEL JADWAL. Angka usia minimum dan jarak minimum antar dosis tidak
--    boleh hidup di dalam kode. Rekomendasi IDAI berubah (2023 dan 2024 saja
--    sudah berbeda di DTP, PCV, rotavirus, MR, dan dengue), dan yang berhak
--    membetulkannya adalah dokter, bukan orang yang menerbitkan aplikasi.
--    Bibit angkanya ada di js/idai.js dan berstatus BELUM DIVERIFIKASI —
--    lihat peringatan panjang di berkas itu. Begitu dokter mencocokkannya
--    dengan tabel IDAI asli dan menekan "Saya sudah verifikasi", hasilnya
--    tersimpan di sini dan menimpa bibitnya, sehingga pembetulannya tidak
--    ikut hilang saat aplikasi diperbarui.
--
-- 2) DUA KOLOM DI vaccinations. series_key mengikat satu baris ke seri IDAI
--    tertentu — tanpa itu 'DPT', 'DTP', dan 'Pentabio' terhitung sebagai tiga
--    vaksin berbeda dan serinya tidak pernah terlihat lengkap. vax_source
--    menandai dosis yang diberikan DI LUAR (puskesmas / klinik lain) atas
--    keterangan orang tua: sah sebagai riwayat, tetapi tidak boleh ikut
--    tercetak di sertifikat yang kami tanda tangani, karena bukan kami yang
--    memberikannya.
--
-- Jalankan sekali di Supabase SQL editor. Aman diulang.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tabel jadwal
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vax_schedule (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payload    JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.vax_schedule IS
  'Jadwal imunisasi anak (usia minimum & jarak minimum tiap dosis). payload = {seri:[...], meta:{...}}. Baris terbaru yang dipakai.';
COMMENT ON COLUMN public.vax_schedule.payload IS
  'meta.verified=true hanya boleh diisi setelah dokter mencocokkan seluruh angkanya dengan tabel IDAI asli.';

CREATE INDEX IF NOT EXISTS idx_vax_schedule_updated ON public.vax_schedule (updated_at DESC);

ALTER TABLE public.vax_schedule ENABLE ROW LEVEL SECURITY;

-- Semua yang sudah login boleh MEMBACA: orang tua perlu melihat jadwal
-- anaknya, dan jadwalnya sendiri bukan data pribadi siapa pun.
DROP POLICY IF EXISTS vax_schedule_read ON public.vax_schedule;
CREATE POLICY vax_schedule_read ON public.vax_schedule
  FOR SELECT TO authenticated USING (true);

-- Yang boleh MENGUBAH hanya dokter dan super admin. Angka di tabel ini
-- menentukan kapan seorang bayi disuntik; salah ketik oleh akun yang tidak
-- berwenang bukan sesuatu yang bisa diperbaiki belakangan.
DROP POLICY IF EXISTS vax_schedule_write ON public.vax_schedule;
CREATE POLICY vax_schedule_write ON public.vax_schedule
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p
                 WHERE p.id = auth.uid() AND p.role IN ('doctor', 'superadmin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p
                      WHERE p.id = auth.uid() AND p.role IN ('doctor', 'superadmin')));

-- ---------------------------------------------------------------------------
-- 2. Kolom baru di vaccinations
-- ---------------------------------------------------------------------------
ALTER TABLE public.vaccinations
  ADD COLUMN IF NOT EXISTS series_key TEXT,
  ADD COLUMN IF NOT EXISTS vax_source TEXT;

COMMENT ON COLUMN public.vaccinations.series_key IS
  'Kunci seri IDAI (js/idai.js). Boleh lebih dari satu dipisah koma: satu suntikan pentavalen menghitung untuk dtp, hepb, dan hib sekaligus.';
COMMENT ON COLUMN public.vaccinations.vax_source IS
  'Kosong/klinik = diberikan di sini. ''luar'' = diberikan di puskesmas/klinik lain, dicatat atas keterangan orang tua.';

CREATE INDEX IF NOT EXISTS idx_vaccinations_series
  ON public.vaccinations (patient_id, series_key)
  WHERE series_key IS NOT NULL;

-- approval_status untuk baris 'luar' diisi 'external'. Bukan 'approved':
-- tidak ada dokter kami yang menyaksikannya, jadi ia tidak ikut dicetak di
-- sertifikat. Bukan 'pending' juga: tidak ada yang perlu di-ACC, karena
-- tindakan itu memang bukan tindakan kami.
--
-- ---- Pemeriksa: dosis luar yang tercatat, per anak -------------------------
SELECT p.full_name                       AS anak,
       p.birth_date                      AS lahir,
       v.vaccine_name,
       v.date_given                      AS tanggal,
       v.location                        AS tempat,
       v.series_key
FROM public.vaccinations v
JOIN public.patients p ON p.id = v.patient_id
WHERE v.vax_source = 'luar'
ORDER BY v.date_given DESC;

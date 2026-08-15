-- =============================================================================
-- DOSIS DI LUAR JADWAL, DAN PENGINGAT VAKSIN YANG PUNYA SATU SUMBER KEBENARAN
--
-- Dua perbaikan, dan keduanya menutup satu kemungkinan yang sama: aplikasi ini
-- menyatakan seorang anak aman padahal tidak.
--
--   1. off_schedule / off_schedule_reason pada vaccinations.
--
--      Sebelumnya "paling cepat boleh" dihitung dengan benar, ditampilkan di
--      layar, lalu tidak dipakai untuk apa pun. Dosis DTP kedua yang diberikan
--      seminggu setelah yang pertama (seharusnya berjarak 4 minggu) diterima
--      tanpa suara, dihitung sebagai dosis sah, dan serinya maju ke dosis 3 —
--      anaknya tampil "sesuai jadwal" padahal dosis keduanya tidak berlaku dan
--      harus diulang.
--
--      Sekarang setiap pencatatan diperiksa terhadap usia minimum, jarak
--      minimum, dan batas usia. Yang janggal TIDAK DITOLAK — vaksinnya sudah
--      masuk ke tubuh anak, dan riwayat yang bolong lebih berbahaya daripada
--      riwayat yang bertanda — melainkan ditandai berikut alasannya, supaya
--      ada yang meninjau apakah dosis itu perlu diulang.
--
--   2. vax_plan_reminders.
--
--      Pengingat vaksin dulu lahir dari kolom next_dose_date yang DIKETIK
--      TANGAN saat dosis sebelumnya dicatat, sementara kartu di layar memakai
--      tanggal HITUNGAN dari jadwal IDAI. Dua sumber kebenaran yang tidak
--      pernah saling melihat: begitu satu dosis tertunda, tanggal ketikan itu
--      tidak ikut bergeser, dan orang tua menerima WA "waktunya dosis 2"
--      sementara aplikasinya berkata "belum waktunya".
--
--      Sekarang pengingat untuk anak dihitung dari jadwal IDAI. Konsekuensinya:
--      hitungan "sudah berapa kali diingatkan" tidak lagi bisa menumpang di
--      baris vaksinasi, karena justru kasus terpenting tidak punya baris sama
--      sekali — anak yang BELUM PERNAH divaksin. Dulu anak seperti itu tidak
--      pernah muncul di daftar pengingat mana pun. Maka hitungannya disimpan
--      per (pasien, seri) di tabel ini.
--
-- Jalankan sekali di Supabase SQL editor. Aman diulang.
--
-- Aplikasi tetap berjalan tanpa migrasi ini: baris vaksinasi yang ditolak
-- karena kolomnya belum ada akan dicoba ulang tanpa kolom itu, sehingga
-- kejadian vaksinasinya tidak hilang. Yang hilang hanya tandanya.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tanda dosis di luar jadwal
-- ---------------------------------------------------------------------------
ALTER TABLE public.vaccinations
  ADD COLUMN IF NOT EXISTS off_schedule        boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS off_schedule_reason text    DEFAULT '',
  ADD COLUMN IF NOT EXISTS off_schedule_note   text    DEFAULT '';

UPDATE public.vaccinations SET off_schedule = false WHERE off_schedule IS NULL;

COMMENT ON COLUMN public.vaccinations.off_schedule IS
  'true = dosis ini menyimpang dari jadwal IDAI saat dicatat (terlalu cepat dari usia/jarak minimum, atau lewat batas usia). TETAP dihitung sebagai dosis yang sudah masuk — menghilangkannya diam-diam sama menyesatkannya dengan menerimanya diam-diam — tetapi layar menandainya agar ditinjau.';

-- DUA KOLOM, DUA PEMILIK — dan pemisahan ini bukan kerapian belaka. Waktu
-- keduanya masih satu kolom, membetulkan tanggal pemberian membuat teks temuan
-- lama terbaca sebagai kalimat dokter, lalu tersimpan kembali sebagai
-- keterangan yang tidak pernah ia tulis.
COMMENT ON COLUMN public.vaccinations.off_schedule_reason IS
  'Temuan pemeriksa, ditulis ulang otomatis setiap kali dosis ini diperiksa ulang. Jangan disunting tangan — isinya akan tertimpa.';

COMMENT ON COLUMN public.vaccinations.off_schedule_note IS
  'Kalimat dokter/petugas: kenapa dosisnya tetap diberikan di luar jadwal. Tidak pernah ditimpa aplikasi.';

-- Dipakai layar tinjauan: dosis mana saja yang perlu dilihat ulang.
CREATE INDEX IF NOT EXISTS idx_vaccinations_off_schedule
  ON public.vaccinations (patient_id) WHERE off_schedule;

-- ---------------------------------------------------------------------------
-- 2. Hitungan pengingat per (pasien, seri)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vax_plan_reminders (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id        uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  series_key        text NOT NULL,              -- kunci seri IDAI, mis. 'dtp', 'pcv'
  wa_reminder_count int  DEFAULT 0,
  wa_last_sent_at   timestamptz,
  created_at        timestamptz DEFAULT now()
);

-- Satu baris per pasien per seri. Tanpa ini, dua petugas yang menekan
-- "tandai sudah dikirim" bersamaan menghasilkan dua baris, dan hitungannya
-- terbelah — yang sudah diingatkan 6 kali terbaca sebagai 3 dan 3.
CREATE UNIQUE INDEX IF NOT EXISTS idx_vax_plan_reminders_unik
  ON public.vax_plan_reminders (patient_id, series_key);

ALTER TABLE public.vax_plan_reminders ENABLE ROW LEVEL SECURITY;

-- Hitungan pengingat bukan data klinis pasien; ia catatan kerja klinik.
-- Yang boleh membacanya dan menambahnya: staf yang mengerjakan pengingat.
DROP POLICY IF EXISTS "vax_plan_reminders_staff" ON public.vax_plan_reminders;
CREATE POLICY "vax_plan_reminders_staff" ON public.vax_plan_reminders
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p
                 WHERE p.auth_id = auth.uid() AND p.role IN ('superadmin','owner','doctor')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p
                      WHERE p.auth_id = auth.uid() AND p.role IN ('superadmin','owner','doctor')));

-- ---- Pemeriksa ------------------------------------------------------------
-- Kolomnya sudah ada.
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'vaccinations'
  AND column_name IN ('off_schedule', 'off_schedule_reason', 'off_schedule_note')
ORDER BY column_name;

-- Tabel pengingatnya sudah ada (0 baris pada pemasangan pertama — itu wajar).
SELECT count(*) AS baris_pengingat_rencana FROM public.vax_plan_reminders;

-- Dosis yang sudah terlanjur tercatat TIDAK ikut diperiksa surut: tandanya
-- dipasang saat pencatatan. Daftar di bawah akan kosong sampai ada vaksinasi
-- baru yang janggal. Itu disengaja — menandai riwayat lama secara borongan
-- berarti menuduh pencatatan yang tidak bisa lagi dijelaskan siapa pun.
SELECT v.date_given, v.vaccine_name, v.off_schedule_reason
FROM public.vaccinations v
WHERE v.off_schedule
ORDER BY v.date_given DESC
LIMIT 20;

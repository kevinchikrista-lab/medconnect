-- =============================================
-- Vaksinasi yang diinput ADMIN → butuh ACC dokter.
--
-- Sebelumnya data vaksinasi hanya bisa diisi dokter dari halaman rekam medis.
-- Sekarang Super Admin / Owner bisa mencatat sendiri, tapi catatannya berstatus
-- 'pending' sampai dokter penanggung jawab menyetujui (ACC). Sertifikat vaksin
-- baru bisa dicetak setelah semua dosisnya disetujui.
--
-- Baris lama (yang diisi dokter) otomatis bernilai 'approved', jadi tidak ada
-- data existing yang tiba-tiba jadi menunggu persetujuan.
--
-- Jalankan sekali di Supabase SQL editor.
-- =============================================

ALTER TABLE public.vaccinations
  ADD COLUMN IF NOT EXISTS approval_status     text DEFAULT 'approved',  -- approved | pending | rejected
  ADD COLUMN IF NOT EXISTS approval_doctor_id  uuid,                     -- dokter yang harus meng-ACC
  ADD COLUMN IF NOT EXISTS approval_created_by uuid,                     -- admin yang menginput
  ADD COLUMN IF NOT EXISTS approved_at         timestamptz,
  ADD COLUMN IF NOT EXISTS reject_reason       text;

-- Pastikan baris lama tidak ada yang NULL (NULL akan dibaca sebagai 'approved'
-- oleh aplikasi, tapi lebih baik eksplisit).
UPDATE public.vaccinations SET approval_status = 'approved' WHERE approval_status IS NULL;

-- Antrean ACC dokter mengambil baris pending miliknya — indeks kecil ini
-- membuatnya tetap ringan saat data vaksinasi bertambah banyak.
CREATE INDEX IF NOT EXISTS idx_vaccinations_pending
  ON public.vaccinations (approval_doctor_id) WHERE approval_status = 'pending';

SELECT approval_status, count(*) AS jumlah
FROM public.vaccinations GROUP BY approval_status ORDER BY approval_status;

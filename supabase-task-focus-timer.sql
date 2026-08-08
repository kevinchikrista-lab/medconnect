-- =============================================
-- TIMER FOKUS pada kolom "Fokus Sekarang".
--
-- Waktu kerja TIDAK dihitung oleh penghitung di browser, melainkan dari dua
-- kolom di bawah, supaya tetap benar meski halaman ditutup, di-refresh,
-- berpindah perangkat, atau laptopnya tertidur:
--
--     total detik = focus_seconds + (focus_at ? sekarang - focus_at : 0)
--
--   focus_seconds : waktu yang SUDAH dibukukan dari sesi-sesi sebelumnya
--   focus_at      : kapan potongan waktu yang SEDANG BERJALAN dimulai;
--                   NULL berarti timernya sedang dijeda
--
-- Menjeda = tambahkan (sekarang - focus_at) ke focus_seconds, lalu kosongkan
-- focus_at. Melanjutkan = isi focus_at dengan waktu sekarang. Karena itu
-- pekerjaan yang ditinggal mendadak bisa dilanjutkan tanpa kehilangan hitungan.
--
-- Catatan: focus_at sudah dibuat oleh supabase-task-status.sql — di sana
-- artinya "kapan mulai dikerjakan". Sekarang artinya dipersempit jadi "awal
-- potongan waktu yang sedang berjalan". Baris lama tetap terbaca benar:
-- focus_seconds-nya 0, jadi hitungannya persis sama seperti sebelumnya.
--
-- Jalankan sekali di Supabase SQL editor. Aman diulang.
-- =============================================

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS focus_seconds   int DEFAULT 0,   -- akumulasi detik yang sudah dibukukan
  ADD COLUMN IF NOT EXISTS focus_target_min int DEFAULT 50; -- target sesi (menit) sebelum diingatkan istirahat

-- Baris lama belum punya nilai — samakan agar tidak ada NULL yang ikut
-- terhitung sebagai NaN di aplikasi.
UPDATE public.tasks SET focus_seconds = 0    WHERE focus_seconds IS NULL;
UPDATE public.tasks SET focus_target_min = 50 WHERE focus_target_min IS NULL;

SELECT status,
       count(*) AS jumlah,
       count(*) FILTER (WHERE focus_at IS NOT NULL) AS timer_berjalan,
       COALESCE(sum(focus_seconds), 0) AS total_detik_terbukukan
FROM public.tasks GROUP BY status ORDER BY status;

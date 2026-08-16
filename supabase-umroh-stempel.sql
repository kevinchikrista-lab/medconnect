-- =============================================================================
-- FITUR VAKSIN UMROH — SAKLAR PER AKUN KLINIK
--
-- Tidak semua klinik melayani vaksin umroh. Yang tidak melayaninya selama ini
-- tetap melihat menu "Umroh & Haji", membukanya, dan menemukan halaman kosong
-- berisi istilah yang tidak berarti apa-apa bagi mereka. Maka fiturnya
-- dinyalakan per akun dari Manajemen User, sama seperti Catatan Bisnis.
--
-- MEMATIKANNYA MENYEMBUNYIKAN, BUKAN MENGHAPUS. Baris umroh_sales dan catatan
-- jemaah yang sudah masuk tetap utuh dan muncul lagi begitu saklarnya
-- dinyalakan kembali. Saklar menu yang diam-diam membuang data adalah kejutan
-- yang paling mahal, dan itu sebabnya migrasi ini tidak menyentuh satu pun
-- tabel data.
--
-- Jalankan sekali di Supabase SQL editor. Aman diulang.
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS can_umroh boolean DEFAULT false;

UPDATE public.profiles SET can_umroh = false WHERE can_umroh IS NULL;

COMMENT ON COLUMN public.profiles.can_umroh IS
  'true = akun ini melayani vaksin umroh, sehingga melihat menu Umroh & Haji dan Stempel Foto Umroh. Dinyalakan dari Manajemen User oleh pemilik klinik. Mematikannya hanya menyembunyikan menunya — data jemaah tidak terhapus.';

-- Akun pemilik klinik dinyalakan sejak awal, supaya saklar untuk menyalakan
-- fiturnya tidak berada di balik fitur yang belum dinyalakan.
UPDATE public.profiles SET can_umroh = true WHERE role = 'owner';

-- ---- Pemeriksa ------------------------------------------------------------
-- Siapa yang melihat menu Vaksin Umroh.
SELECT full_name, email, role, can_umroh
FROM public.profiles
WHERE can_umroh
ORDER BY role, full_name;

-- HARUS TETAP SEPERTI SEBELUM MIGRASI: tidak ada data jemaah yang tersentuh.
SELECT count(*) AS baris_umroh_sales FROM public.umroh_sales;

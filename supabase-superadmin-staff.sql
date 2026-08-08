-- =============================================
-- SUPER ADMIN BISA LEBIH DARI SATU (Anis, Fitri, dst.)
--
-- Selama ini hanya ada satu akun Super Admin bawaan, dan aplikasi
-- menampilkannya dengan nama tetap "Super Admin" karena profiles tidak
-- menyimpan nama. Supaya bisa menambah beberapa Super Admin dengan nama
-- masing-masing (dan nomor HP untuk pengingat WhatsApp pada tugas), profiles
-- perlu dua kolom baru.
--
-- Peran lain (dokter, pasien, apotek) namanya tetap diambil dari tabelnya
-- sendiri (doctors / patients / pharmacies). Kolom di sini hanya dipakai
-- sebagai cadangan bila baris profil itu belum ada — dan untuk Super Admin,
-- yang memang tidak punya tabel profil tersendiri.
--
-- Jalankan sekali di Supabase SQL editor.
-- =============================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS phone     text;

-- Skema awal membatasi role ke ('superadmin','doctor','patient','pharmacy')
-- sehingga 'owner' tidak lolos. Batasannya dibuka supaya kelima peran sah.
-- (Kalau constraint-nya sudah pernah diubah manual, DROP ... IF EXISTS aman.)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('superadmin', 'owner', 'doctor', 'patient', 'pharmacy'));

-- Super Admin lama belum punya nama — beri label bawaan supaya tidak kosong
-- di daftar penerima tugas. Namanya bisa diubah nanti lewat Manajemen User.
UPDATE public.profiles
SET full_name = 'Super Admin'
WHERE role = 'superadmin' AND (full_name IS NULL OR btrim(full_name) = '');

SELECT role, count(*) AS jumlah
FROM public.profiles GROUP BY role ORDER BY role;

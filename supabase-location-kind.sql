-- =============================================
-- TEMPAT PRAKTIK MENGIKUTI AKUN FASILITAS.
--
-- Aplikasi ini bukan lagi milik satu klinik. Ia menghubungkan dokter, apotek,
-- klinik, dan admin dari berbagai tempat — jadi setiap fasilitas yang punya
-- akun HARUS punya tempat praktiknya sendiri, lengkap dengan kop. Kalau tidak,
-- resep dan surat dari sana tercetak memakai identitas klinik lain, dan
-- dokumen medis yang salah kop adalah dokumen yang salah penerbitnya.
--
-- TAPI TIDAK SEMUA BARIS DI DAFTAR ITU FASILITAS. "Home Care" dan
-- "Telemedicine" adalah CARA layanan, bukan tempat: tidak punya akun, tidak
-- punya kop sendiri, dan tidak boleh ikut ditagih kelengkapannya. Tanpa
-- membedakan keduanya, daftar "yang belum lengkap" akan selamanya memuat dua
-- baris yang memang tidak akan pernah lengkap — dan daftar yang tidak pernah
-- bisa dikosongkan adalah daftar yang berhenti dibaca.
--
-- Itulah yang ditambahkan file ini: satu kolom penanda jenis.
--
--   'facility' — tempat fisik berakun. Wajib ada untuk tiap akun apotek/klinik,
--                dan kop-nya wajib diisi.
--   'service'  — cara layanan. Dikecualikan dari semua tagihan kelengkapan.
--
-- Aplikasi menyimpulkan jenisnya dari nama bila kolomnya masih kosong, tapi
-- kesimpulan itu hanya cadangan: begitu file ini dijalankan, kolomnya yang
-- berlaku dan nama boleh diubah tanpa mengubah artinya.
--
-- Jalankan sekali di Supabase SQL editor. Aman diulang.
-- =============================================

ALTER TABLE public.practice_locations
  ADD COLUMN IF NOT EXISTS kind text DEFAULT 'facility';

COMMENT ON COLUMN public.practice_locations.kind IS
  'facility = tempat fisik berakun (wajib punya kop); service = cara layanan seperti Home Care / Telemedicine (tanpa akun, tanpa kop).';

-- Baris lama: yang belum bertanda dianggap fasilitas, kecuali dua cara layanan
-- yang memang sudah ada sejak awal.
UPDATE public.practice_locations SET kind = 'facility' WHERE kind IS NULL;

UPDATE public.practice_locations
SET kind = 'service'
WHERE lower(regexp_replace(COALESCE(name, ''), '[^a-zA-Z0-9]+', ' ', 'g')) IN ('home care', 'telemedicine');

-- ---- Pemeriksa 1: akun apotek yang BELUM punya tempat praktik -------------
-- Aplikasi membuatkannya otomatis untuk akun baru, dan halaman "Tempat Praktik
-- & Kop" menyediakan tombol untuk akun lama. Query ini untuk memastikan tidak
-- ada yang tersisa.
SELECT p.name                                   AS apotek,
       COALESCE(l.name, '(BELUM ADA)')          AS tempat_praktik,
       CASE WHEN l.id IS NULL THEN 'buatkan tempat praktiknya'
            WHEN COALESCE(NULLIF(l.kop_name, ''), '') = '' THEN 'kop belum diisi — dokumennya berkop Klinik Prima'
            ELSE 'lengkap' END                  AS keadaan
FROM public.pharmacies p
LEFT JOIN public.practice_locations l ON l.id = p.location_id
ORDER BY (l.id IS NULL) DESC, p.name;

-- ---- Pemeriksa 2: tempat praktik & kelengkapan kop ------------------------
-- Cara layanan sengaja ditandai terpisah, bukan dihitung sebagai kekurangan.
SELECT l.name,
       l.kind,
       COALESCE(NULLIF(l.kop_name, ''), '(kosong)') AS kop,
       CASE WHEN l.kind = 'service' THEN 'dikecualikan — cara layanan'
            WHEN COALESCE(NULLIF(l.kop_name, ''), '') = '' THEN 'PERLU DIISI'
            ELSE 'lengkap' END                      AS keadaan,
       (SELECT count(*) FROM public.pharmacies p WHERE p.location_id = l.id) AS jumlah_akun
FROM public.practice_locations l
WHERE COALESCE(l.is_active, true)
ORDER BY (l.kind = 'service'), (COALESCE(NULLIF(l.kop_name, ''), '') = '') DESC, l.name;

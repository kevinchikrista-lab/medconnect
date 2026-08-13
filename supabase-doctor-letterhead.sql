-- =============================================
-- KOP RESEP PER DOKTER.
--
-- Seorang dokter mencetak resep dengan kop tempat dia berpraktik, dan tempat
-- itu tidak selalu klinik kita: dr. Kevin memakai kop Klinik Prima, dr. Niko
-- memakai kop Apotek Medika Raya. Sebelumnya kop resep dipaku ke Klinik Prima
-- (nama, logo, dan e-mailnya ditulis langsung di kode), sehingga resep dokter
-- mana pun tercetak seolah-olah dari klinik kita.
--
-- KOP MENUMPANG PADA MASTER LOKASI PRAKTIK yang sudah ada, bukan tabel baru.
-- Tempatnya memang sudah terdaftar di sana lengkap dengan alamat dan telepon;
-- yang kurang hanya identitas kop-nya (nama besar, sub-judul, e-mail, logo).
-- Membuat tabel kedua hanya akan memaksa nama tempat ditulis dua kali dan
-- membuka peluang keduanya berbeda.
--
-- TUJUAN RESEP TIDAK ADA HUBUNGANNYA DENGAN KOP. Resep dr. Kevin berkop
-- Klinik Prima tetap bisa dikirim ke apotek mana pun untuk ditebus — kop
-- menyatakan SIAPA YANG MENULIS, bukan ke mana resepnya pergi. Karena itu
-- tidak ada perubahan apa pun pada pemilihan apotek tujuan.
--
-- Jalankan sekali di Supabase SQL editor. Aman diulang.
-- =============================================

-- Identitas kop pada tiap tempat praktik. Semuanya boleh kosong: yang kosong
-- jatuh kembali ke identitas Klinik Prima, jadi tempat lama tidak berubah
-- tampilannya sampai kop-nya sengaja diisi.
ALTER TABLE public.practice_locations
  ADD COLUMN IF NOT EXISTS kop_name     text,   -- nama besar di kop, mis. 'APOTEK MEDIKA RAYA'
  ADD COLUMN IF NOT EXISTS kop_sub      text,   -- baris kecil di bawahnya, mis. '(Medika Raya)'
  ADD COLUMN IF NOT EXISTS kop_email    text,
  ADD COLUMN IF NOT EXISTS kop_logo_url text;   -- URL logo; kosong = tanpa logo

-- Kop bawaan seorang dokter. Kosong = ikut tempat praktik pada resepnya,
-- lalu ikut Klinik Prima bila tempat itu pun tidak punya identitas kop.
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS kop_location_id uuid;

CREATE INDEX IF NOT EXISTS idx_doctors_kop ON public.doctors (kop_location_id)
  WHERE kop_location_id IS NOT NULL;

SELECT d.full_name                                            AS dokter,
       COALESCE(l.name, '(ikut tempat praktik / Klinik Prima)') AS kop_dipakai,
       COALESCE(NULLIF(l.kop_name, ''), '(memakai identitas Klinik Prima)') AS nama_pada_kop,
       COALESCE(l.address, '')                                AS alamat_kop
FROM public.doctors d
LEFT JOIN public.practice_locations l ON l.id = d.kop_location_id
ORDER BY d.full_name;

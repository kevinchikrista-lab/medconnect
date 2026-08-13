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

-- ---- Tempat menyimpan logo kop -------------------------------------------
-- Bucket ini sengaja PUBLIK. Logo bukan rahasia, dan kop resep harus tetap
-- tampil saat lembarnya dicetak ulang bertahun kemudian — tautan bertanda
-- tangan (signed URL) kedaluwarsa dalam hitungan jam, jadi tidak cocok untuk
-- gambar yang tertanam di kertas resep.
INSERT INTO storage.buckets (id, name, public)
VALUES ('letterheads', 'letterheads', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Siapa pun boleh MEMBACA (itu maksudnya publik), tapi hanya pengguna yang
-- sudah masuk yang boleh mengunggah dan menghapus.
DROP POLICY IF EXISTS "letterheads read" ON storage.objects;
CREATE POLICY "letterheads read" ON storage.objects
  FOR SELECT USING (bucket_id = 'letterheads');

DROP POLICY IF EXISTS "letterheads insert" ON storage.objects;
CREATE POLICY "letterheads insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'letterheads' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "letterheads update" ON storage.objects;
CREATE POLICY "letterheads update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'letterheads' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "letterheads delete" ON storage.objects;
CREATE POLICY "letterheads delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'letterheads' AND auth.role() = 'authenticated');

-- SATU DOKTER BISA BERPRAKTIK DI LEBIH DARI SATU TEMPAT, jadi kop tidak bisa
-- ditetapkan sekali untuk selamanya. Karena itu ada dua hal berbeda:
--
--   doctors.practice_places : DAFTAR tempat dia berpraktik, BESERTA NOMOR SIP
--       di masing-masing tempat. Bentuknya
--       [{ "location_id": "...", "sip_number": "..." }, ...]
--       SIP memang diterbitkan per tempat praktik, jadi satu dokter yang
--       praktik di dua tempat punya dua nomor SIP yang berbeda — dan yang
--       tercetak harus SIP di tempat resep itu ditulis, bukan sembarang satu.
--   doctors.kop_location_id       : kop BAWAAN-nya — dipakai bila resep itu
--       tidak menyebut tempat mana pun. Boleh kosong.
--
-- Lalu yang paling menentukan ada di resepnya sendiri:
--   prescriptions.kop_location_id : kop yang DIPILIH untuk resep itu.
--
-- Dengan begitu dokter yang praktik di dua tempat cukup memilih kop saat
-- menulis resepnya, dan pilihannya menempel pada resep itu selamanya.
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS kop_location_id uuid,
  ADD COLUMN IF NOT EXISTS practice_places jsonb DEFAULT '[]'::jsonb;

UPDATE public.doctors SET practice_places = '[]'::jsonb WHERE practice_places IS NULL;

-- doctors.sip_number yang sudah ada TETAP DIPAKAI sebagai SIP utama: dipakai
-- bila tempat kop-nya tidak punya SIP tersendiri, dan untuk surat-surat lain
-- di luar resep. Jadi dokter yang hanya praktik di satu tempat tidak perlu
-- mengisi apa pun yang baru.

ALTER TABLE public.prescriptions
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

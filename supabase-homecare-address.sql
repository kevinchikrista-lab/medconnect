-- =============================================================================
-- ALAMAT HOME CARE + RIWAYAT ALAMAT PASIEN
--
-- Sebelumnya rekam medis kunjungan Home Care hanya mencatat "Lokasi/Tempat:
-- Home Care" -- tanpa menyebut ALAMAT rumah yang dikunjungi. Dokter yang
-- membuka rekam medis lama tidak tahu lagi pernah home care ke mana, dan
-- pasien yang alamatnya berbeda dari yang tercatat di profil (mis. rumah
-- orang tua, kos anak) tidak punya tempat untuk itu.
--
-- Dua hal ditambahkan:
--   1. medical_records.location_detail -- alamat spesifik untuk kunjungan
--      itu (dipakai untuk Home Care, tapi kolomnya generik). Ini yang
--      menjadi RIWAYAT "pernah home care ke mana" -- dibaca lewat rekam
--      medis kunjungan itu sendiri, bukan tabel terpisah.
--   2. patient_addresses -- alamat TAMBAHAN pasien (di luar patients.address
--      yang tetap jadi alamat utama/pertama). Begitu dokter mengetik alamat
--      home care yang BERBEDA dari alamat pasien yang sudah dikenal, alamat
--      itu otomatis tersimpan di sini sebagai alamat ke-2/ke-3/dst -- supaya
--      kunjungan berikutnya tinggal dipilih, bukan diketik ulang.
--
-- Jalankan sekali di Supabase SQL editor. Aman diulang. Tidak menghapus apa
-- pun.
-- =============================================================================

ALTER TABLE public.medical_records ADD COLUMN IF NOT EXISTS location_detail text;

COMMENT ON COLUMN public.medical_records.location_detail IS
  'Alamat/keterangan spesifik untuk kunjungan ini -- dipakai terutama saat location = Home Care, untuk mencatat alamat rumah yang dikunjungi.';

CREATE TABLE IF NOT EXISTS public.patient_addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.patient_addresses IS
  'Alamat TAMBAHAN pasien (di luar patients.address yang tetap alamat utama). Terisi otomatis saat dokter mencatat alamat Home Care yang berbeda dari alamat yang sudah dikenal.';

ALTER TABLE public.patient_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated full access patient_addresses" ON public.patient_addresses;
CREATE POLICY "Authenticated full access patient_addresses" ON public.patient_addresses
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_patient_addresses_patient ON public.patient_addresses(patient_id);

-- ---- Pemeriksa -------------------------------------------------------------
SELECT 'kolom' AS bagian, 'medical_records.location_detail' AS yang_diperiksa,
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_schema='public' AND table_name='medical_records' AND column_name='location_detail')
            THEN 'OK' ELSE 'BELUM' END AS keadaan
UNION ALL
SELECT 'tabel', 'patient_addresses',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables
                         WHERE table_schema='public' AND table_name='patient_addresses')
            THEN 'OK' ELSE 'BELUM' END;

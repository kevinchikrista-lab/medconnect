-- =============================================================================
-- PONDASI SATUSEHAT — FASE 1
--
-- Belum mengirim apa pun ke SATUSEHAT. Yang disiapkan di sini adalah tempat
-- untuk menyimpan hal-hal yang dituntut SATUSEHAT tapi belum punya kolomnya:
--
--   patients.ihs_number          nomor IHS pasien, hasil validasi NIK ke Dukcapil
--   doctors.nik                  NIK nakes — dari sinilah IHS Number nakes didapat
--   doctors.ihs_number           nomor IHS nakes
--   medical_records.diagnosis_code   kode ICD-10, TERPISAH dari kalimatnya
--   practice_locations.ihs_id    kode Location/Organization tiap tempat praktik
--   prescription_items.kfa_code  kode Kamus Farmasi dan Alat Kesehatan
--
-- KENAPA diagnosis_code PERLU KOLOM SENDIRI
--
-- Diagnosis selama ini disimpan sebagai satu teks: 'A09 - Diare'. Kodenya
-- masih bisa dipotong dari depan KALAU dokternya memilih dari kotak pencarian
-- — tapi hilang begitu ada yang menyunting kalimatnya, dan tidak pernah ada
-- sama sekali kalau diagnosisnya diketik dengan tangan.
--
-- Ini berguna walau SATUSEHAT batal: klaim BPJS dan rekap bulanan sama-sama
-- menuntut kodenya, bukan kalimatnya.
--
-- Jalankan sekali di Supabase SQL editor. Aman diulang. Tidak menghapus apa pun.
-- =============================================================================

ALTER TABLE public.patients            ADD COLUMN IF NOT EXISTS ihs_number     text;
ALTER TABLE public.doctors             ADD COLUMN IF NOT EXISTS nik            text;
ALTER TABLE public.doctors             ADD COLUMN IF NOT EXISTS ihs_number     text;
ALTER TABLE public.medical_records     ADD COLUMN IF NOT EXISTS diagnosis_code text;
ALTER TABLE public.prescription_items  ADD COLUMN IF NOT EXISTS kfa_code       text;

DO $do$
BEGIN
  IF to_regclass('public.practice_locations') IS NOT NULL THEN
    ALTER TABLE public.practice_locations ADD COLUMN IF NOT EXISTS ihs_id text;
  END IF;
END $do$;

COMMENT ON COLUMN public.medical_records.diagnosis_code IS
  'Kode ICD-10 murni (mis. A09, J06.9), terpisah dari kalimat diagnosisnya. Kosong berarti diagnosisnya diketik tangan dan belum diberi kode — bukan berarti tidak ada diagnosis.';
COMMENT ON COLUMN public.patients.ihs_number IS
  'Nomor IHS pasien dari SATUSEHAT. Diisi aplikasi sesudah NIK tervalidasi Dukcapil; jangan diisi tangan.';

-- ---------------------------------------------------------------------------
-- Mengisi diagnosis_code untuk baris LAMA yang kodenya masih menempel di depan
-- teks diagnosisnya.
--
-- Polanya sengaja ketat: satu huruf (bukan U, yang dipakai kode darurat WHO),
-- dua angka, boleh diikuti titik dan satu-dua angka. Diagnosis yang diketik
-- tangan TIDAK ditebak-tebak — kode diagnosis yang salah lebih berbahaya
-- daripada kode yang kosong, karena yang kosong kelihatan dan yang salah tidak.
-- ---------------------------------------------------------------------------
UPDATE public.medical_records
SET diagnosis_code = upper((regexp_match(btrim(diagnosis), '^([A-TV-Za-tv-z][0-9]{2}(?:\.[0-9]{1,2})?)'))[1])
WHERE (diagnosis_code IS NULL OR btrim(diagnosis_code) = '')
  AND diagnosis IS NOT NULL
  AND btrim(diagnosis) ~ '^[A-TV-Za-tv-z][0-9]{2}';

-- Pencarian pasien lewat NIK dipakai saat mencocokkan dengan SATUSEHAT.
CREATE INDEX IF NOT EXISTS idx_patients_ihs ON public.patients (ihs_number);

-- ---- Pemeriksa — satu perintah, semua bagian ikut tampil --------------------
SELECT 'kolom' AS bagian, c.tabel || '.' || c.kolom AS yang_diperiksa,
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns i
                         WHERE i.table_schema='public' AND i.table_name=c.tabel AND i.column_name=c.kolom)
            THEN 'OK' ELSE 'BELUM' END AS keadaan
FROM (VALUES
  ('patients','ihs_number'), ('doctors','nik'), ('doctors','ihs_number'),
  ('medical_records','diagnosis_code'), ('prescription_items','kfa_code'),
  ('practice_locations','ihs_id')
) AS c(tabel, kolom)

UNION ALL
SELECT 'diagnosis', 'sudah punya kode ICD-10',
       count(*)::text FROM public.medical_records
       WHERE diagnosis_code IS NOT NULL AND btrim(diagnosis_code) <> ''
UNION ALL
SELECT 'diagnosis', 'masih TANPA kode (diketik tangan)',
       count(*)::text FROM public.medical_records
       WHERE (diagnosis_code IS NULL OR btrim(diagnosis_code) = '')
         AND diagnosis IS NOT NULL AND btrim(diagnosis) <> ''
ORDER BY 1, 2;

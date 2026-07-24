-- =============================================
-- Surat Keterangan Dokter (SKD) — Sehat & Sakit
-- Reuses the existing certificates table + /verify QR system.
-- Run this once in the Supabase SQL editor.
-- =============================================

-- 1. Extend the certificates log so it can also hold doctor's letters (SKD),
--    not just vaccination certificates. Existing vaccine rows keep working:
--    cert_type defaults to 'vaccination', and the SKD-specific fields live in
--    the generic `details` JSONB.
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS cert_type   TEXT DEFAULT 'vaccination';
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS perihal     TEXT;   -- 'SEHAT' | 'SAKIT'
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS doctor_name TEXT;
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS details     JSONB;  -- rm, alamat, tgl lahir, hasil periksa, dsb.

-- 2. Sequential letter numbering, per (series, year) — so 'SKD' has its own
--    running number independent of vaccination ('SKV') certificates. Atomic
--    and safe under concurrent requests, same pattern as get_next_cert_number.
CREATE TABLE IF NOT EXISTS public.doc_sequence (
  series TEXT NOT NULL,
  year   INT  NOT NULL,
  last_number INT NOT NULL DEFAULT 0,
  PRIMARY KEY (series, year)
);

CREATE OR REPLACE FUNCTION public.get_next_doc_number(p_series TEXT, p_year INT)
RETURNS INT AS $$
DECLARE
  next_num INT;
BEGIN
  INSERT INTO public.doc_sequence (series, year, last_number)
  VALUES (p_series, p_year, 1)
  ON CONFLICT (series, year) DO UPDATE SET last_number = public.doc_sequence.last_number + 1
  RETURNING last_number INTO next_num;
  RETURN next_num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Store the clinic's medical-record number on the patient so it can be
--    printed on letters and remembered between visits.
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS rm_number TEXT;

SELECT 'Medical letter (SKD) tables/columns created successfully' as status;

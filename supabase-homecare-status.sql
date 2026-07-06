-- =============================================
-- MedConnect - Home Care Claims: status Selesai/Arsip
-- =============================================
-- Menambah status pada home_care_claims supaya SuperAdmin bisa menandai
-- klaim yang sudah ditagihkan & dibayarkan (di Vmedis) sebagai "selesai",
-- sehingga otomatis tersembunyi dari tampilan aktif (arsip), dengan opsi
-- membatalkan tanda tersebut kalau salah tekan.

ALTER TABLE public.home_care_claims
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'selesai'));

ALTER TABLE public.home_care_claims
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_home_care_claims_status ON public.home_care_claims(status);

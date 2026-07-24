-- =============================================
-- Hasil Penunjang: Laboratorium & Radiologi
-- Manual per-parameter + upload berkas (PDF/gambar).
-- Jalankan sekali di Supabase SQL editor.
-- =============================================

-- 1. Tabel hasil penunjang
CREATE TABLE IF NOT EXISTS public.lab_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
  record_id UUID REFERENCES public.medical_records(id) ON DELETE SET NULL,
  doctor_id UUID REFERENCES public.doctors(id),
  category TEXT DEFAULT 'lab',            -- 'lab' | 'radiologi'
  test_name TEXT,                         -- cth: "Darah Lengkap", "Rontgen Thorax"
  result_date DATE,
  parameters JSONB DEFAULT '[]',          -- [{name, value, unit, ref, flag}]
  interpretation TEXT,                    -- kesan/interpretasi (mis. narasi radiologi)
  file_path TEXT,                         -- path berkas di bucket 'lab-files'
  file_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.lab_results ENABLE ROW LEVEL SECURITY;

-- Catatan: kebijakan ini masih permisif (mengikuti pola tabel lain saat ini);
-- akan diperketat pada tahap perbaikan RLS.
CREATE POLICY "Authenticated full access lab_results" ON public.lab_results
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_lab_results_patient ON public.lab_results(patient_id);

-- 2. Bucket penyimpanan berkas (privat — diakses lewat signed URL)
INSERT INTO storage.buckets (id, name, public)
VALUES ('lab-files', 'lab-files', false)
ON CONFLICT (id) DO NOTHING;

-- Izinkan user terautentikasi meng-upload & membaca berkas di bucket ini.
DROP POLICY IF EXISTS "lab-files read" ON storage.objects;
CREATE POLICY "lab-files read" ON storage.objects
  FOR SELECT USING (bucket_id = 'lab-files' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "lab-files insert" ON storage.objects;
CREATE POLICY "lab-files insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'lab-files' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "lab-files delete" ON storage.objects;
CREATE POLICY "lab-files delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'lab-files' AND auth.role() = 'authenticated');

SELECT 'lab_results table + lab-files bucket created successfully' as status;

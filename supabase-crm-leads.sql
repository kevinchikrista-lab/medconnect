-- =============================================
-- CRM — tabel LEADS (calon pasien / prospek) + pipeline.
-- Hanya STAF (non-pasien) yang boleh melihat & mengelola.
-- Prasyarat: fungsi public.is_staff() sudah ada (dari RLS Fase B).
-- Jalankan sekali di Supabase SQL editor.
-- =============================================

CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  full_name text NOT NULL,
  phone text,
  source text,                 -- WhatsApp / Instagram / Referral / Walk-in / Iklan / dll
  interest text,               -- layanan yang diminati
  stage text DEFAULT 'baru',   -- baru|dihubungi|nurture|tertarik|booking|datang|pasien|batal
  notes text,
  next_followup date,
  pic_profile_id uuid,         -- PIC (staf penanggung jawab)
  wa_count int DEFAULT 0,
  wa_last_at timestamptz,
  converted_patient_id uuid,   -- terisi saat lead dijadikan pasien
  created_by uuid
);

CREATE INDEX IF NOT EXISTS idx_leads_stage ON public.leads(stage);
CREATE INDEX IF NOT EXISTS idx_leads_created ON public.leads(created_at DESC);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Hanya staf yang boleh baca & kelola.
DROP POLICY IF EXISTS "staff_all" ON public.leads;
CREATE POLICY "staff_all" ON public.leads
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

SELECT 'Tabel leads (CRM) siap' as status;

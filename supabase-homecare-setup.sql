-- =============================================
-- MedConnect - Home Care BMHP & Jasa Claims
-- =============================================
-- Kalkulasi cepat dokter/superadmin untuk BMHP (bahan medis habis pakai)
-- dan jasa yang terpakai saat kunjungan home care. Harga item diambil live
-- dari Google Sheet (lihat js/config.js), record klaim ini menyimpan
-- snapshot nama/harga saat submit supaya histori tidak berubah kalau
-- harga di sheet diedit belakangan.

-- =============================================
-- 1. HOME CARE CLAIMS (header)
-- =============================================
CREATE TABLE IF NOT EXISTS public.home_care_claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id UUID REFERENCES public.doctors(id),
  created_by UUID REFERENCES public.profiles(id),
  patient_id UUID REFERENCES public.patients(id),
  patient_name TEXT,
  visit_date DATE DEFAULT CURRENT_DATE,
  total_bmhp INTEGER DEFAULT 0,
  total_jasa INTEGER DEFAULT 0,
  total_amount INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 2. HOME CARE CLAIM ITEMS (detail, snapshot harga)
-- =============================================
CREATE TABLE IF NOT EXISTS public.home_care_claim_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  claim_id UUID REFERENCES public.home_care_claims(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('BMHP', 'Jasa')),
  item_name TEXT NOT NULL,
  unit TEXT,
  unit_price INTEGER DEFAULT 0,
  quantity NUMERIC DEFAULT 1,
  subtotal INTEGER DEFAULT 0
);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
ALTER TABLE public.home_care_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.home_care_claim_items ENABLE ROW LEVEL SECURITY;

-- Sama seperti tabel lain di supabase-setup.sql: full access untuk MVP,
-- role-based refinement bisa ditambahkan belakangan.
CREATE POLICY "Authenticated full access home_care_claims" ON public.home_care_claims
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access home_care_claim_items" ON public.home_care_claim_items
  FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_home_care_claims_doctor ON public.home_care_claims(doctor_id);
CREATE INDEX IF NOT EXISTS idx_home_care_claims_patient ON public.home_care_claims(patient_id);
CREATE INDEX IF NOT EXISTS idx_home_care_claims_visit_date ON public.home_care_claims(visit_date);
CREATE INDEX IF NOT EXISTS idx_home_care_claim_items_claim ON public.home_care_claim_items(claim_id);

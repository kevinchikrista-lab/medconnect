-- =============================================
-- Stok Opening harian (import Excel dari vmedis).
-- Hanya SUPER ADMIN / OWNER yang boleh upload & melihat.
-- Prasyarat: RLS Fase B sudah diterapkan (tabel profiles memakai auth_id).
-- Jalankan sekali di Supabase SQL editor.
-- =============================================

CREATE TABLE IF NOT EXISTS public.stock_openings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  opening_date date NOT NULL,
  filename text,
  uploaded_by uuid,
  columns jsonb,          -- daftar nama kolom Excel
  rows jsonb,             -- isi baris {kolom: nilai}
  name_col text,          -- kolom nama barang
  stock_col text,         -- kolom jumlah stok
  low_threshold int DEFAULT 10,
  item_count int DEFAULT 0,
  low_count int DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_stock_openings_date ON public.stock_openings(opening_date DESC);

ALTER TABLE public.stock_openings ENABLE ROW LEVEL SECURITY;

-- Hanya owner / superadmin.
DROP POLICY IF EXISTS "superadmin_all" ON public.stock_openings;
CREATE POLICY "superadmin_all" ON public.stock_openings
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role IN ('superadmin','owner')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role IN ('superadmin','owner')));

SELECT 'Tabel stock_openings siap' as status;

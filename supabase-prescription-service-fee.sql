-- =============================================
-- E-Resep: kolom opsional "Jasa Dokter" (jasa peresepan) yang bisa ditarik
-- apotek dari pasien saat pengambilan obat.
-- Jalankan sekali di Supabase SQL editor.
-- =============================================

ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS service_fee_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS service_fee INTEGER DEFAULT 0;

SELECT 'Kolom jasa dokter pada e-resep siap' as status;

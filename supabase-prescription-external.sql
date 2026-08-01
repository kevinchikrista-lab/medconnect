-- =============================================
-- E-Resep: mode "Resep Luar".
-- rx_target = 'apotek' (default, dikirim ke apotek mitra)
--           | 'luar'   (pasien menebus di apotek lain; hanya dicatat & dicetak)
-- Jalankan sekali di Supabase SQL editor (proyek MedConnect).
-- =============================================

ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS rx_target TEXT DEFAULT 'apotek';

SELECT 'Kolom rx_target (Resep Luar) siap' as status;

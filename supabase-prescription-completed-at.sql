-- =============================================
-- Adds completed_at to prescriptions so the pharmacy dashboard's
-- "Selesai Hari Ini" stat can filter by when a prescription actually
-- finished. It previously had no such column and the stat filtered by
-- status alone, so it counted every prescription ever marked completed
-- regardless of date.
-- =============================================

ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

SELECT 'prescriptions.completed_at added successfully' as status;

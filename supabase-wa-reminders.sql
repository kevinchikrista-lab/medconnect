-- =============================================
-- Pelacakan pengingat WhatsApp (Tahap 1)
-- Mencatat berapa kali & kapan terakhir sebuah jadwal diingatkan via WA.
-- Jalankan sekali di Supabase SQL editor.
-- =============================================

ALTER TABLE public.appointments    ADD COLUMN IF NOT EXISTS wa_reminder_count INT DEFAULT 0;
ALTER TABLE public.appointments    ADD COLUMN IF NOT EXISTS wa_last_sent_at   TIMESTAMPTZ;

ALTER TABLE public.medical_records ADD COLUMN IF NOT EXISTS wa_reminder_count INT DEFAULT 0;
ALTER TABLE public.medical_records ADD COLUMN IF NOT EXISTS wa_last_sent_at   TIMESTAMPTZ;

SELECT 'WA reminder tracking columns added successfully' as status;

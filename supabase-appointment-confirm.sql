-- =============================================
-- Konfirmasi kehadiran pasien via link WA (Tahap 2)
-- Pasien membuka link publik lalu memilih "Ya datang" / "Minta ganti hari".
-- Jalankan sekali di Supabase SQL editor.
-- =============================================

-- Kolom respons pasien pada appointment
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS patient_response    TEXT;        -- 'confirmed' | 'reschedule'
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS patient_response_at TIMESTAMPTZ;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS proposed_date       DATE;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS proposed_time       TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS response_note       TEXT;

-- Baca info terbatas untuk halaman konfirmasi publik (tanpa login).
-- SECURITY DEFINER + hanya kolom yang perlu, diakses lewat UUID yang sulit ditebak.
CREATE OR REPLACE FUNCTION public.get_appointment_for_confirm(p_id UUID)
RETURNS TABLE (
  id UUID, date DATE, time_slot TEXT, type TEXT, status TEXT,
  patient_name TEXT, doctor_name TEXT,
  patient_response TEXT, proposed_date DATE, proposed_time TEXT
) AS $$
  SELECT a.id, a.date, a.time_slot, a.type, a.status,
         COALESCE(p.full_name, '') AS patient_name,
         COALESCE(d.full_name, '') AS doctor_name,
         a.patient_response, a.proposed_date, a.proposed_time
  FROM public.appointments a
  LEFT JOIN public.patients p ON p.id = a.patient_id
  LEFT JOIN public.doctors  d ON d.id = a.doctor_id
  WHERE a.id = p_id;
$$ LANGUAGE sql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_appointment_for_confirm(UUID) TO anon, authenticated;

-- Simpan respons pasien (hadir / minta ganti hari).
CREATE OR REPLACE FUNCTION public.submit_appointment_response(
  p_id UUID, p_response TEXT, p_date DATE, p_time TEXT, p_note TEXT
) RETURNS TEXT AS $$
BEGIN
  UPDATE public.appointments
     SET patient_response    = p_response,
         patient_response_at = now(),
         proposed_date       = p_date,
         proposed_time       = p_time,
         response_note       = p_note
   WHERE id = p_id;
  RETURN 'ok';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.submit_appointment_response(UUID, TEXT, DATE, TEXT, TEXT) TO anon, authenticated;

SELECT 'Appointment confirmation columns + functions created successfully' as status;

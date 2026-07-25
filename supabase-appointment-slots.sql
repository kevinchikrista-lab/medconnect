-- =============================================
-- Tahap 3: pilih slot jam tersedia + setujui usulan ganti hari
-- Jalankan sekali di Supabase SQL editor (setelah Tahap 2).
-- =============================================

-- Tambahkan doctor_id ke fungsi konfirmasi (perlu untuk cek slot per dokter).
-- Mengubah kolom keluaran fungsi harus DROP dulu.
DROP FUNCTION IF EXISTS public.get_appointment_for_confirm(UUID);
CREATE OR REPLACE FUNCTION public.get_appointment_for_confirm(p_id UUID)
RETURNS TABLE (
  id UUID, date DATE, time_slot TEXT, type TEXT, status TEXT, doctor_id UUID,
  patient_name TEXT, doctor_name TEXT,
  patient_response TEXT, proposed_date DATE, proposed_time TEXT
) AS $$
  SELECT a.id, a.date, a.time_slot, a.type, a.status, a.doctor_id,
         COALESCE(p.full_name, '') AS patient_name,
         COALESCE(d.full_name, '') AS doctor_name,
         a.patient_response, a.proposed_date, a.proposed_time
  FROM public.appointments a
  LEFT JOIN public.patients p ON p.id = a.patient_id
  LEFT JOIN public.doctors  d ON d.id = a.doctor_id
  WHERE a.id = p_id;
$$ LANGUAGE sql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_appointment_for_confirm(UUID) TO anon, authenticated;

-- Jam yang sudah terisi untuk dokter+tanggal tertentu (untuk menandai slot penuh).
CREATE OR REPLACE FUNCTION public.get_taken_slots(p_doctor_id UUID, p_date DATE)
RETURNS TABLE (time_slot TEXT) AS $$
  SELECT a.time_slot
  FROM public.appointments a
  WHERE a.doctor_id = p_doctor_id
    AND a.date = p_date
    AND a.time_slot IS NOT NULL
    AND COALESCE(a.status, '') <> 'cancelled';
$$ LANGUAGE sql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_taken_slots(UUID, DATE) TO anon, authenticated;

SELECT 'Tahap 3 (slots) functions ready' as status;

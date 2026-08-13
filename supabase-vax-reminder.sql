-- =============================================
-- JEJAK PENGINGAT PADA CATATAN VAKSINASI.
--
-- supabase-wa-reminders.sql sudah memasang wa_reminder_count & wa_last_sent_at
-- pada appointments dan medical_records, tapi TIDAK pada vaccinations —
-- karena saat itu belum ada layar yang mengingatkan dosis berikutnya.
--
-- Sekarang ada (halaman "Pengingat Kontrol"), dan jejaknya dibutuhkan justru
-- untuk vaksin: yang sudah tiga kali dihubungi tapi tetap tidak datang
-- keadaannya berbeda dari yang belum pernah dihubungi sama sekali, dan
-- bedanya menentukan apa yang dilakukan berikutnya. Tanpa hitungan ini,
-- keduanya terlihat sama di layar.
--
-- Untuk vaksin berseri akibat terlewatnya paling nyata: dosis kedua yang
-- tidak dikejar membuat seluruh serinya tidak selesai — pasiennya sudah
-- membayar dosis pertama tapi tetap tidak terlindungi.
--
-- Jalankan sekali di Supabase SQL editor. Aman diulang.
-- =============================================

ALTER TABLE public.vaccinations
  ADD COLUMN IF NOT EXISTS wa_reminder_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wa_last_sent_at   TIMESTAMPTZ;

UPDATE public.vaccinations SET wa_reminder_count = 0 WHERE wa_reminder_count IS NULL;

COMMENT ON COLUMN public.vaccinations.wa_reminder_count IS
  'Berapa kali pasien sudah diingatkan lewat WhatsApp untuk dosis berikutnya.';

-- Daftar kerja "yang jatuh tempo", diambil per rentang tanggal.
CREATE INDEX IF NOT EXISTS idx_vaccinations_next_dose
  ON public.vaccinations (next_dose_date)
  WHERE next_dose_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_medical_records_follow_up
  ON public.medical_records (follow_up_date)
  WHERE follow_up_date IS NOT NULL;

-- ---- Pemeriksa: siapa yang jatuh tempo, dan sudah berapa kali dikejar -----
-- Dosis yang SUDAH TELANJUR DIBERIKAN tidak ikut: ada baris vaksinasi lain,
-- vaksin yang sama, yang diberikan pada atau sesudah tanggal jatuh temponya.
SELECT p.full_name                                  AS pasien,
       COALESCE(NULLIF(p.phone, ''), '(tanpa HP)')  AS no_hp,
       v.vaccine_name,
       v.next_dose_date                             AS jatuh_tempo,
       (CURRENT_DATE - v.next_dose_date)            AS terlewat_hari,
       COALESCE(v.wa_reminder_count, 0)             AS sudah_diingatkan
FROM public.vaccinations v
JOIN public.patients p ON p.id = v.patient_id
WHERE v.next_dose_date IS NOT NULL
  AND COALESCE(v.approval_status, 'approved') = 'approved'
  AND NOT EXISTS (
    SELECT 1 FROM public.vaccinations x
    WHERE x.id <> v.id
      AND x.patient_id = v.patient_id
      AND lower(x.vaccine_name) = lower(v.vaccine_name)
      AND x.date_given >= v.next_dose_date
  )
ORDER BY v.next_dose_date;

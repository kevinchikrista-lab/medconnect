-- =============================================================================
-- JENIS KUNJUNGAN: BPJS ATAU UMUM
--
-- Ditentukan ADMIN saat mendaftarkan kedatangan pasien -- SEBELUM dokter
-- memeriksa. Bukan dokter yang memilih ini; dokter cuma membacanya.
--
-- patient_checkins menyimpan pendaftaran kedatangan hari itu. Begitu dokter
-- membuat rekam medis (kunjungan) untuk pasien yang sama pada tanggal yang
-- sama, jenis kunjungannya ikut disalin ke rekam medisnya
-- (medical_records.payment_type) -- supaya tersimpan permanen bersama
-- kunjungannya, bukan cuma di catatan pendaftaran hari itu yang bisa
-- terhapus/terlupa.
--
-- medical_record_id diisi begitu rekam medisnya jadi -- itulah yang
-- membedakan "sudah ditangani dokter" dari "masih menunggu" di layar admin.
--
-- Jalankan SESUDAH supabase-rm-akses-dokter.sql (butuh fungsi is_rm_manager
-- dan is_doctor dari situ). Jalankan sekali di Supabase SQL editor. Aman
-- diulang. Tidak menghapus apa pun.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.patient_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  visit_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_type text NOT NULL CHECK (payment_type IN ('bpjs', 'umum')),
  doctor_id uuid REFERENCES public.doctors(id),
  medical_record_id uuid,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- TTV sederhana yang diambil sebelum pasien masuk ke dokter (mis. oleh
-- perawat/admin di depan) -- td = tekanan darah, ikut konvensi nama yang
-- sudah dipakai di medical_records.vital_signs. Kolom teks, bukan angka:
-- "120/80" bukan angka tunggal, dan nilai kosong berarti belum diukur.
ALTER TABLE public.patient_checkins ADD COLUMN IF NOT EXISTS td text;
ALTER TABLE public.patient_checkins ADD COLUMN IF NOT EXISTS nadi text;
ALTER TABLE public.patient_checkins ADD COLUMN IF NOT EXISTS suhu text;

CREATE INDEX IF NOT EXISTS idx_checkins_patient_date ON public.patient_checkins (patient_id, visit_date);
CREATE INDEX IF NOT EXISTS idx_checkins_visit_date ON public.patient_checkins (visit_date);

ALTER TABLE public.medical_records ADD COLUMN IF NOT EXISTS payment_type text;

COMMENT ON COLUMN public.medical_records.payment_type IS
  'BPJS atau Umum, disalin dari patient_checkins saat rekam medisnya dibuat oleh dokter. Kosong berarti rekam medis dibuat tanpa pendaftaran kedatangan lebih dulu (jalur lama / data sebelum fitur ini ada) -- bukan berarti Umum.';

ALTER TABLE public.patient_checkins ENABLE ROW LEVEL SECURITY;

-- Admin/pemilik klinik penuh -- mereka yang mendaftarkan kedatangan dan
-- boleh membatalkannya.
DROP POLICY IF EXISTS "checkins_admin_penuh" ON public.patient_checkins;
CREATE POLICY "checkins_admin_penuh" ON public.patient_checkins
  FOR ALL TO authenticated
  USING (public.is_rm_manager()) WITH CHECK (public.is_rm_manager());

-- Dokter cuma boleh MEMBACA -- supaya tahu jenis kunjungan pasiennya saat
-- memeriksa, tapi tidak bisa mengubah keputusan admin secara diam-diam.
DROP POLICY IF EXISTS "checkins_dokter_baca" ON public.patient_checkins;
CREATE POLICY "checkins_dokter_baca" ON public.patient_checkins
  FOR SELECT TO authenticated
  USING (public.is_doctor());

-- Dokter tetap perlu MENGUBAH satu kolom saat rekam medisnya jadi:
-- medical_record_id, supaya layar admin tahu kedatangan ini sudah ditangani.
-- Dibatasi lewat fungsi supaya dokter tidak bisa mengubah kolom lain
-- (payment_type, patient_id, dst) lewat jalur ini.
CREATE OR REPLACE FUNCTION public.tandai_checkin_selesai(p_checkin_id uuid, p_record_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NOT (public.is_doctor() OR public.is_rm_manager()) THEN
    RAISE EXCEPTION 'Tidak diizinkan';
  END IF;
  UPDATE public.patient_checkins SET medical_record_id = p_record_id WHERE id = p_checkin_id;
END;
$fn$;

-- ---- Pemeriksa — satu perintah, semua bagian ikut tampil -------------------
SELECT 'tabel' AS bagian, 'patient_checkins' AS yang_diperiksa,
       CASE WHEN to_regclass('public.patient_checkins') IS NOT NULL THEN 'OK' ELSE 'BELUM' END AS keadaan

UNION ALL
SELECT 'kolom', 'medical_records.payment_type',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_schema='public' AND table_name='medical_records' AND column_name='payment_type')
            THEN 'OK' ELSE 'BELUM' END

UNION ALL
SELECT 'kolom', 'patient_checkins.' || c,
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_schema='public' AND table_name='patient_checkins' AND column_name=c)
            THEN 'OK' ELSE 'BELUM' END
FROM unnest(ARRAY['td','nadi','suhu']) AS c

UNION ALL
SELECT 'kebijakan', tablename || ' / ' || policyname, 'ada'
FROM pg_policies WHERE schemaname='public' AND tablename='patient_checkins'

UNION ALL
SELECT 'fungsi', 'tandai_checkin_selesai',
       CASE WHEN EXISTS (SELECT 1 FROM pg_proc
                         WHERE pronamespace='public'::regnamespace AND proname='tandai_checkin_selesai')
            THEN 'OK' ELSE 'BELUM' END

UNION ALL
SELECT 'penolong (dari supabase-rm-akses-dokter.sql)', f,
       CASE WHEN EXISTS (SELECT 1 FROM pg_proc
                         WHERE pronamespace='public'::regnamespace AND proname=f)
            THEN 'OK — sudah dijalankan' ELSE 'BELUM — jalankan supabase-rm-akses-dokter.sql dulu' END
FROM unnest(ARRAY['is_doctor','is_rm_manager']) AS f
ORDER BY 1, 2;

-- =============================================
-- ROLLBACK RLS Fase A — kembalikan ke kondisi semula (akses terbuka).
-- Jalankan HANYA bila Fase A menyebabkan masalah dan Anda ingin kembali.
-- Ini memasang kembali kebijakan permisif "FOR ALL USING (true)" seperti awal.
-- =============================================

DO $$
DECLARE t TEXT; r RECORD;
  tables TEXT[] := ARRAY[
    'profiles','patients','doctors','pharmacies','medical_records','prescriptions',
    'prescription_items','appointments','vaccinations','notifications','inventory',
    'home_care_claims','home_care_claim_items','consultations','consultation_messages',
    'lab_results','health_services','bookings','articles','certificates'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.'||t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, t);
    END LOOP;
    EXECUTE format('CREATE POLICY "open_all" ON public.%I FOR ALL USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

-- Kembalikan juga kebijakan publik yang khusus (agar sama seperti file setup).
DROP POLICY IF EXISTS "open_all" ON public.health_services;
CREATE POLICY "Public can view active services" ON public.health_services FOR SELECT USING (is_active = true);
CREATE POLICY "Authenticated full access health_services_all" ON public.health_services FOR ALL USING (true) WITH CHECK (true);

SELECT 'RLS Fase A rolled back — kembali ke akses terbuka' as status;

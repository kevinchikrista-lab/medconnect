-- =============================================
-- Sequential certificate numbering (resets yearly) + certificate log
-- =============================================

-- Tracks the last issued number per year
CREATE TABLE IF NOT EXISTS public.cert_sequence (
  year INT PRIMARY KEY,
  last_number INT NOT NULL DEFAULT 0
);

-- Atomic "get next number" function — safe under concurrent requests
CREATE OR REPLACE FUNCTION public.get_next_cert_number(p_year INT)
RETURNS INT AS $$
DECLARE
  next_num INT;
BEGIN
  INSERT INTO public.cert_sequence (year, last_number)
  VALUES (p_year, 1)
  ON CONFLICT (year) DO UPDATE SET last_number = public.cert_sequence.last_number + 1
  RETURNING last_number INTO next_num;
  RETURN next_num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Issued certificates log — used for QR verification lookups
CREATE TABLE IF NOT EXISTS public.certificates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cert_number TEXT NOT NULL,
  patient_id UUID,
  patient_name TEXT,
  vaccine_name TEXT,
  vaccine_brand TEXT,
  dose_info JSONB,
  issued_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous scanners of the QR code) can look up a certificate to verify it
CREATE POLICY "Public can view certificates for verification" ON public.certificates
  FOR SELECT USING (true);

-- App can insert new certificate records when one is issued
CREATE POLICY "Anyone can insert certificates" ON public.certificates
  FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_certificates_cert_number ON public.certificates(cert_number);

SELECT 'Certificate numbering + verification tables created successfully' as status;

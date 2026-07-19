-- =============================================
-- Sequential prescription (e-resep) numbering, resets yearly.
-- Mirrors get_next_cert_number in supabase-certificates.sql: rx_number was
-- previously computed client-side as `local prescriptions array length + 1`,
-- which collides with existing rows whenever the browser's local cache
-- doesn't hold every prescription ever created (e.g. after a failed insert,
-- or simply because another doctor/device created one) - "duplicate key
-- value violates unique constraint prescriptions_rx_number_key".
-- =============================================

CREATE TABLE IF NOT EXISTS public.rx_sequence (
  year INT PRIMARY KEY,
  last_number INT NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION public.get_next_rx_number(p_year INT)
RETURNS INT AS $$
DECLARE
  next_num INT;
BEGIN
  INSERT INTO public.rx_sequence (year, last_number)
  VALUES (p_year, 1)
  ON CONFLICT (year) DO UPDATE SET last_number = public.rx_sequence.last_number + 1
  RETURNING last_number INTO next_num;
  RETURN next_num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Seed the counter from whatever the highest existing rx_number already is,
-- so newly issued numbers continue after the real data instead of
-- restarting from 1 and immediately colliding again.
INSERT INTO public.rx_sequence (year, last_number)
SELECT EXTRACT(YEAR FROM created_at)::INT, MAX(split_part(rx_number, '-', 3)::INT)
FROM public.prescriptions
WHERE rx_number ~ '^R-\d{4}-\d+$'
GROUP BY EXTRACT(YEAR FROM created_at)::INT
ON CONFLICT (year) DO UPDATE SET last_number = GREATEST(public.rx_sequence.last_number, EXCLUDED.last_number);

SELECT 'Prescription numbering sequence created successfully' as status;

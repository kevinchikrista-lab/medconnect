-- Link auth users ke profiles berdasarkan email
UPDATE public.profiles
SET auth_id = (SELECT id FROM auth.users WHERE email = profiles.email)
WHERE auth_id IS NULL;

-- Verify
SELECT p.email, p.role, p.auth_id IS NOT NULL as linked
FROM public.profiles p
ORDER BY p.role, p.email;

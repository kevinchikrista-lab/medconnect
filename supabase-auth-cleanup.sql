-- =============================================
-- Cleanup: hapus auth users yang dibuat manual
-- (agar bisa dibuat ulang via API)
-- =============================================

-- Hapus identities dulu (FK constraint)
DELETE FROM auth.identities
WHERE user_id IN (
  SELECT au.id FROM auth.users au
  JOIN public.profiles p ON p.auth_id = au.id
);

-- Hapus auth users
DELETE FROM auth.users
WHERE id IN (
  SELECT auth_id FROM public.profiles WHERE auth_id IS NOT NULL
);

-- Reset auth_id di profiles
UPDATE public.profiles SET auth_id = NULL;

-- Verify: semua auth_id harus NULL
SELECT email, role, auth_id FROM public.profiles ORDER BY role;

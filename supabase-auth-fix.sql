-- =============================================
-- FIX: Recreate identities (email is generated column)
-- =============================================

-- Delete existing broken identities
DELETE FROM auth.identities
WHERE user_id IN (
  SELECT au.id FROM auth.users au
  JOIN public.profiles p ON p.auth_id = au.id
);

-- Recreate without email column (it auto-generates from identity_data)
INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
SELECT
  gen_random_uuid(),
  au.id,
  jsonb_build_object('sub', au.id::text, 'email', au.email, 'email_verified', true),
  'email',
  au.id::text,
  now(), now(), now()
FROM auth.users au
JOIN public.profiles p ON p.auth_id = au.id;

-- Verify
SELECT au.email, p.role, ai.email as identity_email, 'OK' as status
FROM auth.users au
JOIN public.profiles p ON p.auth_id = au.id
JOIN auth.identities ai ON ai.user_id = au.id
ORDER BY p.role, au.email;

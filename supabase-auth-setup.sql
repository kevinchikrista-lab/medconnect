-- =============================================
-- MedConnect: Create Auth Users
-- Jalankan di SQL Editor Supabase
-- =============================================

-- Fungsi helper untuk membuat user di auth.users + link ke profiles
CREATE OR REPLACE FUNCTION create_medconnect_user(
  p_email TEXT,
  p_password TEXT,
  p_profile_id UUID
) RETURNS void AS $$
DECLARE
  new_user_id UUID;
BEGIN
  -- Insert into auth.users with hashed password
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    aud, role, confirmation_token
  ) VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    'authenticated',
    'authenticated',
    ''
  )
  ON CONFLICT (email) DO NOTHING
  RETURNING id INTO new_user_id;

  -- Link auth user to profile
  IF new_user_id IS NOT NULL THEN
    UPDATE public.profiles SET auth_id = new_user_id WHERE id = p_profile_id;
  ELSE
    -- User already exists, get existing id and link
    SELECT id INTO new_user_id FROM auth.users WHERE email = p_email;
    UPDATE public.profiles SET auth_id = new_user_id WHERE id = p_profile_id;
  END IF;

  -- Create identity record (required for Supabase Auth login)
  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    new_user_id,
    jsonb_build_object('sub', new_user_id::text, 'email', p_email),
    'email',
    new_user_id::text,
    now(), now(), now()
  )
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- Create all demo users
-- Password akan di-hash otomatis oleh bcrypt
-- =============================================

SELECT create_medconnect_user('superadmin@prima.id',  'admin12345',  '00000000-0000-0000-0000-000000000001');
SELECT create_medconnect_user('dr.kevin@prima.id',    'dokter123',   '00000000-0000-0000-0000-000000000002');
SELECT create_medconnect_user('dr.sarah@prima.id',    'dokter123',   '00000000-0000-0000-0000-000000000003');
SELECT create_medconnect_user('budi@email.com',       'pasien123',   '00000000-0000-0000-0000-000000000004');
SELECT create_medconnect_user('sari@email.com',       'pasien123',   '00000000-0000-0000-0000-000000000005');
SELECT create_medconnect_user('rina@email.com',       'pasien123',   '00000000-0000-0000-0000-000000000006');
SELECT create_medconnect_user('ahmad@email.com',      'pasien123',   '00000000-0000-0000-0000-000000000007');
SELECT create_medconnect_user('maya@email.com',       'pasien123',   '00000000-0000-0000-0000-000000000008');
SELECT create_medconnect_user('apotek@sehatfarma.com','apotek123',   '00000000-0000-0000-0000-000000000009');
SELECT create_medconnect_user('apotek@medikafarma.com','apotek123',  '00000000-0000-0000-0000-000000000010');

-- Cleanup: drop helper function
DROP FUNCTION IF EXISTS create_medconnect_user;

-- Verify
SELECT u.email, p.role, p.auth_id IS NOT NULL as has_auth
FROM public.profiles p
LEFT JOIN auth.users u ON u.id = p.auth_id
ORDER BY p.role, u.email;

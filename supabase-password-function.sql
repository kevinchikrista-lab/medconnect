-- =============================================
-- Function: Reset password user (dipanggil dari admin panel)
-- SECURITY DEFINER = berjalan dengan privilege database owner
-- sehingga bisa update auth.users
-- =============================================

CREATE OR REPLACE FUNCTION public.admin_reset_password(
  target_email TEXT,
  new_password TEXT
) RETURNS JSON AS $$
DECLARE
  target_user_id UUID;
BEGIN
  -- Cari user di auth.users
  SELECT id INTO target_user_id FROM auth.users WHERE email = target_email;

  IF target_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User tidak ditemukan');
  END IF;

  -- Update password (hash dengan bcrypt)
  UPDATE auth.users
  SET encrypted_password = crypt(new_password, gen_salt('bf')),
      updated_at = now()
  WHERE id = target_user_id;

  RETURN json_build_object('success', true, 'message', 'Password berhasil diubah');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify function exists
SELECT 'Function admin_reset_password created successfully' as status;

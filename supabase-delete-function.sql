-- =============================================
-- Function: Delete auth user (dipanggil dari admin panel)
-- =============================================

CREATE OR REPLACE FUNCTION public.admin_delete_user(
  target_email TEXT
) RETURNS JSON AS $$
DECLARE
  target_user_id UUID;
BEGIN
  SELECT id INTO target_user_id FROM auth.users WHERE email = target_email;

  IF target_user_id IS NULL THEN
    RETURN json_build_object('success', true, 'message', 'User tidak ada di auth');
  END IF;

  -- Hapus identities
  DELETE FROM auth.identities WHERE user_id = target_user_id;

  -- Hapus sessions
  DELETE FROM auth.sessions WHERE user_id = target_user_id;

  -- Hapus refresh tokens
  DELETE FROM auth.refresh_tokens WHERE user_id = target_user_id;

  -- Hapus auth user
  DELETE FROM auth.users WHERE id = target_user_id;

  RETURN json_build_object('success', true, 'message', 'Auth user berhasil dihapus');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'Function admin_delete_user created successfully' as status;

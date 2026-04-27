-- Function to diagnose which signup fields are already taken / invalid.
-- Returns booleans only — never exposes other users' data.
CREATE OR REPLACE FUNCTION public.check_signup_availability(
  _email text DEFAULT NULL,
  _handle text DEFAULT NULL,
  _username text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_handle text;
  v_username text;
  v_email_taken boolean := false;
  v_handle_taken boolean := false;
  v_username_taken boolean := false;
BEGIN
  v_email := lower(trim(coalesce(_email, '')));
  v_handle := lower(trim(coalesce(_handle, '')));
  v_username := trim(coalesce(_username, ''));

  IF v_email <> '' THEN
    SELECT EXISTS (
      SELECT 1 FROM auth.users u WHERE lower(u.email) = v_email
    ) INTO v_email_taken;
  END IF;

  IF v_handle <> '' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.profiles p WHERE lower(p.handle) = v_handle
    ) INTO v_handle_taken;
  END IF;

  IF v_username <> '' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.username = v_username
    ) INTO v_username_taken;
  END IF;

  RETURN jsonb_build_object(
    'email_taken', v_email_taken,
    'handle_taken', v_handle_taken,
    'username_taken', v_username_taken
  );
END;
$$;

-- Allow anonymous and authenticated users to call the function (it returns no PII)
REVOKE ALL ON FUNCTION public.check_signup_availability(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_signup_availability(text, text, text) TO anon, authenticated;
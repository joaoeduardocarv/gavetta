-- 1. Remove unique constraint on username (names can be duplicated)
DROP INDEX IF EXISTS public.idx_profiles_username_unique;

-- 2. Update handle_new_user trigger:
--    - Allow accented characters in username
--    - Auto-suffix handle if duplicated (joao -> joao2 -> joao3...)
--    - Better error messages
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_username TEXT;
  v_avatar_url TEXT;
  v_handle TEXT;
  v_base_handle TEXT;
  v_suffix INT := 1;
  v_max_attempts INT := 50;
BEGIN
  v_username := TRIM(new.raw_user_meta_data ->> 'username');
  v_avatar_url := new.raw_user_meta_data ->> 'avatar_url';
  v_handle := LOWER(TRIM(new.raw_user_meta_data ->> 'handle'));

  -- Fallback: if no username, derive from email local-part
  IF v_username IS NULL OR v_username = '' THEN
    v_username := split_part(new.email, '@', 1);
  END IF;

  -- Validate username length (2-50)
  IF LENGTH(v_username) < 2 OR LENGTH(v_username) > 50 THEN
    RAISE EXCEPTION 'Invalid username: must be 2-50 characters';
  END IF;

  -- Allow letters (incl. accents), numbers, spaces, _ - . '
  -- Uses POSIX class via regex flag for Unicode letters
  IF v_username !~ '^[\p{L}\p{N}_\-\. '']+$' THEN
    RAISE EXCEPTION 'Invalid username: contains forbidden characters';
  END IF;

  -- Fallback: if no handle, derive from email local-part (sanitized)
  IF v_handle IS NULL OR v_handle = '' THEN
    v_handle := LOWER(regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9_]', '_', 'g'));
  END IF;

  -- Validate handle format
  IF LENGTH(v_handle) < 3 OR LENGTH(v_handle) > 30 THEN
    RAISE EXCEPTION 'Invalid handle: must be 3-30 characters';
  END IF;

  IF v_handle !~ '^[a-z0-9_]+$' THEN
    RAISE EXCEPTION 'Invalid handle: only lowercase letters, numbers and underscore allowed';
  END IF;

  -- Validate avatar_url length
  IF v_avatar_url IS NOT NULL AND LENGTH(v_avatar_url) > 500 THEN
    RAISE EXCEPTION 'Invalid avatar_url: too long';
  END IF;

  -- Auto-suffix handle if already taken
  v_base_handle := v_handle;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE LOWER(handle) = v_handle) AND v_suffix <= v_max_attempts LOOP
    v_suffix := v_suffix + 1;
    -- Truncate base if needed to fit suffix within 30 chars
    IF LENGTH(v_base_handle) + LENGTH(v_suffix::text) > 30 THEN
      v_handle := SUBSTRING(v_base_handle FROM 1 FOR (30 - LENGTH(v_suffix::text))) || v_suffix::text;
    ELSE
      v_handle := v_base_handle || v_suffix::text;
    END IF;
  END LOOP;

  IF v_suffix > v_max_attempts THEN
    RAISE EXCEPTION 'Could not find an available handle';
  END IF;

  INSERT INTO public.profiles (id, username, avatar_url, handle)
  VALUES (new.id, v_username, v_avatar_url, v_handle);

  RETURN new;
END;
$function$;

-- 3. Update availability checker: username never reported as taken
CREATE OR REPLACE FUNCTION public.check_signup_availability(_email text DEFAULT NULL::text, _handle text DEFAULT NULL::text, _username text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
  v_handle text;
  v_email_taken boolean := false;
  v_handle_taken boolean := false;
BEGIN
  v_email := lower(trim(coalesce(_email, '')));
  v_handle := lower(trim(coalesce(_handle, '')));

  IF v_email <> '' THEN
    SELECT EXISTS (SELECT 1 FROM auth.users u WHERE lower(u.email) = v_email) INTO v_email_taken;
  END IF;

  IF v_handle <> '' THEN
    SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE lower(p.handle) = v_handle) INTO v_handle_taken;
  END IF;

  RETURN jsonb_build_object(
    'email_taken', v_email_taken,
    'handle_taken', v_handle_taken,
    'username_taken', false
  );
END;
$function$;

-- 4. RPC to suggest a unique handle from a username (used by signup UI)
CREATE OR REPLACE FUNCTION public.suggest_handle_from_username(_username text)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_base text;
  v_candidate text;
  v_suffix int := 1;
BEGIN
  -- Normalize: lowercase, remove accents, keep only [a-z0-9_]
  v_base := lower(coalesce(_username, ''));
  v_base := translate(v_base,
    'áàâãäåçéèêëíìîïñóòôõöúùûüýÿ',
    'aaaaaaceeeeiiiinooooouuuuyy');
  v_base := regexp_replace(v_base, '[^a-z0-9_]', '_', 'g');
  v_base := regexp_replace(v_base, '_+', '_', 'g');
  v_base := trim(both '_' from v_base);

  IF length(v_base) < 3 THEN
    v_base := v_base || 'user';
  END IF;
  IF length(v_base) > 26 THEN
    v_base := substring(v_base from 1 for 26);
  END IF;

  v_candidate := v_base;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE lower(handle) = v_candidate) AND v_suffix <= 999 LOOP
    v_suffix := v_suffix + 1;
    v_candidate := v_base || v_suffix::text;
  END LOOP;

  RETURN v_candidate;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.suggest_handle_from_username(text) TO anon, authenticated;
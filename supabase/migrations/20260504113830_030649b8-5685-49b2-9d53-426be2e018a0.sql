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

  -- Allow letters (incl. accents via [:alpha:]), digits, spaces, _ - . '
  -- POSIX classes are supported by PostgreSQL; \p{L}\p{N} is NOT.
  IF v_username !~ '^[[:alpha:][:digit:]_\-\. '']+$' THEN
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
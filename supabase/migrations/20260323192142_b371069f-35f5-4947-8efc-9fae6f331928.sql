
-- Add handle column to profiles
ALTER TABLE public.profiles ADD COLUMN handle text;

-- Create unique index on lowercase handle
CREATE UNIQUE INDEX profiles_handle_unique ON public.profiles (lower(handle));

-- Add RLS policy so authenticated users can search profiles by handle
CREATE POLICY "Authenticated users can search profiles by handle"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Update the handle_new_user trigger function to also save handle
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
BEGIN
  v_username := TRIM(new.raw_user_meta_data ->> 'username');
  v_avatar_url := new.raw_user_meta_data ->> 'avatar_url';
  v_handle := LOWER(TRIM(new.raw_user_meta_data ->> 'handle'));
  
  -- Validate username: must be 2-50 characters
  IF v_username IS NULL OR LENGTH(v_username) < 2 OR LENGTH(v_username) > 50 THEN
    RAISE EXCEPTION 'Invalid username: must be 2-50 characters';
  END IF;
  
  -- Validate username format: only alphanumeric, underscore, hyphen, and spaces
  IF v_username !~ '^[a-zA-Z0-9_\- ]+$' THEN
    RAISE EXCEPTION 'Invalid username: only alphanumeric, underscore, hyphen, and spaces allowed';
  END IF;
  
  -- Validate handle: must be 3-30 characters, only lowercase alphanumeric and underscore
  IF v_handle IS NULL OR LENGTH(v_handle) < 3 OR LENGTH(v_handle) > 30 THEN
    RAISE EXCEPTION 'Invalid handle: must be 3-30 characters';
  END IF;
  
  IF v_handle !~ '^[a-z0-9_]+$' THEN
    RAISE EXCEPTION 'Invalid handle: only lowercase letters, numbers and underscore allowed';
  END IF;
  
  -- Validate avatar_url if provided (max 500 chars)
  IF v_avatar_url IS NOT NULL AND LENGTH(v_avatar_url) > 500 THEN
    RAISE EXCEPTION 'Invalid avatar_url: too long';
  END IF;
  
  INSERT INTO public.profiles (id, username, avatar_url, handle)
  VALUES (new.id, v_username, v_avatar_url, v_handle);
  
  RETURN new;
END;
$function$;


-- Remove the overly broad handle-lookup policy added in the previous migration.
DROP POLICY IF EXISTS "Authenticated users can find profiles by handle lookup" ON public.profiles;

-- Secure RPC that lets authenticated users search for other users by handle prefix/substring.
-- Returns only the minimum info needed for friend search. Limited to 10 results, requires
-- a non-empty query of at least 2 characters to prevent enumeration.
CREATE OR REPLACE FUNCTION public.search_profiles_by_handle(_query text)
RETURNS TABLE (
  id uuid,
  username text,
  avatar_url text,
  handle text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_clean := lower(trim(coalesce(_query, '')));
  IF length(v_clean) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT p.id, p.username, p.avatar_url, p.handle
  FROM public.profiles p
  WHERE p.handle IS NOT NULL
    AND p.handle ILIKE '%' || v_clean || '%'
    AND p.id <> auth.uid()
  LIMIT 10;
END;
$$;

REVOKE ALL ON FUNCTION public.search_profiles_by_handle(text) FROM public;
GRANT EXECUTE ON FUNCTION public.search_profiles_by_handle(text) TO authenticated;

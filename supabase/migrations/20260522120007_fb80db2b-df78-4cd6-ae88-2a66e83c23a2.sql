CREATE OR REPLACE FUNCTION public.get_email_by_handle(_handle text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.email::text
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE lower(p.handle) = lower(trim(_handle))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_email_by_handle(text) TO anon, authenticated;
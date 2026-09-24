CREATE OR REPLACE FUNCTION public.quick_add_to_watch(
  _production_id text,
  _production_type text,
  _production_data jsonb,
  _candidate_ids text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  DELETE FROM public.user_drawer_assignments
  WHERE user_id = auth.uid()
    AND drawer_id = ANY (ARRAY['to-watch', 'watching', 'watched']::text[])
    AND production_id = ANY (_candidate_ids);

  INSERT INTO public.user_drawer_assignments (
    user_id,
    drawer_id,
    production_id,
    production_type,
    production_data
  ) VALUES (
    auth.uid(),
    'to-watch',
    _production_id,
    _production_type,
    _production_data
  );
END;
$$;

REVOKE ALL ON FUNCTION public.quick_add_to_watch(text, text, jsonb, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quick_add_to_watch(text, text, jsonb, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.quick_add_to_watch(text, text, jsonb, text[]) TO service_role;
CREATE TABLE public.user_attribution (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  utm_source text, utm_medium text, utm_campaign text, utm_content text, utm_term text,
  landing_path text, referrer text,
  first_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.user_attribution TO service_role;
ALTER TABLE public.user_attribution ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.record_signup_attribution(_data jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _created timestamptz;
  f text := 'left(nullif(trim(x),''''),200)';
BEGIN
  IF _uid IS NULL THEN RETURN false; END IF;
  SELECT created_at INTO _created FROM auth.users WHERE id = _uid;
  -- only attribute accounts created in the last 48h (new signups)
  IF _created IS NULL OR _created < now() - interval '48 hours' THEN RETURN false; END IF;
  IF coalesce(_data->>'utm_source',_data->>'utm_campaign','') = '' THEN RETURN false; END IF;
  INSERT INTO public.user_attribution(user_id, utm_source, utm_medium, utm_campaign, utm_content, utm_term, landing_path, referrer, first_seen_at)
  VALUES (_uid,
    left(nullif(trim(lower(_data->>'utm_source')),''),200),
    left(nullif(trim(lower(_data->>'utm_medium')),''),200),
    left(nullif(trim(_data->>'utm_campaign'),''),200),
    left(nullif(trim(_data->>'utm_content'),''),200),
    left(nullif(trim(_data->>'utm_term'),''),200),
    left(nullif(trim(_data->>'landing_path'),''),300),
    left(nullif(trim(_data->>'referrer'),''),300),
    CASE WHEN (_data->>'first_seen_at') ~ '^\d{4}-\d{2}-\d{2}T' THEN (_data->>'first_seen_at')::timestamptz END)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.record_signup_attribution(jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.record_signup_attribution(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_attribution_list(_from date, _to date)
RETURNS TABLE(user_id uuid, handle text, username text, signed_up_at timestamptz, utm_source text, utm_medium text, utm_campaign text, utm_content text, landing_path text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT p.id, p.handle, p.username, p.created_at, a.utm_source, a.utm_medium, a.utm_campaign, a.utm_content, a.landing_path
  FROM public.profiles p LEFT JOIN public.user_attribution a ON a.user_id = p.id
  WHERE (p.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN _from AND _to
  ORDER BY p.created_at DESC LIMIT 2000;
END $$;
REVOKE ALL ON FUNCTION public.admin_attribution_list(date, date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_attribution_list(date, date) TO authenticated;
CREATE TABLE public.marketing_observations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 week_start date NOT NULL CHECK (extract(isodow from week_start) = 1),
 channel text NOT NULL CHECK (length(btrim(channel)) BETWEEN 1 AND 80),
 spend numeric(14,2) NOT NULL DEFAULT 0 CHECK (spend >= 0 AND spend <= 100000000),
 conversions integer NOT NULL DEFAULT 0 CHECK (conversions >= 0 AND conversions <= 100000000),
 revenue numeric(14,2) NOT NULL DEFAULT 0 CHECK (revenue >= 0 AND revenue <= 100000000),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(week_start, channel)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_observations TO authenticated;
GRANT ALL ON public.marketing_observations TO service_role;
ALTER TABLE public.marketing_observations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage marketing observations" ON public.marketing_observations FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE OR REPLACE FUNCTION public.admin_marketing_list(_from date, _to date) RETURNS SETOF public.marketing_observations LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501'; END IF;
 IF _from IS NULL OR _to IS NULL OR _to < _from OR _to - _from > 730 THEN RAISE EXCEPTION 'Invalid date range'; END IF;
 RETURN QUERY SELECT * FROM public.marketing_observations WHERE week_start BETWEEN _from AND _to ORDER BY week_start DESC, channel;
END; $$;
CREATE OR REPLACE FUNCTION public.admin_marketing_save(_week date, _channel text, _spend numeric, _conversions integer, _revenue numeric) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result uuid;
BEGIN
 IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501'; END IF;
 INSERT INTO public.marketing_observations(week_start, channel, spend, conversions, revenue, created_by) VALUES (_week, btrim(_channel), _spend, _conversions, _revenue, auth.uid())
 ON CONFLICT(week_start, channel) DO UPDATE SET spend = EXCLUDED.spend, conversions = EXCLUDED.conversions, revenue = EXCLUDED.revenue, updated_at = now() RETURNING id INTO result;
 RETURN result;
END; $$;
CREATE OR REPLACE FUNCTION public.admin_marketing_delete(_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501'; END IF;
 DELETE FROM public.marketing_observations WHERE id = _id;
END; $$;
REVOKE ALL ON FUNCTION public.admin_marketing_list(date,date), public.admin_marketing_save(date,text,numeric,integer,numeric), public.admin_marketing_delete(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_marketing_list(date,date), public.admin_marketing_save(date,text,numeric,integer,numeric), public.admin_marketing_delete(uuid) TO authenticated;
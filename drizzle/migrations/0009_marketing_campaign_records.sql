CREATE TABLE public.marketing_campaigns (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
 start_date date NOT NULL,
 end_date date,
 channel text NOT NULL CHECK (length(btrim(channel)) BETWEEN 1 AND 80),
 objective text NOT NULL CHECK (objective IN ('awareness','traffic','engagement','leads','signups','sales','video','other')),
 result_metric text NOT NULL CHECK (length(btrim(result_metric)) BETWEEN 1 AND 80),
 spend numeric(14,2) CHECK (spend BETWEEN 0 AND 100000000),
 results integer CHECK (results BETWEEN 0 AND 100000000),
 revenue numeric(14,2) CHECK (revenue BETWEEN 0 AND 100000000),
 impressions integer CHECK (impressions BETWEEN 0 AND 100000000),
 clicks integer CHECK (clicks BETWEEN 0 AND 100000000),
 notes text CHECK (length(notes) <= 2000),
 created_by uuid NOT NULL REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (end_date IS NULL OR end_date >= start_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_campaigns TO authenticated;
GRANT ALL ON public.marketing_campaigns TO service_role;
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage campaigns" ON public.marketing_campaigns FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.marketing_campaigns(id,name,start_date,end_date,channel,objective,result_metric,spend,results,revenue,created_by,created_at,updated_at,notes)
SELECT id, channel || ' · ' || week_start::text, week_start, week_start + 6, channel, 'other','Conversões',spend,conversions,revenue,created_by,created_at,updated_at,'Importado do registro semanal anterior; métricas preservadas.' FROM public.marketing_observations;
COMMENT ON TABLE public.marketing_observations IS 'DEPRECATED: replaced by marketing_campaigns; retained for deployed app compatibility';
CREATE FUNCTION public.admin_campaign_list(_from date,_to date) RETURNS SETOF public.marketing_campaigns LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 IF _from IS NULL OR _to IS NULL OR _to < _from OR _to - _from > 730 THEN RAISE EXCEPTION 'Invalid date range'; END IF;
 RETURN QUERY SELECT * FROM public.marketing_campaigns WHERE start_date <= _to AND (end_date IS NULL OR end_date >= _from) ORDER BY start_date DESC,created_at DESC;
END; $$;
CREATE FUNCTION public.admin_campaign_save(_id uuid,_name text,_start date,_end date,_channel text,_objective text,_metric text,_spend numeric,_results integer,_revenue numeric,_impressions integer,_clicks integer,_notes text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result uuid;
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 IF _id IS NULL THEN
 INSERT INTO public.marketing_campaigns(name,start_date,end_date,channel,objective,result_metric,spend,results,revenue,impressions,clicks,notes,created_by)
 VALUES (btrim(_name),_start,_end,btrim(_channel),_objective,btrim(_metric),_spend,_results,_revenue,_impressions,_clicks,nullif(btrim(_notes),''),auth.uid()) RETURNING id INTO result;
 ELSE
 UPDATE public.marketing_campaigns SET name=btrim(_name),start_date=_start,end_date=_end,channel=btrim(_channel),objective=_objective,result_metric=btrim(_metric),spend=_spend,results=_results,revenue=_revenue,impressions=_impressions,clicks=_clicks,notes=nullif(btrim(_notes),''),updated_at=now() WHERE id=_id RETURNING id INTO result;
 IF result IS NULL THEN RAISE EXCEPTION 'Campaign not found'; END IF;
 END IF;
 RETURN result;
END; $$;
CREATE FUNCTION public.admin_campaign_delete(_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 DELETE FROM public.marketing_campaigns WHERE id=_id;
END; $$;
REVOKE ALL ON FUNCTION public.admin_campaign_list(date,date), public.admin_campaign_save(uuid,text,date,date,text,text,text,numeric,integer,numeric,integer,integer,text), public.admin_campaign_delete(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_campaign_list(date,date), public.admin_campaign_save(uuid,text,date,date,text,text,text,numeric,integer,numeric,integer,integer,text), public.admin_campaign_delete(uuid) TO authenticated;
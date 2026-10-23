ALTER TABLE public.marketing_campaigns ADD COLUMN reach integer CHECK (reach BETWEEN 0 AND 100000000);
ALTER TABLE public.marketing_campaigns DROP CONSTRAINT marketing_campaigns_objective_check;
ALTER TABLE public.marketing_campaigns ADD CONSTRAINT marketing_campaigns_objective_check CHECK (objective IN ('awareness','traffic','profile_visit','engagement','leads','signups','sales','video','other'));
COMMENT ON COLUMN public.marketing_campaigns.reach IS 'Pessoas alcançadas (alcance) informado pela campanha, opcional';
CREATE OR REPLACE FUNCTION public.admin_campaign_save(_id uuid,_name text,_start date,_end date,_channel text,_objective text,_metric text,_spend numeric,_results integer,_revenue numeric,_reach integer,_impressions integer,_clicks integer,_notes text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result uuid;
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 IF _id IS NULL THEN
 INSERT INTO public.marketing_campaigns(name,start_date,end_date,channel,objective,result_metric,spend,results,revenue,reach,impressions,clicks,notes,created_by)
 VALUES (btrim(_name),_start,_end,btrim(_channel),_objective,btrim(_metric),_spend,_results,_revenue,_reach,_impressions,_clicks,nullif(btrim(_notes),''),auth.uid()) RETURNING id INTO result;
 ELSE
 UPDATE public.marketing_campaigns SET name=btrim(_name),start_date=_start,end_date=_end,channel=btrim(_channel),objective=_objective,result_metric=btrim(_metric),spend=_spend,results=_results,revenue=_revenue,reach=_reach,impressions=_impressions,clicks=_clicks,notes=nullif(btrim(_notes),''),updated_at=now() WHERE id=_id RETURNING id INTO result;
 IF result IS NULL THEN RAISE EXCEPTION 'Campaign not found'; END IF;
 END IF;
 RETURN result;
END; $$;
DROP FUNCTION public.admin_campaign_save(uuid,text,date,date,text,text,text,numeric,integer,numeric,integer,integer,text);
GRANT EXECUTE ON FUNCTION public.admin_campaign_save(uuid,text,date,date,text,text,text,numeric,integer,numeric,integer,integer,integer,text) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_campaign_save(uuid,text,date,date,text,text,text,numeric,integer,numeric,integer,integer,integer,text) FROM PUBLIC,anon;
CREATE TABLE IF NOT EXISTS public.billing_reconcile_dispatch (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  endpoint text NOT NULL,
  token text NOT NULL
);

REVOKE ALL ON public.billing_reconcile_dispatch FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.billing_reconcile_dispatch TO service_role;

ALTER TABLE public.billing_reconcile_dispatch ENABLE ROW LEVEL SECURITY;

INSERT INTO public.billing_reconcile_dispatch (id, endpoint, token)
VALUES (
  true,
  'https://lvwatpmfefimjpvqohxk.supabase.co/functions/v1/billing-reconcile',
  encode(extensions.gen_random_bytes(32), 'hex')
)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.verify_billing_reconcile_token(_token text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.billing_reconcile_dispatch
    WHERE token = _token
      AND length(_token) = 64
  );
$function$;

REVOKE ALL ON FUNCTION public.verify_billing_reconcile_token(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_billing_reconcile_token(text) TO service_role;

CREATE OR REPLACE FUNCTION public.dispatch_billing_reconcile()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  config public.billing_reconcile_dispatch%ROWTYPE;
BEGIN
  SELECT * INTO config FROM public.billing_reconcile_dispatch WHERE id = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Billing reconcile dispatch is not configured';
  END IF;
  PERFORM net.http_post(
    url := config.endpoint,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || config.token
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.dispatch_billing_reconcile() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_billing_reconcile() TO service_role;

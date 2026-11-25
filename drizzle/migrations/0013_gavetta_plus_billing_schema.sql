CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'asaas' CHECK (provider IN ('asaas')),
  provider_customer_id text,
  provider_subscription_id text,
  provider_payment_id text,
  plan text NOT NULL CHECK (plan IN ('monthly', 'yearly')),
  payment_method text NOT NULL CHECK (payment_method IN ('pix', 'pix_automatico', 'credit_card')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'past_due', 'canceled', 'expired', 'refunded')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  first_paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX subscriptions_user_id_idx ON public.subscriptions (user_id);
CREATE UNIQUE INDEX subscriptions_one_active_per_user_idx
  ON public.subscriptions (user_id)
  WHERE status IN ('active', 'past_due');
CREATE UNIQUE INDEX subscriptions_provider_subscription_id_idx
  ON public.subscriptions (provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own subscriptions"
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE public.billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'asaas',
  provider_event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.billing_events TO service_role;

ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.premium_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  granted_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  reason text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX premium_grants_user_id_idx ON public.premium_grants (user_id);
CREATE INDEX premium_grants_granted_by_idx ON public.premium_grants (granted_by);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.premium_grants TO authenticated;
GRANT ALL ON public.premium_grants TO service_role;

ALTER TABLE public.premium_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage premium grants"
  ON public.premium_grants
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.is_premium(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _user_id IS NOT NULL AND (
      EXISTS (
        SELECT 1
        FROM public.subscriptions s
        WHERE s.user_id = _user_id
          AND (
            s.status = 'active'
            OR (s.status = 'past_due' AND s.current_period_end + interval '3 days' > now())
            OR (s.status = 'canceled' AND s.current_period_end > now())
          )
      )
      OR EXISTS (
        SELECT 1
        FROM public.premium_grants g
        WHERE g.user_id = _user_id
          AND (g.expires_at IS NULL OR g.expires_at > now())
      )
    );
$$;

REVOKE ALL ON FUNCTION public.is_premium(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_premium(uuid) TO authenticated, service_role;

ALTER PUBLICATION supabase_realtime ADD TABLE public.subscriptions;
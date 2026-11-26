CREATE TABLE public.import_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  source_url text,
  kind text NOT NULL CHECK (kind IN ('text', 'podcast'))
);

CREATE INDEX import_usage_user_created_idx
  ON public.import_usage (user_id, created_at DESC);

GRANT SELECT ON public.import_usage TO authenticated;
GRANT ALL ON public.import_usage TO service_role;

ALTER TABLE public.import_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own import usage"
  ON public.import_usage
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
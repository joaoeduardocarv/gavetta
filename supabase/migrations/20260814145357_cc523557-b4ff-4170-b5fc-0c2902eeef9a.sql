CREATE TABLE public.import_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_url text,
  status text NOT NULL DEFAULT 'queued',
  stage text,
  progress integer NOT NULL DEFAULT 0,
  total integer,
  source_title text,
  source_provider text,
  result jsonb,
  error text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_jobs TO authenticated;
GRANT ALL ON public.import_jobs TO service_role;

ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own import jobs"
  ON public.import_jobs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own import jobs"
  ON public.import_jobs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own import jobs"
  ON public.import_jobs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own import jobs"
  ON public.import_jobs FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_import_jobs_updated_at
  BEFORE UPDATE ON public.import_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_import_jobs_user_created ON public.import_jobs (user_id, created_at DESC);

CREATE TABLE public.episode_transcripts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  audio_url text NOT NULL UNIQUE,
  source_title text,
  transcript text NOT NULL,
  partial boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.episode_transcripts TO authenticated;
GRANT ALL ON public.episode_transcripts TO service_role;

ALTER TABLE public.episode_transcripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read cached transcripts"
  ON public.episode_transcripts FOR SELECT TO authenticated
  USING (true);

CREATE TRIGGER update_episode_transcripts_updated_at
  BEFORE UPDATE ON public.episode_transcripts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
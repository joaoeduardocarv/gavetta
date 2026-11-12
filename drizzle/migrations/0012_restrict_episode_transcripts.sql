DROP POLICY IF EXISTS "Authenticated users can read cached transcripts" ON public.episode_transcripts;
REVOKE ALL ON public.episode_transcripts FROM anon, authenticated;
GRANT ALL ON public.episode_transcripts TO service_role;
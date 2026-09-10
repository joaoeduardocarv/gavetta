CREATE TABLE public.title_awards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  media_type text NOT NULL CHECK (media_type IN ('movie','tv')),
  tmdb_id integer NOT NULL,
  imdb_id text,
  raw_text text,
  oscar_wins integer NOT NULL DEFAULT 0,
  oscar_nominations integer NOT NULL DEFAULT 0,
  globe_wins integer NOT NULL DEFAULT 0,
  globe_nominations integer NOT NULL DEFAULT 0,
  emmy_wins integer NOT NULL DEFAULT 0,
  emmy_nominations integer NOT NULL DEFAULT 0,
  total_wins integer NOT NULL DEFAULT 0,
  total_nominations integer NOT NULL DEFAULT 0,
  has_awards boolean NOT NULL DEFAULT false,
  fetched_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (media_type, tmdb_id)
);

GRANT SELECT ON public.title_awards TO anon;
GRANT SELECT ON public.title_awards TO authenticated;
GRANT ALL ON public.title_awards TO service_role;

ALTER TABLE public.title_awards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Awards are publicly readable"
ON public.title_awards FOR SELECT
USING (true);

CREATE TRIGGER update_title_awards_updated_at
BEFORE UPDATE ON public.title_awards
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
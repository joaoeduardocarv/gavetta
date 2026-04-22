-- Episode/season/series rating storage
CREATE TABLE public.episode_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tmdb_tv_id INTEGER NOT NULL,
  -- NULL season_number + NULL episode_number = whole-series override
  -- non-NULL season_number + NULL episode_number = whole-season override
  -- both non-NULL = single episode rating
  season_number INTEGER,
  episode_number INTEGER,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 10),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Ensure only one rating per (user, tv, season, episode) tuple, including the
-- whole-series and whole-season levels. We use COALESCE to make NULL values
-- distinguishable as a unique key.
CREATE UNIQUE INDEX episode_ratings_unique_scope
  ON public.episode_ratings (
    user_id,
    tmdb_tv_id,
    COALESCE(season_number, -1),
    COALESCE(episode_number, -1)
  );

CREATE INDEX episode_ratings_user_show_idx
  ON public.episode_ratings (user_id, tmdb_tv_id);

ALTER TABLE public.episode_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own episode ratings"
  ON public.episode_ratings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own episode ratings"
  ON public.episode_ratings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own episode ratings"
  ON public.episode_ratings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own episode ratings"
  ON public.episode_ratings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Friends can view episode ratings"
  ON public.episode_ratings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE f.status = 'accepted'
        AND (
          (f.requester_id = auth.uid() AND f.addressee_id = episode_ratings.user_id)
          OR
          (f.addressee_id = auth.uid() AND f.requester_id = episode_ratings.user_id)
        )
    )
  );

-- Auto-update updated_at
CREATE TRIGGER update_episode_ratings_updated_at
  BEFORE UPDATE ON public.episode_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
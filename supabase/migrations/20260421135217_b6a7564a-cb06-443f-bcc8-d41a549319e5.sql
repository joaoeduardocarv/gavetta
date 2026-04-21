
CREATE TABLE public.watched_episodes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  tmdb_tv_id integer NOT NULL,
  season_number integer NOT NULL,
  episode_number integer NOT NULL,
  watched_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, tmdb_tv_id, season_number, episode_number)
);

CREATE INDEX idx_watched_episodes_user_show ON public.watched_episodes(user_id, tmdb_tv_id);

ALTER TABLE public.watched_episodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own watched episodes"
  ON public.watched_episodes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can mark their own episodes as watched"
  ON public.watched_episodes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unmark their own watched episodes"
  ON public.watched_episodes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Friends can view watched episodes"
  ON public.watched_episodes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE f.status = 'accepted'
        AND ((f.requester_id = auth.uid() AND f.addressee_id = watched_episodes.user_id)
          OR (f.addressee_id = auth.uid() AND f.requester_id = watched_episodes.user_id))
    )
  );

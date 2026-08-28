-- 1. Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 2. Feature events
CREATE TABLE public.feature_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  feature text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.feature_events TO authenticated;
GRANT ALL ON public.feature_events TO service_role;

ALTER TABLE public.feature_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert their own events"
ON public.feature_events FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view their own events, admins view all"
ON public.feature_events FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_feature_events_user_created ON public.feature_events (user_id, created_at DESC);
CREATE INDEX idx_feature_events_feature_created ON public.feature_events (feature, created_at DESC);

-- 3. Global usage metrics
CREATE OR REPLACE FUNCTION public.admin_usage_metrics()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  WITH events AS (
    SELECT user_id, created_at, 'drawer_add'::text AS feature FROM public.user_drawer_assignments
    UNION ALL SELECT user_id, created_at, 'rating' FROM public.user_drawer_assignments WHERE rating IS NOT NULL
    UNION ALL SELECT user_id, created_at, 'episode_rating' FROM public.episode_ratings
    UNION ALL SELECT user_id, watched_at, 'episode_watched' FROM public.watched_episodes
    UNION ALL SELECT user_id, created_at, 'custom_drawer' FROM public.user_custom_drawers
    UNION ALL SELECT user_id, created_at, 'shared_drawer' FROM public.shared_drawer_members
    UNION ALL SELECT requester_id, created_at, 'friend_request' FROM public.friendships
    UNION ALL SELECT sender_id, created_at, 'recommendation' FROM public.recommendations
    UNION ALL SELECT user_id, created_at, 'import' FROM public.import_jobs
    UNION ALL SELECT user_id, created_at, feature FROM public.feature_events
  ),
  totals AS (
    SELECT
      (SELECT count(*) FROM public.profiles) AS total_users,
      (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '7 days') AS new_users_7d,
      (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '30 days') AS new_users_30d,
      (SELECT count(*) FROM public.profiles WHERE onboarded_at IS NOT NULL) AS onboarded_users,
      (SELECT count(*) FROM public.profiles WHERE is_public) AS public_profiles,
      (SELECT count(DISTINCT user_id) FROM events WHERE created_at > now() - interval '1 day') AS active_1d,
      (SELECT count(DISTINCT user_id) FROM events WHERE created_at > now() - interval '7 days') AS active_7d,
      (SELECT count(DISTINCT user_id) FROM events WHERE created_at > now() - interval '30 days') AS active_30d
  ),
  features AS (
    SELECT feature,
      count(*) AS total,
      count(DISTINCT user_id) AS users_all,
      count(*) FILTER (WHERE created_at > now() - interval '7 days') AS total_7d,
      count(DISTINCT user_id) FILTER (WHERE created_at > now() - interval '7 days') AS users_7d,
      count(*) FILTER (WHERE created_at > now() - interval '30 days') AS total_30d,
      count(DISTINCT user_id) FILTER (WHERE created_at > now() - interval '30 days') AS users_30d
    FROM events GROUP BY feature
  ),
  daily AS (
    SELECT d::date AS day,
      (SELECT count(DISTINCT e.user_id) FROM events e WHERE (e.created_at AT TIME ZONE 'America/Sao_Paulo')::date = d::date) AS active_users,
      (SELECT count(*) FROM events e WHERE (e.created_at AT TIME ZONE 'America/Sao_Paulo')::date = d::date) AS actions,
      (SELECT count(*) FROM public.profiles p WHERE (p.created_at AT TIME ZONE 'America/Sao_Paulo')::date = d::date) AS signups
    FROM generate_series((now() AT TIME ZONE 'America/Sao_Paulo')::date - 29, (now() AT TIME ZONE 'America/Sao_Paulo')::date, interval '1 day') d
  ),
  drawers AS (
    SELECT drawer_id, count(*) AS total, count(DISTINCT user_id) AS users
    FROM public.user_drawer_assignments GROUP BY drawer_id
  ),
  imports AS (
    SELECT count(*) AS total,
      count(*) FILTER (WHERE status = 'completed') AS completed,
      count(*) FILTER (WHERE status = 'error' OR status = 'failed') AS failed
    FROM public.import_jobs
  ),
  notif AS (
    SELECT count(*) AS total, count(*) FILTER (WHERE is_read) AS read
    FROM public.notifications
  )
  SELECT jsonb_build_object(
    'overview', (SELECT to_jsonb(t) FROM totals t),
    'features', (SELECT coalesce(jsonb_agg(to_jsonb(f) ORDER BY f.total DESC), '[]'::jsonb) FROM features f),
    'daily', (SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.day), '[]'::jsonb) FROM daily d),
    'drawers', (SELECT coalesce(jsonb_agg(to_jsonb(dr) ORDER BY dr.total DESC), '[]'::jsonb) FROM drawers dr),
    'imports', (SELECT to_jsonb(i) FROM imports i),
    'notifications', (SELECT to_jsonb(n) FROM notif n)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- 4. User list with activity summary
CREATE OR REPLACE FUNCTION public.admin_user_list(_query text DEFAULT NULL, _limit int DEFAULT 50)
RETURNS TABLE (
  id uuid,
  username text,
  handle text,
  avatar_url text,
  created_at timestamptz,
  onboarded boolean,
  titles bigint,
  ratings bigint,
  episodes bigint,
  imports bigint,
  last_activity timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q text := lower(trim(coalesce(_query, '')));
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  WITH events AS (
    SELECT uda.user_id, uda.created_at FROM public.user_drawer_assignments uda
    UNION ALL SELECT er.user_id, er.created_at FROM public.episode_ratings er
    UNION ALL SELECT we.user_id, we.watched_at FROM public.watched_episodes we
    UNION ALL SELECT ucd.user_id, ucd.created_at FROM public.user_custom_drawers ucd
    UNION ALL SELECT f.requester_id, f.created_at FROM public.friendships f
    UNION ALL SELECT r.sender_id, r.created_at FROM public.recommendations r
    UNION ALL SELECT ij.user_id, ij.created_at FROM public.import_jobs ij
    UNION ALL SELECT fe.user_id, fe.created_at FROM public.feature_events fe
  )
  SELECT
    p.id,
    p.username,
    p.handle,
    p.avatar_url,
    p.created_at,
    p.onboarded_at IS NOT NULL,
    (SELECT count(*) FROM public.user_drawer_assignments a WHERE a.user_id = p.id),
    (SELECT count(*) FROM public.user_drawer_assignments a WHERE a.user_id = p.id AND a.rating IS NOT NULL),
    (SELECT count(*) FROM public.watched_episodes w WHERE w.user_id = p.id),
    (SELECT count(*) FROM public.import_jobs j WHERE j.user_id = p.id),
    (SELECT max(e.created_at) FROM events e WHERE e.user_id = p.id)
  FROM public.profiles p
  WHERE v_q = ''
     OR lower(coalesce(p.handle, '')) LIKE '%' || v_q || '%'
     OR lower(coalesce(p.username, '')) LIKE '%' || v_q || '%'
  ORDER BY (SELECT max(e.created_at) FROM events e WHERE e.user_id = p.id) DESC NULLS LAST
  LIMIT greatest(1, least(coalesce(_limit, 50), 200));
END;
$$;

-- 5. Per-user daily activity
CREATE OR REPLACE FUNCTION public.admin_user_activity(_user_id uuid, _days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_days int := greatest(1, least(coalesce(_days, 30), 180));
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  WITH events AS (
    SELECT created_at, 'drawer_add'::text AS feature,
           coalesce(production_data->>'title', production_data->>'name', production_id) AS label,
           drawer_id AS detail
    FROM public.user_drawer_assignments WHERE user_id = _user_id
    UNION ALL
    SELECT created_at, 'episode_rating', 'S' || coalesce(season_number, 0) || 'E' || coalesce(episode_number, 0), tmdb_tv_id::text
    FROM public.episode_ratings WHERE user_id = _user_id
    UNION ALL
    SELECT watched_at, 'episode_watched', 'S' || season_number || 'E' || episode_number, tmdb_tv_id::text
    FROM public.watched_episodes WHERE user_id = _user_id
    UNION ALL
    SELECT created_at, 'custom_drawer', name, icon FROM public.user_custom_drawers WHERE user_id = _user_id
    UNION ALL
    SELECT created_at, 'friend_request', status, NULL FROM public.friendships WHERE requester_id = _user_id
    UNION ALL
    SELECT created_at, 'recommendation', coalesce(production_data->>'title', production_data->>'name', production_id), NULL
    FROM public.recommendations WHERE sender_id = _user_id
    UNION ALL
    SELECT created_at, 'import', coalesce(source_title, source_url), status FROM public.import_jobs WHERE user_id = _user_id
    UNION ALL
    SELECT created_at, feature, metadata->>'label', NULL FROM public.feature_events WHERE user_id = _user_id
  ),
  scoped AS (
    SELECT (created_at AT TIME ZONE 'America/Sao_Paulo')::date AS day, feature, label, detail, created_at
    FROM events
    WHERE created_at > now() - (v_days || ' days')::interval
  ),
  daily AS (
    SELECT d::date AS day,
      (SELECT count(*) FROM scoped s WHERE s.day = d::date) AS actions,
      (SELECT coalesce(jsonb_object_agg(x.feature, x.c), '{}'::jsonb)
         FROM (SELECT s.feature, count(*) AS c FROM scoped s WHERE s.day = d::date GROUP BY s.feature) x) AS by_feature,
      (SELECT coalesce(jsonb_agg(jsonb_build_object('feature', s.feature, 'label', s.label, 'detail', s.detail, 'at', s.created_at) ORDER BY s.created_at DESC), '[]'::jsonb)
         FROM scoped s WHERE s.day = d::date) AS items
    FROM generate_series((now() AT TIME ZONE 'America/Sao_Paulo')::date - (v_days - 1), (now() AT TIME ZONE 'America/Sao_Paulo')::date, interval '1 day') d
  )
  SELECT jsonb_build_object(
    'profile', (SELECT to_jsonb(p) FROM (SELECT id, username, handle, avatar_url, created_at, onboarded_at, is_public FROM public.profiles WHERE id = _user_id) p),
    'daily', (SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.day), '[]'::jsonb) FROM daily d),
    'totals', (SELECT coalesce(jsonb_object_agg(feature, c), '{}'::jsonb) FROM (SELECT feature, count(*) AS c FROM scoped GROUP BY feature) t)
  ) INTO v_result;

  RETURN v_result;
END;
$$;
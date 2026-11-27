CREATE OR REPLACE FUNCTION public.get_user_stats(_year integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_is_premium boolean;
  v_current_year int := extract(year FROM (now() AT TIME ZONE 'America/Sao_Paulo'))::int;
  v_summary jsonb;
  v_available_years jsonb;
  v_rating_distribution jsonb;
  v_top_genres jsonb;
  v_monthly_activity jsonb;
  v_most_active_month jsonb;
  v_top_titles jsonb;
  v_brazilian_pct jsonb;
  v_most_binged_series jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  v_is_premium := public.is_premium(v_uid);

  IF NOT v_is_premium THEN
    IF _year IS NULL OR _year <> v_current_year THEN
      RAISE EXCEPTION 'PREMIUM_REQUIRED' USING ERRCODE = '42501';
    END IF;
  END IF;

  WITH watched_titles AS (
    SELECT
      uda.id,
      uda.production_id,
      uda.production_type,
      uda.production_data,
      uda.rating AS explicit_rating,
      greatest(coalesce(uda.rewatch_count, 0), 0) AS rewatch_count,
      uda.created_at,
      CASE
        WHEN uda.production_type = 'tv' AND uda.production_id ~ '^(tmdb-)?tv-[0-9]+$'
          THEN substring(uda.production_id FROM '([0-9]+)$')::int
        ELSE NULL
      END AS tmdb_tv_id
    FROM public.user_drawer_assignments uda
    WHERE uda.user_id = v_uid
      AND uda.drawer_id = 'watched'
      AND (
        _year IS NULL
        OR extract(year FROM (uda.created_at AT TIME ZONE 'America/Sao_Paulo'))::int = _year
      )
  ),
  series_meta AS (
    SELECT DISTINCT ON (tmdb_tv_id)
      substring(a.production_id FROM '([0-9]+)$')::int AS tmdb_tv_id,
      a.production_id,
      coalesce(a.production_data->>'title', a.production_data->>'name', a.production_id) AS title,
      coalesce(a.production_data->>'posterUrl', a.production_data->>'poster_path') AS poster_url,
      coalesce(
        CASE
          WHEN (a.production_data->>'runtime') ~ '^[0-9]+(\.[0-9]+)?$'
            AND (a.production_data->>'runtime')::numeric > 0
          THEN (a.production_data->>'runtime')::numeric
          ELSE NULL
        END,
        CASE
          WHEN jsonb_typeof(a.production_data->'episode_run_time') = 'array'
            AND jsonb_array_length(a.production_data->'episode_run_time') > 0
          THEN (
            SELECT avg(val::numeric)
            FROM jsonb_array_elements_text(a.production_data->'episode_run_time') AS val
            WHERE val ~ '^[0-9]+(\.[0-9]+)?$' AND val::numeric > 0
          )
          ELSE NULL
        END,
        45::numeric
      ) AS ep_runtime_min
    FROM public.user_drawer_assignments a
    WHERE a.user_id = v_uid
      AND a.production_type = 'tv'
      AND a.production_id ~ '^(tmdb-)?tv-[0-9]+$'
    ORDER BY
      substring(a.production_id FROM '([0-9]+)$')::int,
      CASE a.drawer_id WHEN 'watched' THEN 0 WHEN 'watching' THEN 1 ELSE 2 END,
      a.created_at DESC
  ),
  ep_events AS (
    SELECT
      we.tmdb_tv_id,
      we.season_number,
      we.episode_number,
      we.watched_at,
      coalesce(sm.ep_runtime_min, 45::numeric) AS ep_runtime_min
    FROM public.watched_episodes we
    LEFT JOIN series_meta sm ON sm.tmdb_tv_id = we.tmdb_tv_id
    WHERE we.user_id = v_uid
      AND (
        _year IS NULL
        OR extract(year FROM (we.watched_at AT TIME ZONE 'America/Sao_Paulo'))::int = _year
      )
  ),
  movie_minutes AS (
    SELECT coalesce(sum(
      (
        CASE
          WHEN (wt.production_data->>'runtime') ~ '^[0-9]+(\.[0-9]+)?$'
            AND (wt.production_data->>'runtime')::numeric > 0
          THEN (wt.production_data->>'runtime')::numeric
          ELSE 110::numeric
        END
      ) * (1 + wt.rewatch_count)
    ), 0) AS total_min
    FROM watched_titles wt
    WHERE wt.production_type = 'movie'
  ),
  episode_minutes AS (
    SELECT coalesce(sum(ee.ep_runtime_min), 0) AS total_min
    FROM ep_events ee
  ),
  extra_series_minutes AS (
    SELECT coalesce(sum(
      (wt.production_data->>'number_of_episodes')::numeric
      * coalesce(sm.ep_runtime_min, 45::numeric)
      * (1 + wt.rewatch_count)
    ), 0) AS total_min
    FROM watched_titles wt
    LEFT JOIN series_meta sm ON sm.tmdb_tv_id = wt.tmdb_tv_id
    WHERE wt.production_type = 'tv'
      AND (wt.production_data->>'number_of_episodes') ~ '^[0-9]+$'
      AND (wt.production_data->>'number_of_episodes')::int > 0
      AND (
        wt.tmdb_tv_id IS NULL
        OR NOT EXISTS (SELECT 1 FROM ep_events ee WHERE ee.tmdb_tv_id = wt.tmdb_tv_id)
      )
  )
  SELECT jsonb_build_object(
    'titles_watched', (SELECT count(*)::int FROM watched_titles),
    'movies_watched', (SELECT count(*)::int FROM watched_titles WHERE production_type = 'movie'),
    'series_watched', (SELECT count(*)::int FROM watched_titles WHERE production_type = 'tv'),
    'episodes_watched', (SELECT count(*)::int FROM ep_events),
    'total_hours', round(
      (
        (SELECT total_min FROM movie_minutes)
        + (SELECT total_min FROM episode_minutes)
        + (SELECT total_min FROM extra_series_minutes)
      ) / 60.0,
      1
    )
  ) INTO v_summary;

  IF NOT v_is_premium THEN
    RETURN jsonb_build_object(
      'is_premium', false,
      'year', v_current_year,
      'available_years', jsonb_build_array(v_current_year),
      'summary', v_summary
    );
  END IF;

  -- Available years for the selector (always includes current year)
  SELECT coalesce(jsonb_agg(y ORDER BY y DESC), jsonb_build_array(v_current_year))
  INTO v_available_years
  FROM (
    SELECT v_current_year AS y
    UNION
    SELECT extract(year FROM (created_at AT TIME ZONE 'America/Sao_Paulo'))::int
    FROM public.user_drawer_assignments
    WHERE user_id = v_uid AND drawer_id = 'watched'
    UNION
    SELECT extract(year FROM (watched_at AT TIME ZONE 'America/Sao_Paulo'))::int
    FROM public.watched_episodes
    WHERE user_id = v_uid
  ) yrs;

  -- Full premium analytics
  WITH watched_titles AS (
    SELECT
      uda.id,
      uda.production_id,
      uda.production_type,
      uda.production_data,
      uda.rating AS explicit_rating,
      uda.created_at,
      coalesce(uda.production_data->>'title', uda.production_data->>'name', uda.production_id) AS title,
      coalesce(uda.production_data->>'posterUrl', uda.production_data->>'poster_path') AS poster_url,
      CASE
        WHEN uda.production_type = 'tv' AND uda.production_id ~ '^(tmdb-)?tv-[0-9]+$'
          THEN substring(uda.production_id FROM '([0-9]+)$')::int
        ELSE NULL
      END AS tmdb_tv_id
    FROM public.user_drawer_assignments uda
    WHERE uda.user_id = v_uid
      AND uda.drawer_id = 'watched'
      AND (
        _year IS NULL
        OR extract(year FROM (uda.created_at AT TIME ZONE 'America/Sao_Paulo'))::int = _year
      )
  ),
  series_explicit_ratings AS (
    SELECT tmdb_tv_id, rating::numeric AS rating
    FROM public.episode_ratings
    WHERE user_id = v_uid
      AND season_number IS NULL
      AND episode_number IS NULL
  ),
  season_effective_ratings AS (
    SELECT
      tmdb_tv_id,
      season_number,
      coalesce(
        max(rating) FILTER (WHERE episode_number IS NULL)::numeric,
        round(avg(rating) FILTER (WHERE episode_number IS NOT NULL)::numeric, 1)
      ) AS season_rating
    FROM public.episode_ratings
    WHERE user_id = v_uid
      AND season_number IS NOT NULL
    GROUP BY tmdb_tv_id, season_number
  ),
  series_inherited_ratings AS (
    SELECT
      tmdb_tv_id,
      round(avg(season_rating)::numeric, 1) AS avg_rating
    FROM season_effective_ratings
    WHERE season_rating IS NOT NULL
    GROUP BY tmdb_tv_id
  ),
  effective_titles AS (
    SELECT
      wt.*,
      CASE
        WHEN wt.explicit_rating IS NOT NULL THEN wt.explicit_rating::numeric
        WHEN wt.production_type = 'tv' AND ser.rating IS NOT NULL THEN ser.rating
        WHEN wt.production_type = 'tv' AND sir.avg_rating IS NOT NULL THEN sir.avg_rating
        ELSE NULL
      END AS effective_rating,
      CASE
        WHEN wt.explicit_rating IS NOT NULL THEN false
        WHEN wt.production_type = 'tv' AND ser.rating IS NOT NULL THEN false
        WHEN wt.production_type = 'tv' AND sir.avg_rating IS NOT NULL THEN true
        ELSE false
      END AS is_inherited
    FROM watched_titles wt
    LEFT JOIN series_explicit_ratings ser ON ser.tmdb_tv_id = wt.tmdb_tv_id
    LEFT JOIN series_inherited_ratings sir ON sir.tmdb_tv_id = wt.tmdb_tv_id
  )
  SELECT
    -- Rating distribution 1..10
    (
      SELECT coalesce(jsonb_agg(
        jsonb_build_object(
          'rating', b.bucket,
          'count', coalesce(c.cnt, 0)
        ) ORDER BY b.bucket
      ), '[]'::jsonb)
      FROM generate_series(1, 10) AS b(bucket)
      LEFT JOIN (
        SELECT
          least(10, greatest(1, round(effective_rating)::int)) AS bucket,
          count(*)::int AS cnt
        FROM effective_titles
        WHERE effective_rating IS NOT NULL
        GROUP BY 1
      ) c ON c.bucket = b.bucket
    ),
    -- Top 8 genres
    (
      SELECT coalesce(jsonb_agg(
        jsonb_build_object('genre', g.genre, 'count', g.cnt)
        ORDER BY g.cnt DESC, g.genre ASC
      ), '[]'::jsonb)
      FROM (
        SELECT genre_name AS genre, count(*)::int AS cnt
        FROM (
          SELECT
            nullif(btrim(
              CASE
                WHEN jsonb_typeof(elem) = 'string' THEN trim(both '"' FROM elem::text)
                WHEN jsonb_typeof(elem) = 'object' THEN elem->>'name'
                ELSE NULL
              END
            ), '') AS genre_name
          FROM watched_titles wt,
          LATERAL jsonb_array_elements(
            CASE
              WHEN jsonb_typeof(wt.production_data->'genres') = 'array'
                THEN wt.production_data->'genres'
              ELSE '[]'::jsonb
            END
          ) AS elem
        ) raw_g
        WHERE genre_name IS NOT NULL
        GROUP BY genre_name
        ORDER BY cnt DESC, genre_name ASC
        LIMIT 8
      ) g
    ),
    -- Top 5 titles by effective rating
    (
      SELECT coalesce(jsonb_agg(
        jsonb_build_object(
          'production_id', t.production_id,
          'production_type', t.production_type,
          'title', t.title,
          'poster_url', t.poster_url,
          'rating', t.effective_rating,
          'is_inherited', t.is_inherited
        )
      ), '[]'::jsonb)
      FROM (
        SELECT production_id, production_type, title, poster_url, effective_rating, is_inherited
        FROM effective_titles
        WHERE effective_rating IS NOT NULL
        ORDER BY effective_rating DESC, created_at DESC
        LIMIT 5
      ) t
    ),
    -- Brazilian productions percentage
    (
      SELECT jsonb_build_object(
        'count', count(*) FILTER (WHERE is_br)::int,
        'total', count(*)::int,
        'percentage', CASE
          WHEN count(*) > 0 THEN round((count(*) FILTER (WHERE is_br) * 100.0 / count(*))::numeric, 1)
          ELSE 0
        END
      )
      FROM (
        SELECT
          (
            EXISTS (
              SELECT 1
              FROM jsonb_array_elements_text(
                CASE WHEN jsonb_typeof(wt.production_data->'origin_country') = 'array'
                  THEN wt.production_data->'origin_country' ELSE '[]'::jsonb END
              ) oc
              WHERE upper(oc) = 'BR'
            )
            OR EXISTS (
              SELECT 1
              FROM jsonb_array_elements_text(
                CASE WHEN jsonb_typeof(wt.production_data->'originCountry') = 'array'
                  THEN wt.production_data->'originCountry' ELSE '[]'::jsonb END
              ) oc
              WHERE upper(oc) = 'BR'
            )
            OR EXISTS (
              SELECT 1
              FROM jsonb_array_elements(
                CASE WHEN jsonb_typeof(wt.production_data->'production_countries') = 'array'
                  THEN wt.production_data->'production_countries' ELSE '[]'::jsonb END
              ) pc
              WHERE upper(coalesce(pc->>'iso_3166_1', trim(both '"' FROM pc::text))) IN ('BR', 'BRAZIL', 'BRASIL')
            )
            OR (
              lower(coalesce(wt.production_data->>'original_language', wt.production_data->>'originalLanguage', '')) = 'pt'
              AND NOT EXISTS (
                SELECT 1
                FROM jsonb_array_elements_text(
                  CASE WHEN jsonb_typeof(wt.production_data->'origin_country') = 'array'
                    THEN wt.production_data->'origin_country' ELSE '[]'::jsonb END
                ) oc
                WHERE upper(oc) = 'PT'
              )
            )
          ) AS is_br
        FROM watched_titles wt
      ) br_check
    )
  INTO v_rating_distribution, v_top_genres, v_top_titles, v_brazilian_pct;

  -- Monthly activity & most active month
  WITH events AS (
    SELECT
      extract(year FROM (uda.created_at AT TIME ZONE 'America/Sao_Paulo'))::int AS yr,
      extract(month FROM (uda.created_at AT TIME ZONE 'America/Sao_Paulo'))::int AS mo,
      'title'::text AS kind
    FROM public.user_drawer_assignments uda
    WHERE uda.user_id = v_uid
      AND uda.drawer_id = 'watched'
      AND (
        _year IS NULL
        OR extract(year FROM (uda.created_at AT TIME ZONE 'America/Sao_Paulo'))::int = _year
      )
    UNION ALL
    SELECT
      extract(year FROM (we.watched_at AT TIME ZONE 'America/Sao_Paulo'))::int AS yr,
      extract(month FROM (we.watched_at AT TIME ZONE 'America/Sao_Paulo'))::int AS mo,
      'episode'::text AS kind
    FROM public.watched_episodes we
    WHERE we.user_id = v_uid
      AND (
        _year IS NULL
        OR extract(year FROM (we.watched_at AT TIME ZONE 'America/Sao_Paulo'))::int = _year
      )
  )
  SELECT
    (
      SELECT coalesce(jsonb_agg(
        jsonb_build_object(
          'month', m.mo,
          'titles', coalesce(a.titles, 0),
          'episodes', coalesce(a.episodes, 0),
          'count', coalesce(a.cnt, 0)
        ) ORDER BY m.mo
      ), '[]'::jsonb)
      FROM generate_series(1, 12) AS m(mo)
      LEFT JOIN (
        SELECT
          mo,
          count(*) FILTER (WHERE kind = 'title')::int AS titles,
          count(*) FILTER (WHERE kind = 'episode')::int AS episodes,
          count(*)::int AS cnt
        FROM events
        GROUP BY mo
      ) a ON a.mo = m.mo
    ),
    (
      SELECT jsonb_build_object(
        'year', top_m.yr,
        'month', top_m.mo,
        'count', top_m.cnt,
        'titles', top_m.titles,
        'episodes', top_m.episodes
      )
      FROM (
        SELECT
          yr,
          mo,
          count(*)::int AS cnt,
          count(*) FILTER (WHERE kind = 'title')::int AS titles,
          count(*) FILTER (WHERE kind = 'episode')::int AS episodes
        FROM events
        GROUP BY yr, mo
        ORDER BY cnt DESC, yr DESC, mo DESC
        LIMIT 1
      ) top_m
    )
  INTO v_monthly_activity, v_most_active_month;

  -- Most binged series (by episodes watched in period)
  WITH series_meta AS (
    SELECT DISTINCT ON (tmdb_tv_id)
      substring(a.production_id FROM '([0-9]+)$')::int AS tmdb_tv_id,
      a.production_id,
      coalesce(a.production_data->>'title', a.production_data->>'name', a.production_id) AS title,
      coalesce(a.production_data->>'posterUrl', a.production_data->>'poster_path') AS poster_url,
      coalesce(
        CASE
          WHEN (a.production_data->>'runtime') ~ '^[0-9]+(\.[0-9]+)?$'
            AND (a.production_data->>'runtime')::numeric > 0
          THEN (a.production_data->>'runtime')::numeric
          ELSE NULL
        END,
        CASE
          WHEN jsonb_typeof(a.production_data->'episode_run_time') = 'array'
            AND jsonb_array_length(a.production_data->'episode_run_time') > 0
          THEN (
            SELECT avg(val::numeric)
            FROM jsonb_array_elements_text(a.production_data->'episode_run_time') AS val
            WHERE val ~ '^[0-9]+(\.[0-9]+)?$' AND val::numeric > 0
          )
          ELSE NULL
        END,
        45::numeric
      ) AS ep_runtime_min
    FROM public.user_drawer_assignments a
    WHERE a.user_id = v_uid
      AND a.production_type = 'tv'
      AND a.production_id ~ '^(tmdb-)?tv-[0-9]+$'
    ORDER BY
      substring(a.production_id FROM '([0-9]+)$')::int,
      CASE a.drawer_id WHEN 'watched' THEN 0 WHEN 'watching' THEN 1 ELSE 2 END,
      a.created_at DESC
  )
  SELECT jsonb_build_object(
    'tmdb_tv_id', b.tmdb_tv_id,
    'production_id', coalesce(sm.production_id, 'tv-' || b.tmdb_tv_id::text),
    'title', coalesce(sm.title, 'Série #' || b.tmdb_tv_id::text),
    'poster_url', sm.poster_url,
    'episodes_watched', b.episodes_watched,
    'estimated_hours', round((b.episodes_watched * coalesce(sm.ep_runtime_min, 45::numeric)) / 60.0, 1)
  )
  INTO v_most_binged_series
  FROM (
    SELECT
      we.tmdb_tv_id,
      count(*)::int AS episodes_watched,
      max(we.watched_at) AS last_watched_at
    FROM public.watched_episodes we
    WHERE we.user_id = v_uid
      AND (
        _year IS NULL
        OR extract(year FROM (we.watched_at AT TIME ZONE 'America/Sao_Paulo'))::int = _year
      )
    GROUP BY we.tmdb_tv_id
    ORDER BY episodes_watched DESC, last_watched_at DESC
    LIMIT 1
  ) b
  LEFT JOIN series_meta sm ON sm.tmdb_tv_id = b.tmdb_tv_id;

  RETURN jsonb_build_object(
    'is_premium', true,
    'year', _year,
    'available_years', v_available_years,
    'summary', v_summary,
    'rating_distribution', v_rating_distribution,
    'top_genres', v_top_genres,
    'monthly_activity', v_monthly_activity,
    'most_active_month', v_most_active_month,
    'top_titles', v_top_titles,
    'brazilian_pct', v_brazilian_pct,
    'most_binged_series', v_most_binged_series
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_user_stats(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_stats(integer) TO authenticated, service_role;
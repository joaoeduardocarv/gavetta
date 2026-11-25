CREATE OR REPLACE FUNCTION public.admin_user_profile(_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT jsonb_build_object(
    'profile', (SELECT jsonb_build_object('id',p.id,'username',p.username,'handle',p.handle,'avatar_url',p.avatar_url,'created_at',p.created_at,'is_public',p.is_public,'onboarded_at',p.onboarded_at) FROM public.profiles p WHERE p.id=_user_id),
    'account', (SELECT jsonb_build_object('email',u.email,'last_sign_in_at',u.last_sign_in_at,'email_confirmed_at',u.email_confirmed_at,
        'providers',(SELECT coalesce(jsonb_agg(DISTINCT i.provider),'[]') FROM auth.identities i WHERE i.user_id=u.id)) FROM auth.users u WHERE u.id=_user_id),
    'block', (SELECT jsonb_build_object('reason',b.reason,'at',b.created_at) FROM public.account_blocks b WHERE b.user_id=_user_id),
    'is_admin', public.has_role(_user_id,'admin'),
    'premium', jsonb_build_object(
      'is_premium', public.is_premium(_user_id),
      'subscription', (
        SELECT jsonb_build_object(
          'id', s.id,
          'plan', s.plan,
          'payment_method', s.payment_method,
          'status', s.status,
          'current_period_start', s.current_period_start,
          'current_period_end', s.current_period_end,
          'cancel_at_period_end', s.cancel_at_period_end
        )
        FROM public.subscriptions s
        WHERE s.user_id = _user_id
        ORDER BY
          CASE
            WHEN s.status = 'active' THEN 0
            WHEN s.status = 'past_due' AND s.current_period_end + interval '3 days' > now() THEN 1
            WHEN s.status = 'canceled' AND s.current_period_end > now() THEN 2
            ELSE 3
          END,
          s.created_at DESC
        LIMIT 1
      ),
      'grant', (
        SELECT jsonb_build_object(
          'id', g.id,
          'reason', g.reason,
          'expires_at', g.expires_at,
          'created_at', g.created_at,
          'granted_by', g.granted_by,
          'granted_by_name', coalesce(gp.handle, gp.username)
        )
        FROM public.premium_grants g
        LEFT JOIN public.profiles gp ON gp.id = g.granted_by
        WHERE g.user_id = _user_id
          AND (g.expires_at IS NULL OR g.expires_at > now())
        ORDER BY g.expires_at DESC NULLS FIRST, g.created_at DESC
        LIMIT 1
      )
    ),
    'counts', jsonb_build_object(
      'titles',(SELECT count(*) FROM public.user_drawer_assignments WHERE user_id=_user_id),
      'ratings',(SELECT count(*) FROM public.user_drawer_assignments WHERE user_id=_user_id AND rating IS NOT NULL),
      'avg_rating',(SELECT round(avg(rating)::numeric,1) FROM public.user_drawer_assignments WHERE user_id=_user_id AND rating IS NOT NULL),
      'episodes',(SELECT count(*) FROM public.watched_episodes WHERE user_id=_user_id),
      'episode_ratings',(SELECT count(*) FROM public.episode_ratings WHERE user_id=_user_id),
      'custom_drawers',(SELECT count(*) FROM public.user_custom_drawers WHERE user_id=_user_id),
      'friends',(SELECT count(*) FROM public.friendships WHERE status='accepted' AND (requester_id=_user_id OR addressee_id=_user_id)),
      'pending_friends',(SELECT count(*) FROM public.friendships WHERE status='pending' AND (requester_id=_user_id OR addressee_id=_user_id)),
      'recs_sent',(SELECT count(*) FROM public.recommendations WHERE sender_id=_user_id),
      'recs_received',(SELECT count(*) FROM public.recommendations WHERE receiver_id=_user_id),
      'likes',(SELECT count(*) FROM public.activity_likes WHERE user_id=_user_id),
      'comments',(SELECT count(*) FROM public.activity_comments WHERE user_id=_user_id),
      'imports',(SELECT count(*) FROM public.import_jobs WHERE user_id=_user_id),
      'notifications_unread',(SELECT count(*) FROM public.notifications WHERE user_id=_user_id AND NOT is_read)
    ),
    'drawers', (SELECT coalesce(jsonb_agg(x ORDER BY x->>'total' DESC),'[]') FROM (
       SELECT jsonb_build_object('drawer_id',a.drawer_id,'name',coalesce(c.name,a.drawer_id),'total',count(*)) x
       FROM public.user_drawer_assignments a LEFT JOIN public.user_custom_drawers c ON c.id::text=a.drawer_id
       WHERE a.user_id=_user_id GROUP BY a.drawer_id, c.name) s),
    'top_rated', (SELECT coalesce(jsonb_agg(x),'[]') FROM (
       SELECT jsonb_build_object('title',coalesce(production_data->>'title',production_data->>'name'),'rating',rating,'type',production_type,'at',created_at) x
       FROM public.user_drawer_assignments WHERE user_id=_user_id AND rating IS NOT NULL ORDER BY created_at DESC LIMIT 10) s),
    'friends_list', (SELECT coalesce(jsonb_agg(x),'[]') FROM (
       SELECT jsonb_build_object('id',p.id,'username',p.username,'handle',p.handle,'avatar_url',p.avatar_url) x
       FROM public.friendships f JOIN public.profiles p ON p.id = CASE WHEN f.requester_id=_user_id THEN f.addressee_id ELSE f.requester_id END
       WHERE f.status='accepted' AND (f.requester_id=_user_id OR f.addressee_id=_user_id) LIMIT 30) s),
    'comments_list', (SELECT coalesce(jsonb_agg(x),'[]') FROM (
       SELECT jsonb_build_object('id',id,'body',body,'created_at',created_at) x FROM public.activity_comments WHERE user_id=_user_id ORDER BY created_at DESC LIMIT 20) s)
  ) INTO r;
  RETURN r;
END $function$;

CREATE OR REPLACE FUNCTION public.admin_user_activity(_user_id uuid, _days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    SELECT created_at, feature, metadata->>'label', metadata->>'detail' FROM public.feature_events WHERE user_id = _user_id
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
$function$;

CREATE OR REPLACE FUNCTION public.admin_grant_premium(_user_id uuid, _reason text, _duration text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_reason text := btrim(coalesce(_reason, ''));
  v_expires_at timestamptz;
  v_duration_label text;
  v_grant_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id) THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;

  IF length(v_reason) = 0 OR length(v_reason) > 300 THEN
    RAISE EXCEPTION 'Informe um motivo válido (até 300 caracteres)';
  END IF;

  CASE _duration
    WHEN '30d' THEN
      v_expires_at := now() + interval '30 days';
      v_duration_label := '30 dias';
    WHEN '90d' THEN
      v_expires_at := now() + interval '90 days';
      v_duration_label := '90 dias';
    WHEN '1y' THEN
      v_expires_at := now() + interval '1 year';
      v_duration_label := '1 ano';
    WHEN 'forever' THEN
      v_expires_at := NULL;
      v_duration_label := 'Sem fim';
    ELSE
      RAISE EXCEPTION 'Validade inválida';
  END CASE;

  INSERT INTO public.premium_grants (user_id, granted_by, reason, expires_at)
  VALUES (_user_id, auth.uid(), v_reason, v_expires_at)
  RETURNING id INTO v_grant_id;

  INSERT INTO public.feature_events (user_id, feature, metadata)
  VALUES (
    _user_id,
    'premium_grant_granted',
    jsonb_build_object(
      'label', v_reason,
      'detail', v_duration_label,
      'admin_id', auth.uid(),
      'grant_id', v_grant_id,
      'expires_at', v_expires_at
    )
  );

  RETURN v_grant_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_grant_premium(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_grant_premium(uuid, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_revoke_premium(_user_id uuid, _reason text DEFAULT NULL)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_revoked integer;
  v_reason text := nullif(btrim(coalesce(_reason, '')), '');
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  UPDATE public.premium_grants
  SET expires_at = now() - interval '1 second'
  WHERE user_id = _user_id
    AND (expires_at IS NULL OR expires_at > now());

  GET DIAGNOSTICS v_revoked = ROW_COUNT;

  IF v_revoked = 0 THEN
    RAISE EXCEPTION 'Nenhuma cortesia ativa encontrada';
  END IF;

  INSERT INTO public.feature_events (user_id, feature, metadata)
  VALUES (
    _user_id,
    'premium_grant_revoked',
    jsonb_build_object(
      'label', coalesce(v_reason, 'Cortesia revogada pelo admin'),
      'detail', v_revoked || ' cortesia(s)',
      'admin_id', auth.uid()
    )
  );

  RETURN v_revoked;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_revoke_premium(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_revoke_premium(uuid, text) TO authenticated, service_role;

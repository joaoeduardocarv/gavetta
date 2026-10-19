CREATE TABLE public.account_blocks (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text,
  blocked_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.account_blocks TO authenticated;
GRANT ALL ON public.account_blocks TO service_role;
ALTER TABLE public.account_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read blocks" ON public.account_blocks FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.admin_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_by uuid NOT NULL,
  title text NOT NULL,
  message text,
  audience text NOT NULL,
  recipients integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_notices TO authenticated;
GRANT ALL ON public.admin_notices TO service_role;
ALTER TABLE public.admin_notices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read notices" ON public.admin_notices FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type = ANY (ARRAY['friend_request','friend_accepted','recommendation','activity','activity_like','activity_comment','shared_drawer_invite','streaming_change','new_season','new_episodes','upcoming_content','rental_arrival','purchase_arrival','admin_notice']));

CREATE OR REPLACE FUNCTION public.validate_notification_insert()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
 IF pg_trigger_depth()>1 OR auth.role()='service_role' THEN RETURN NEW; END IF;
 IF NEW.type='admin_notice' AND current_setting('app.admin_notice', true)='on' AND public.has_role(auth.uid(),'admin') THEN RETURN NEW; END IF;
 IF NEW.type IN ('friend_request','friend_accepted','recommendation','shared_drawer_invite','activity_like','activity_comment','admin_notice') THEN RAISE EXCEPTION 'Notifications are generated from their source event'; END IF;
 IF NEW.related_user_id IS NOT NULL AND NEW.related_user_id<>auth.uid() THEN RAISE EXCEPTION 'Cannot create notifications on behalf of other users'; END IF;
 IF NEW.user_id<>auth.uid() THEN RAISE EXCEPTION 'Notifications are generated from their source event'; END IF;
 RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.my_block_status()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT (SELECT jsonb_build_object('reason', reason, 'at', created_at) FROM public.account_blocks WHERE user_id = auth.uid()) $$;

CREATE OR REPLACE FUNCTION public.admin_user_profile(_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE r jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT jsonb_build_object(
    'profile', (SELECT jsonb_build_object('id',p.id,'username',p.username,'handle',p.handle,'avatar_url',p.avatar_url,'created_at',p.created_at,'is_public',p.is_public,'onboarded_at',p.onboarded_at) FROM public.profiles p WHERE p.id=_user_id),
    'account', (SELECT jsonb_build_object('email',u.email,'last_sign_in_at',u.last_sign_in_at,'email_confirmed_at',u.email_confirmed_at,
        'providers',(SELECT coalesce(jsonb_agg(DISTINCT i.provider),'[]') FROM auth.identities i WHERE i.user_id=u.id)) FROM auth.users u WHERE u.id=_user_id),
    'block', (SELECT jsonb_build_object('reason',b.reason,'at',b.created_at) FROM public.account_blocks b WHERE b.user_id=_user_id),
    'is_admin', public.has_role(_user_id,'admin'),
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
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_block(_user_id uuid, _blocked boolean, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _user_id = auth.uid() THEN RAISE EXCEPTION 'Cannot block yourself'; END IF;
  IF _blocked THEN
    INSERT INTO public.account_blocks(user_id, reason, blocked_by) VALUES (_user_id, nullif(trim(_reason),''), auth.uid())
    ON CONFLICT (user_id) DO UPDATE SET reason = EXCLUDED.reason, blocked_by = EXCLUDED.blocked_by, created_at = now();
  ELSE
    DELETE FROM public.account_blocks WHERE user_id = _user_id;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_recent_comments(_limit integer DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN (SELECT coalesce(jsonb_agg(x),'[]') FROM (
    SELECT jsonb_build_object('id',c.id,'body',c.body,'created_at',c.created_at,'user_id',c.user_id,'username',p.username,'handle',p.handle,'avatar_url',p.avatar_url,
      'title',coalesce(a.production_data->>'title',a.production_data->>'name')) x
    FROM public.activity_comments c JOIN public.profiles p ON p.id=c.user_id
    LEFT JOIN public.user_drawer_assignments a ON a.id=c.activity_id
    ORDER BY c.created_at DESC LIMIT greatest(1, least(coalesce(_limit,50),200))) s);
END $$;

CREATE OR REPLACE FUNCTION public.admin_delete_comment(_comment_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  DELETE FROM public.activity_comments WHERE id=_comment_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_send_notice(_title text, _message text, _user_ids uuid[] DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE n integer;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF length(trim(coalesce(_title,'')))=0 OR length(_title)>120 OR length(coalesce(_message,''))>1000 THEN RAISE EXCEPTION 'Invalid notice'; END IF;
  PERFORM set_config('app.admin_notice','on',true);
  INSERT INTO public.notifications(user_id, type, title, message, context)
  SELECT p.id, 'admin_notice', trim(_title), nullif(trim(_message),''), '{}'::jsonb
  FROM public.profiles p
  WHERE (_user_ids IS NULL OR p.id = ANY(_user_ids))
    AND NOT EXISTS (SELECT 1 FROM public.account_blocks b WHERE b.user_id=p.id);
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM set_config('app.admin_notice','off',true);
  INSERT INTO public.admin_notices(sent_by,title,message,audience,recipients)
  VALUES (auth.uid(), trim(_title), nullif(trim(_message),''), CASE WHEN _user_ids IS NULL THEN 'all' ELSE 'selected' END, n);
  RETURN n;
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_user_profile(uuid), public.admin_set_block(uuid,boolean,text), public.admin_recent_comments(integer), public.admin_delete_comment(uuid), public.admin_send_notice(text,text,uuid[]) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_user_profile(uuid), public.admin_set_block(uuid,boolean,text), public.admin_recent_comments(integer), public.admin_delete_comment(uuid), public.admin_send_notice(text,text,uuid[]), public.my_block_status() TO authenticated;
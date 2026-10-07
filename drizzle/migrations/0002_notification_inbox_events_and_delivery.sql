ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS event_id uuid, ADD COLUMN IF NOT EXISTS event_key text, ADD COLUMN IF NOT EXISTS context jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS notifications_event_key_unique ON public.notifications(user_id,event_key) WHERE event_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS notifications_inbox_order ON public.notifications(user_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_count ON public.notifications(user_id) WHERE NOT is_read;
ALTER TABLE public.notification_preferences ADD COLUMN IF NOT EXISTS activity_likes boolean NOT NULL DEFAULT true, ADD COLUMN IF NOT EXISTS activity_comments boolean NOT NULL DEFAULT true, ADD COLUMN IF NOT EXISTS recommendations boolean NOT NULL DEFAULT true, ADD COLUMN IF NOT EXISTS friendship_updates boolean NOT NULL DEFAULT true;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.notifications TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notifications,public.notification_preferences TO service_role;
CREATE OR REPLACE FUNCTION public.write_event_notification(_recipient uuid,_actor uuid,_type text,_title text,_message text,_content text,_event uuid,_key text,_context jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE enabled boolean;
BEGIN
 IF _recipient IS NULL OR _recipient=_actor THEN RETURN; END IF;
 SELECT CASE _type WHEN 'activity_like' THEN activity_likes WHEN 'activity_comment' THEN activity_comments WHEN 'recommendation' THEN recommendations WHEN 'friend_accepted' THEN friendship_updates ELSE true END INTO enabled FROM public.notification_preferences WHERE user_id=_recipient;
 IF enabled IS false THEN RETURN; END IF;
 INSERT INTO public.notifications(user_id,related_user_id,type,title,message,related_content_id,event_id,event_key,context) VALUES (_recipient,_actor,_type,_title,_message,_content,_event,_key,coalesce(_context,'{}'::jsonb)) ON CONFLICT (user_id,event_key) WHERE event_key IS NOT NULL DO NOTHING;
END; $$;
REVOKE ALL ON FUNCTION public.write_event_notification(uuid,uuid,text,text,text,text,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.notify_activity_interaction() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE owner_id uuid; actor_name text; production_title text; pid text; pdata jsonb;
BEGIN
 SELECT user_id,production_id,production_data,coalesce(production_data->>'title',production_data->>'name','Título') INTO owner_id,pid,pdata,production_title FROM public.user_drawer_assignments WHERE id=NEW.activity_id;
 IF owner_id IS NULL OR owner_id=NEW.user_id THEN RETURN NEW; END IF;
 SELECT coalesce(nullif(btrim(username),''),'Um amigo') INTO actor_name FROM public.profiles WHERE id=NEW.user_id;
 IF TG_TABLE_NAME='activity_likes' THEN
  IF EXISTS(SELECT 1 FROM public.notifications WHERE user_id=owner_id AND type='activity_like' AND related_user_id=NEW.user_id AND related_content_id=NEW.activity_id::text) THEN RETURN NEW; END IF;
  PERFORM public.write_event_notification(owner_id,NEW.user_id,'activity_like',actor_name||' curtiu sua atividade',production_title,NEW.activity_id::text,NEW.id,'like:'||NEW.activity_id||':'||NEW.user_id,jsonb_build_object('production_id',pid,'production_title',production_title));
 ELSE
  PERFORM public.write_event_notification(owner_id,NEW.user_id,'activity_comment',actor_name||' comentou na sua atividade',left(NEW.body,180),NEW.activity_id::text,NEW.id,'comment:'||NEW.id,jsonb_build_object('production_id',pid,'production_title',production_title));
 END IF;
 RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION public.notify_social_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid; recipient uuid; kind text; heading text; body_text text; content_id text; source_id uuid; payload jsonb; actor_name text;
BEGIN
 source_id:=NEW.id;
 IF TG_TABLE_NAME='friendships' THEN
  IF TG_OP='INSERT' AND NEW.status='pending' THEN actor:=NEW.requester_id;recipient:=NEW.addressee_id;kind:='friend_request';heading:='Pedido de amizade';body_text:='Quer ser seu amigo';
  ELSIF TG_OP='UPDATE' AND NEW.status='accepted' AND OLD.status IS DISTINCT FROM NEW.status THEN actor:=NEW.addressee_id;recipient:=NEW.requester_id;kind:='friend_accepted';heading:='Amizade aceita';body_text:='Aceitou seu pedido de amizade'; ELSE RETURN NEW; END IF;
 ELSIF TG_TABLE_NAME='recommendations' THEN
  actor:=NEW.sender_id;recipient:=NEW.receiver_id;kind:='recommendation';heading:='Indicou um título para você';content_id:=NEW.production_id;body_text:=coalesce(NEW.comment,coalesce(NEW.production_data->>'title',NEW.production_data->>'name','Uma indicação'));payload:=jsonb_build_object('production_id',NEW.production_id,'production_title',coalesce(NEW.production_data->>'title',NEW.production_data->>'name'));
 ELSIF TG_TABLE_NAME='shared_drawer_members' THEN
  IF NEW.status<>'pending' THEN RETURN NEW; END IF;
  actor:=NEW.invited_by;recipient:=NEW.user_id;kind:='shared_drawer_invite';heading:='Convite de gavetta';content_id:=NEW.drawer_id::text;
  SELECT name INTO body_text FROM public.user_custom_drawers WHERE id=NEW.drawer_id;
  payload:=jsonb_build_object('drawer_name',body_text);
 END IF;
 SELECT coalesce(nullif(btrim(username),''),'Um amigo') INTO actor_name FROM public.profiles WHERE id=actor;
 PERFORM public.write_event_notification(recipient,actor,kind,actor_name||' · '||heading,body_text,content_id,source_id,kind||':'||source_id,coalesce(payload,'{}'::jsonb));
 RETURN NEW;
END; $$;
CREATE TRIGGER notify_friendship_event AFTER INSERT OR UPDATE OF status ON public.friendships FOR EACH ROW EXECUTE FUNCTION public.notify_social_event();
CREATE TRIGGER notify_recommendation_event AFTER INSERT ON public.recommendations FOR EACH ROW EXECUTE FUNCTION public.notify_social_event();
CREATE TRIGGER notify_drawer_invitation_event AFTER INSERT ON public.shared_drawer_members FOR EACH ROW EXECUTE FUNCTION public.notify_social_event();
CREATE OR REPLACE FUNCTION public.validate_notification_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF pg_trigger_depth()>1 OR auth.role()='service_role' THEN RETURN NEW; END IF;
 IF NEW.type IN ('friend_request','friend_accepted','recommendation','shared_drawer_invite','activity_like','activity_comment') THEN RAISE EXCEPTION 'Notifications are generated from their source event'; END IF;
 IF NEW.related_user_id IS NOT NULL AND NEW.related_user_id<>auth.uid() THEN RAISE EXCEPTION 'Cannot create notifications on behalf of other users'; END IF;
 IF NEW.user_id<>auth.uid() THEN RAISE EXCEPTION 'Notifications are generated from their source event'; END IF;
 RETURN NEW;
END; $$;
ALTER POLICY "Friends can comment on activities" ON public.activity_comments WITH CHECK (user_id=auth.uid() AND public.is_activity_participant(activity_id,auth.uid()));
CREATE OR REPLACE FUNCTION public.notification_pending_items() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('friends',coalesce((SELECT jsonb_agg(jsonb_build_object('id',f.id,'actor_id',f.requester_id,'username',p.username,'avatar_url',p.avatar_url,'created_at',f.created_at)) FROM public.friendships f JOIN public.profiles p ON p.id=f.requester_id WHERE f.addressee_id=auth.uid() AND f.status='pending'),'[]'::jsonb),'drawers',coalesce((SELECT jsonb_agg(jsonb_build_object('id',m.id,'drawer_id',m.drawer_id,'actor_id',m.invited_by,'username',p.username,'avatar_url',p.avatar_url,'name',d.name,'created_at',m.created_at)) FROM public.shared_drawer_members m JOIN public.user_custom_drawers d ON d.id=m.drawer_id JOIN public.profiles p ON p.id=m.invited_by WHERE m.user_id=auth.uid() AND m.status='pending'),'[]'::jsonb));
$$;
REVOKE ALL ON FUNCTION public.notification_pending_items() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.notification_pending_items() TO authenticated;
CREATE TABLE public.content_update_progress(production_id text NOT NULL,production_type text NOT NULL,last_success timestamptz,next_attempt timestamptz NOT NULL DEFAULT now(),lease_until timestamptz,last_error text,PRIMARY KEY(production_id,production_type));
GRANT ALL ON public.content_update_progress TO service_role;
ALTER TABLE public.content_update_progress ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.claim_content_update_batch(_limit integer DEFAULT 30) RETURNS TABLE(production_id text,production_type text) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 INSERT INTO public.content_update_progress(production_id,production_type) SELECT DISTINCT a.production_id,a.production_type FROM public.user_drawer_assignments a WHERE a.production_id ~ '^(movie|tv)-[0-9]+$' ON CONFLICT DO NOTHING;
 RETURN QUERY WITH candidates AS(SELECT p.production_id,p.production_type FROM public.content_update_progress p WHERE p.next_attempt<=now() AND (p.lease_until IS NULL OR p.lease_until<now()) AND EXISTS(SELECT 1 FROM public.user_drawer_assignments a WHERE a.production_id=p.production_id AND a.production_type=p.production_type) ORDER BY p.last_success NULLS FIRST,p.next_attempt,p.production_id LIMIT greatest(1,least(_limit,50)) FOR UPDATE SKIP LOCKED) UPDATE public.content_update_progress p SET lease_until=now()+interval '5 minutes' FROM candidates c WHERE p.production_id=c.production_id AND p.production_type=c.production_type RETURNING p.production_id,p.production_type;
END; $$;
REVOKE ALL ON FUNCTION public.claim_content_update_batch(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_content_update_batch(integer) TO service_role;
COMMENT ON TABLE public.content_update_progress IS 'Service-only catalogue check leases, successful delivery checkpoints and retry state.';
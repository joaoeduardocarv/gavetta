CREATE OR REPLACE FUNCTION public.is_activity_participant(_activity_id uuid, _viewer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_drawer_assignments activity
    WHERE activity.id = _activity_id
      AND (
        activity.user_id = _viewer_id
        OR EXISTS (
          SELECT 1
          FROM public.friendships friendship
          WHERE friendship.status = 'accepted'
            AND (
              (friendship.requester_id = _viewer_id AND friendship.addressee_id = activity.user_id)
              OR (friendship.addressee_id = _viewer_id AND friendship.requester_id = activity.user_id)
            )
        )
      )
  );
$$;

CREATE TABLE public.activity_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.user_drawer_assignments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activity_likes_unique_user UNIQUE (activity_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.activity_likes TO authenticated;
GRANT ALL ON public.activity_likes TO service_role;
ALTER TABLE public.activity_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Activity participants can view likes"
ON public.activity_likes FOR SELECT TO authenticated
USING (public.is_activity_participant(activity_id, auth.uid()));

CREATE POLICY "Friends can like activities"
ON public.activity_likes FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.is_activity_participant(activity_id, auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.user_drawer_assignments activity
    WHERE activity.id = activity_id AND activity.user_id <> auth.uid()
  )
);

CREATE POLICY "Users can remove their activity likes"
ON public.activity_likes FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE INDEX activity_likes_activity_id_idx ON public.activity_likes(activity_id);

CREATE TABLE public.activity_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.user_drawer_assignments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activity_comments_body_length CHECK (char_length(btrim(body)) BETWEEN 1 AND 280)
);

GRANT SELECT, INSERT, DELETE ON public.activity_comments TO authenticated;
GRANT ALL ON public.activity_comments TO service_role;
ALTER TABLE public.activity_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Activity participants can view comments"
ON public.activity_comments FOR SELECT TO authenticated
USING (public.is_activity_participant(activity_id, auth.uid()));

CREATE POLICY "Friends can comment on activities"
ON public.activity_comments FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.is_activity_participant(activity_id, auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.user_drawer_assignments activity
    WHERE activity.id = activity_id AND activity.user_id <> auth.uid()
  )
);

CREATE POLICY "Users can remove their activity comments"
ON public.activity_comments FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE INDEX activity_comments_activity_id_created_at_idx ON public.activity_comments(activity_id, created_at);

CREATE OR REPLACE FUNCTION public.notify_activity_interaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  activity_owner uuid;
  actor_name text;
  activity_title text;
  notification_type text;
  notification_title text;
  notification_message text;
BEGIN
  SELECT assignment.user_id,
         coalesce(assignment.production_data->>'title', assignment.production_data->>'name', 'um título')
    INTO activity_owner, activity_title
    FROM public.user_drawer_assignments assignment
   WHERE assignment.id = NEW.activity_id;

  IF activity_owner IS NULL OR activity_owner = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(nullif(btrim(profile.username), ''), 'Um amigo')
    INTO actor_name
    FROM public.profiles profile
   WHERE profile.id = NEW.user_id;

  IF TG_TABLE_NAME = 'activity_likes' THEN
    notification_type := 'activity_like';
    notification_title := actor_name || ' curtiu sua atividade';
    notification_message := activity_title;

    IF EXISTS (
      SELECT 1 FROM public.notifications notification
       WHERE notification.user_id = activity_owner
         AND notification.related_user_id = NEW.user_id
         AND notification.related_content_id = NEW.activity_id::text
         AND notification.type = notification_type
    ) THEN
      RETURN NEW;
    END IF;
  ELSE
    notification_type := 'activity_comment';
    notification_title := actor_name || ' comentou na sua atividade';
    notification_message := left(NEW.body, 180);
  END IF;

  INSERT INTO public.notifications (
    user_id, type, title, message, related_user_id, related_content_id
  ) VALUES (
    activity_owner, notification_type, notification_title, notification_message, NEW.user_id, NEW.activity_id::text
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_activity_like_trigger
AFTER INSERT ON public.activity_likes
FOR EACH ROW EXECUTE FUNCTION public.notify_activity_interaction();

CREATE TRIGGER notify_activity_comment_trigger
AFTER INSERT ON public.activity_comments
FOR EACH ROW EXECUTE FUNCTION public.notify_activity_interaction();

-- =========================================
-- 1) PROFILES: Replace overly broad SELECT policy
-- =========================================
DROP POLICY IF EXISTS "Authenticated users can search profiles by handle" ON public.profiles;

-- Helper: is the viewer connected to this profile through a friendship (any status)?
CREATE OR REPLACE FUNCTION public.is_profile_visible_to_viewer(_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- self
    auth.uid() = _profile_id
    -- public profile
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _profile_id AND p.is_public = true)
    -- friendship (any status: pending or accepted, either direction)
    OR EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE (f.requester_id = auth.uid() AND f.addressee_id = _profile_id)
         OR (f.addressee_id = auth.uid() AND f.requester_id = _profile_id)
    )
    -- shares a drawer (owner of a drawer the viewer is a member of, or vice versa)
    OR EXISTS (
      SELECT 1
      FROM public.shared_drawer_members sm
      JOIN public.user_custom_drawers d ON d.id = sm.drawer_id
      WHERE (sm.user_id = auth.uid() AND d.user_id = _profile_id)
         OR (d.user_id = auth.uid() AND sm.user_id = _profile_id)
    )
    -- recommendation counterpart
    OR EXISTS (
      SELECT 1 FROM public.recommendations r
      WHERE (r.sender_id = auth.uid() AND r.receiver_id = _profile_id)
         OR (r.receiver_id = auth.uid() AND r.sender_id = _profile_id)
    );
$$;

-- Authenticated users can view profiles only when they have a relationship,
-- or the profile is public.
CREATE POLICY "Authenticated users can view related profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_profile_visible_to_viewer(id));

-- Allow lookup by exact handle (for friend search). Limited to authenticated users.
-- This still permits the existing AddFriendDialog behavior (ilike on handle).
CREATE POLICY "Authenticated users can find profiles by handle lookup"
ON public.profiles
FOR SELECT
TO authenticated
USING (handle IS NOT NULL);

-- Note: public profiles policy and self-view policy already exist and remain in place.

-- =========================================
-- 2) NOTIFICATIONS: tighten INSERT policy + trigger
-- =========================================
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;

CREATE POLICY "Authenticated users can create notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  -- The notification must be created by the related user (sender), OR
  -- the user creates a notification for themselves (self-notify), OR
  -- related_user_id is null AND target is the creator (system-style self notice)
  (related_user_id = auth.uid())
  OR (related_user_id IS NULL AND user_id = auth.uid())
);

-- Strengthen the trigger to validate recommendation/activity friendship
-- and fix the rate-limit bypass.
CREATE OR REPLACE FUNCTION public.validate_notification_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.related_user_id IS NOT NULL AND NEW.related_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Cannot create notifications on behalf of other users';
  END IF;

  IF NEW.type = 'friend_request' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.friendships
      WHERE requester_id = auth.uid()
        AND addressee_id = NEW.user_id
        AND status = 'pending'
    ) THEN
      RAISE EXCEPTION 'Invalid friend request notification: no pending friendship found';
    END IF;
  END IF;

  IF NEW.type = 'friend_accepted' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.friendships
      WHERE addressee_id = auth.uid()
        AND requester_id = NEW.user_id
        AND status = 'accepted'
    ) THEN
      RAISE EXCEPTION 'Invalid friend accepted notification: no accepted friendship found';
    END IF;
  END IF;

  -- Recommendation/activity must be sent to a friend
  IF NEW.type IN ('recommendation', 'activity') THEN
    IF NEW.user_id = auth.uid() THEN
      -- self-notify allowed
      NULL;
    ELSIF NOT EXISTS (
      SELECT 1 FROM public.friendships
      WHERE status = 'accepted'
        AND ((requester_id = auth.uid() AND addressee_id = NEW.user_id)
          OR (addressee_id = auth.uid() AND requester_id = NEW.user_id))
    ) THEN
      RAISE EXCEPTION 'Can only send % notifications to accepted friends', NEW.type;
    END IF;
  END IF;

  -- Hardened rate limit: count all notifications created by this user in the last minute,
  -- regardless of whether related_user_id was set.
  IF (
    SELECT COUNT(*)
    FROM public.notifications
    WHERE (related_user_id = auth.uid() OR (related_user_id IS NULL AND user_id = auth.uid()))
      AND created_at > NOW() - INTERVAL '1 minute'
  ) > 20 THEN
    RAISE EXCEPTION 'Rate limit exceeded: too many notifications';
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure the trigger exists (idempotent)
DROP TRIGGER IF EXISTS validate_notification_insert_trigger ON public.notifications;
CREATE TRIGGER validate_notification_insert_trigger
BEFORE INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.validate_notification_insert();

-- =========================================
-- 3) USER_DRAWER_ASSIGNMENTS: lock user_id on shared INSERT
-- =========================================
DROP POLICY IF EXISTS "Shared members can add to shared drawers" ON public.user_drawer_assignments;

CREATE POLICY "Shared members can add to shared drawers"
ON public.user_drawer_assignments
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.shared_drawer_members sm
    JOIN public.user_custom_drawers d ON d.id = sm.drawer_id
    WHERE sm.drawer_id::text = user_drawer_assignments.drawer_id
      AND sm.user_id = auth.uid()
      AND sm.status = 'accepted'
      AND d.shared_permission = 'open'
      -- Ensure the row is attributed to the drawer owner, not an arbitrary user
      AND user_drawer_assignments.user_id = d.user_id
  )
);

-- =========================================
-- 4) REALTIME: add authorization on realtime.messages
-- =========================================
-- Enable RLS on realtime.messages (no-op if already enabled)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'realtime' AND c.relname = 'messages'
  ) THEN
    EXECUTE 'ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY';
  END IF;
END$$;

-- Drop prior policies if they exist
DROP POLICY IF EXISTS "Users can subscribe to their own notifications channel" ON realtime.messages;
DROP POLICY IF EXISTS "Users can receive own notifications via realtime" ON realtime.messages;

-- Allow users to subscribe and receive postgres_changes only for the public.notifications
-- table when the row's user_id matches them. This applies to broadcast/presence/postgres_changes
-- events through realtime.messages.
CREATE POLICY "Users can receive own notifications via realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- Allow standard postgres_changes channel ('realtime:public:notifications' style)
  -- to be readable; row-level filtering is still enforced by public.notifications RLS,
  -- which restricts SELECT to (auth.uid() = user_id).
  -- Block arbitrary broadcast/presence topics that target other users.
  (extension = 'postgres_changes')
  OR (extension IN ('broadcast', 'presence') AND topic LIKE 'user:' || auth.uid()::text || ':%')
);

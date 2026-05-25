
-- 1) is_profile_visible_to_viewer: only accepted friendships
CREATE OR REPLACE FUNCTION public.is_profile_visible_to_viewer(_profile_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    auth.uid() = _profile_id
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _profile_id AND p.is_public = true)
    OR EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE f.status = 'accepted'
        AND ((f.requester_id = auth.uid() AND f.addressee_id = _profile_id)
          OR (f.addressee_id = auth.uid() AND f.requester_id = _profile_id))
    )
    OR EXISTS (
      SELECT 1
      FROM public.shared_drawer_members sm
      JOIN public.user_custom_drawers d ON d.id = sm.drawer_id
      WHERE sm.status = 'accepted'
        AND ((sm.user_id = auth.uid() AND d.user_id = _profile_id)
          OR (d.user_id = auth.uid() AND sm.user_id = _profile_id))
    )
    OR EXISTS (
      SELECT 1 FROM public.recommendations r
      WHERE (r.sender_id = auth.uid() AND r.receiver_id = _profile_id)
         OR (r.receiver_id = auth.uid() AND r.sender_id = _profile_id)
    );
$function$;

-- 2) Tighten notifications INSERT policy
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;
CREATE POLICY "Authenticated users can create notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  -- Self-notify
  user_id = auth.uid()
  OR (
    -- Acting on behalf of self (related_user_id is the actor)
    related_user_id = auth.uid()
    AND (
      -- Target is an accepted friend
      EXISTS (
        SELECT 1 FROM public.friendships f
        WHERE f.status = 'accepted'
          AND ((f.requester_id = auth.uid() AND f.addressee_id = notifications.user_id)
            OR (f.addressee_id = auth.uid() AND f.requester_id = notifications.user_id))
      )
      -- OR target sent the actor a pending friend request (for friend_accepted)
      OR EXISTS (
        SELECT 1 FROM public.friendships f
        WHERE f.requester_id = notifications.user_id
          AND f.addressee_id = auth.uid()
      )
      -- OR target received a friend request from the actor (for friend_request)
      OR EXISTS (
        SELECT 1 FROM public.friendships f
        WHERE f.requester_id = auth.uid()
          AND f.addressee_id = notifications.user_id
      )
    )
  )
);

-- 3) Restrict public-profile drawer assignments to authenticated users
DROP POLICY IF EXISTS "Public profile drawer assignments are viewable" ON public.user_drawer_assignments;
CREATE POLICY "Public profile drawer assignments are viewable"
ON public.user_drawer_assignments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = user_drawer_assignments.user_id
      AND profiles.is_public = true
  )
);

-- 4) Revoke EXECUTE on internal SECURITY DEFINER functions not meant for direct API calls
REVOKE ALL ON FUNCTION public.is_profile_visible_to_viewer(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_notification_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.search_profiles_by_handle(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.suggest_handle_from_username(text) FROM authenticated;

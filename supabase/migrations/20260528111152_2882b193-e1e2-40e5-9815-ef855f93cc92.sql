
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
    );
$function$;

DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;

CREATE POLICY "Authenticated users can create notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR (
    related_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE f.status = 'accepted'
        AND (
          (f.requester_id = auth.uid() AND f.addressee_id = notifications.user_id)
          OR (f.addressee_id = auth.uid() AND f.requester_id = notifications.user_id)
        )
    )
  )
);

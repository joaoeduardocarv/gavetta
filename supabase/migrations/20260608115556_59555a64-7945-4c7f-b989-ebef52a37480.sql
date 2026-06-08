DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;

CREATE POLICY "Authenticated users can create notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  -- Self-generated notifications
  (user_id = auth.uid() AND (related_user_id IS NULL OR related_user_id = auth.uid()))
  OR
  -- Cross-user notifications: actor must identify themselves via related_user_id,
  -- must be accepted friends with target, and type must be in whitelist.
  (
    related_user_id = auth.uid()
    AND user_id <> auth.uid()
    AND type IN ('friend_request', 'friend_accepted', 'recommendation', 'activity')
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
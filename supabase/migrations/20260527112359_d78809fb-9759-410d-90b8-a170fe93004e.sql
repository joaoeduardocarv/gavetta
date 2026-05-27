CREATE POLICY "Friends can view all drawer assignments"
ON public.user_drawer_assignments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE f.status = 'accepted'
      AND ((f.requester_id = auth.uid() AND f.addressee_id = user_drawer_assignments.user_id)
        OR (f.addressee_id = auth.uid() AND f.requester_id = user_drawer_assignments.user_id))
  )
);
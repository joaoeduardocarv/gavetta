-- Add RLS policy to allow users to view their friends' watched assignments
CREATE POLICY "Users can view friends watched assignments"
ON public.user_drawer_assignments
FOR SELECT
USING (
  drawer_id = 'watched' 
  AND EXISTS (
    SELECT 1 FROM public.friendships
    WHERE status = 'accepted'
    AND (
      (requester_id = auth.uid() AND addressee_id = user_drawer_assignments.user_id)
      OR (addressee_id = auth.uid() AND requester_id = user_drawer_assignments.user_id)
    )
  )
);
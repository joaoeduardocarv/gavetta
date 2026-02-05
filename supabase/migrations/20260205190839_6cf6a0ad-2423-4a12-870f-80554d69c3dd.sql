-- Fix the notifications INSERT policy to be more restrictive
DROP POLICY "System can create notifications" ON public.notifications;

-- Users can create notifications (used by the app when sending friend requests/recommendations)
CREATE POLICY "Authenticated users can create notifications" 
  ON public.notifications FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);
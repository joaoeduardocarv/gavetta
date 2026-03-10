
-- Fix: Restrict friendship UPDATE so only the addressee can accept/reject
DROP POLICY IF EXISTS "Users can update friendships they're part of" ON public.friendships;

CREATE POLICY "Only addressee can update friendship status"
ON public.friendships
FOR UPDATE
TO public
USING (auth.uid() = addressee_id)
WITH CHECK (auth.uid() = addressee_id);

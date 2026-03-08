
-- Add shared_permission column to user_custom_drawers: 'open' (all members edit) or 'locked' (only owner edits)
ALTER TABLE public.user_custom_drawers ADD COLUMN shared_permission text NOT NULL DEFAULT 'open';

-- Update RLS: shared members can only INSERT to shared drawers with 'open' permission
DROP POLICY IF EXISTS "Shared members can add to shared drawers" ON public.user_drawer_assignments;
CREATE POLICY "Shared members can add to shared drawers"
ON public.user_drawer_assignments FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.shared_drawer_members sm
    JOIN public.user_custom_drawers d ON d.id = sm.drawer_id
    WHERE sm.drawer_id::text = user_drawer_assignments.drawer_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'accepted'
    AND d.shared_permission = 'open'
  )
);

-- Update RLS: shared members can only DELETE from shared drawers with 'open' permission
DROP POLICY IF EXISTS "Shared members can delete from shared drawers" ON public.user_drawer_assignments;
CREATE POLICY "Shared members can delete from shared drawers"
ON public.user_drawer_assignments FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.shared_drawer_members sm
    JOIN public.user_custom_drawers d ON d.id = sm.drawer_id
    WHERE sm.drawer_id::text = user_drawer_assignments.drawer_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'accepted'
    AND d.shared_permission = 'open'
  )
);

-- Also fix notifications: make INSERT policy PERMISSIVE
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;
CREATE POLICY "Authenticated users can create notifications"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Make notifications SELECT policy PERMISSIVE
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Make notifications UPDATE policy PERMISSIVE
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

-- Make notifications DELETE policy PERMISSIVE
DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
CREATE POLICY "Users can delete their own notifications"
ON public.notifications FOR DELETE TO authenticated
USING (auth.uid() = user_id);

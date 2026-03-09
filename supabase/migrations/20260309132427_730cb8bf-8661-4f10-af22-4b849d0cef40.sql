
-- Fix 1: shared_drawer_members INSERT policy - require inviter owns the drawer
DROP POLICY IF EXISTS "Users can create shared drawer invites" ON public.shared_drawer_members;
CREATE POLICY "Users can create shared drawer invites"
ON public.shared_drawer_members
FOR INSERT
TO public
WITH CHECK (
  auth.uid() = invited_by
  AND EXISTS (
    SELECT 1 FROM public.user_custom_drawers
    WHERE id = shared_drawer_members.drawer_id AND user_id = auth.uid()
  )
);

-- Fix 2: profiles SELECT policies - remove overly permissive policy, add proper ones
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
-- The "Public profiles are viewable by anyone" policy already exists with is_public = true
-- Add a policy for authenticated users to see their own profile
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Fix 3: notifications INSERT policy - restrict to own user_id or proper server-side
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;
CREATE POLICY "Authenticated users can create notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  related_user_id = auth.uid() OR related_user_id IS NULL
);

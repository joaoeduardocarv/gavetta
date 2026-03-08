
-- Table for shared drawer memberships
CREATE TABLE public.shared_drawer_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drawer_id uuid NOT NULL REFERENCES public.user_custom_drawers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  invited_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (drawer_id, user_id)
);

ALTER TABLE public.shared_drawer_members ENABLE ROW LEVEL SECURITY;

-- Members can view shared drawer memberships they're part of
CREATE POLICY "Users can view their shared drawer memberships"
ON public.shared_drawer_members
FOR SELECT
USING (auth.uid() = user_id OR auth.uid() = invited_by);

-- Owner of drawer can invite (invited_by = auth.uid())
CREATE POLICY "Users can create shared drawer invites"
ON public.shared_drawer_members
FOR INSERT
WITH CHECK (auth.uid() = invited_by);

-- Invited user can update (accept/reject) their own membership
CREATE POLICY "Users can update their own membership"
ON public.shared_drawer_members
FOR UPDATE
USING (auth.uid() = user_id);

-- Owner or invited user can delete membership
CREATE POLICY "Users can delete shared drawer memberships"
ON public.shared_drawer_members
FOR DELETE
USING (auth.uid() = user_id OR auth.uid() = invited_by);

-- Allow shared drawer members to view the custom drawer info
CREATE POLICY "Shared members can view drawer info"
ON public.user_custom_drawers
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.shared_drawer_members
    WHERE shared_drawer_members.drawer_id = user_custom_drawers.id
    AND shared_drawer_members.user_id = auth.uid()
    AND shared_drawer_members.status = 'accepted'
  )
);

-- Allow shared drawer members to view drawer assignments
CREATE POLICY "Shared members can view drawer assignments"
ON public.user_drawer_assignments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.shared_drawer_members
    WHERE shared_drawer_members.drawer_id::text = user_drawer_assignments.drawer_id
    AND shared_drawer_members.user_id = auth.uid()
    AND shared_drawer_members.status = 'accepted'
  )
);

-- Allow shared drawer members to insert into shared drawers
CREATE POLICY "Shared members can add to shared drawers"
ON public.user_drawer_assignments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.shared_drawer_members
    WHERE shared_drawer_members.drawer_id::text = user_drawer_assignments.drawer_id
    AND shared_drawer_members.user_id = auth.uid()
    AND shared_drawer_members.status = 'accepted'
  )
);

-- Allow shared drawer members to delete from shared drawers
CREATE POLICY "Shared members can delete from shared drawers"
ON public.user_drawer_assignments
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.shared_drawer_members
    WHERE shared_drawer_members.drawer_id::text = user_drawer_assignments.drawer_id
    AND shared_drawer_members.user_id = auth.uid()
    AND shared_drawer_members.status = 'accepted'
  )
);

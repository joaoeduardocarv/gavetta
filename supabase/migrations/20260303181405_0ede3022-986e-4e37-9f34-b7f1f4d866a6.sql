
-- Add is_public column to profiles (default false = private)
ALTER TABLE public.profiles ADD COLUMN is_public boolean NOT NULL DEFAULT false;

-- Make username unique (needed for /u/:username routes)
CREATE UNIQUE INDEX idx_profiles_username_unique ON public.profiles (username) WHERE username IS NOT NULL;

-- Allow anonymous SELECT on profiles where is_public = true (for public profile page)
CREATE POLICY "Public profiles are viewable by anyone"
ON public.profiles
FOR SELECT
USING (is_public = true);

-- Allow anonymous SELECT on user_drawer_assignments for public profiles
CREATE POLICY "Public profile drawer assignments are viewable"
ON public.user_drawer_assignments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = user_drawer_assignments.user_id
    AND profiles.is_public = true
  )
);

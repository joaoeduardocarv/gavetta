
-- is_profile_visible_to_viewer is referenced by an RLS policy on public.profiles.
-- It needs EXECUTE for the roles that query the table, otherwise the policy errors
-- and the profile (and everything that depends on it) appears empty.
GRANT EXECUTE ON FUNCTION public.is_profile_visible_to_viewer(uuid) TO authenticated, anon;

-- Restore execute permissions on RPC/RLS helper functions that were inadvertently revoked.
-- handle_new_user remains restricted to supabase_auth_admin.

GRANT EXECUTE ON FUNCTION public.is_profile_visible_to_viewer(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.check_signup_availability(text, text, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.search_profiles_by_handle(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.suggest_handle_from_username(text) TO authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.admin_usage_metrics() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_user_list(text, int) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_user_activity(uuid, int) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.admin_usage_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_user_list(text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_user_activity(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
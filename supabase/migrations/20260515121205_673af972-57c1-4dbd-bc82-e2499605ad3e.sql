-- Trigger interno: ninguém do client deve chamar
REVOKE EXECUTE ON FUNCTION public.validate_notification_insert() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_notification_insert() FROM anon;
REVOKE EXECUTE ON FUNCTION public.validate_notification_insert() FROM authenticated;

-- Usada apenas dentro de policies RLS (roda como definer no contexto do policy)
REVOKE EXECUTE ON FUNCTION public.is_profile_visible_to_viewer(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_profile_visible_to_viewer(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_profile_visible_to_viewer(uuid) FROM authenticated;

-- Busca de perfis por handle: só faz sentido para usuários logados (a própria função exige auth.uid())
REVOKE EXECUTE ON FUNCTION public.search_profiles_by_handle(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.search_profiles_by_handle(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.search_profiles_by_handle(text) TO authenticated;

-- Cadastro: precisa funcionar para visitante não autenticado
REVOKE EXECUTE ON FUNCTION public.check_signup_availability(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_signup_availability(text, text, text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.suggest_handle_from_username(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.suggest_handle_from_username(text) TO anon, authenticated;
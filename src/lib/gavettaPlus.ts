import { useIsAdmin } from "@/hooks/useIsAdmin";

/**
 * Flag global de lançamento do Gavetta+.
 * Enquanto `false`, apenas administradores veem a experiência do Gavetta+.
 */
export const GAVETTA_PLUS_ENABLED = false;

export function useGavettaPlusEnabled() {
  const { isAdmin, loading } = useIsAdmin();
  const enabled = GAVETTA_PLUS_ENABLED || isAdmin;
  return {
    enabled,
    isLoading: GAVETTA_PLUS_ENABLED ? false : loading,
  };
}
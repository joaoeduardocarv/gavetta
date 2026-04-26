import { ReactNode, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { hasVisitedThisSession, markSessionVisited } from "@/lib/sessionVisit";

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  // Marca a sessão como visitada assim que um usuário logado entra em uma rota protegida.
  // Isso evita que, após logout, ele volte para /welcome em vez de /auth.
  useEffect(() => {
    if (user) {
      markSessionVisited();
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    // Primeiro acesso desta sessão de navegador → mostra a landing institucional.
    // Acessos seguintes (mesma sessão) → vai direto para o login.
    if (!hasVisitedThisSession()) {
      markSessionVisited();
      return <Navigate to="/welcome" replace />;
    }
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

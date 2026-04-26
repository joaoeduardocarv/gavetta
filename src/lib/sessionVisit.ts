/**
 * Controla se o usuário já visitou o app nesta sessão de navegador.
 * Usa sessionStorage: zera quando o navegador é fechado, permanece em refresh.
 *
 * Comportamento desejado:
 * - Primeiro acesso (sessão nova) sem login → /welcome
 * - Acessos seguintes na mesma sessão sem login → /auth
 * - Logout → marca como visitado (próxima rota protegida vai para /auth, não /welcome)
 * - Fechar e reabrir o navegador → sessão nova → /welcome de novo
 */

const VISIT_KEY = "gavetta:session-visited";

export function hasVisitedThisSession(): boolean {
  try {
    return sessionStorage.getItem(VISIT_KEY) === "1";
  } catch {
    // sessionStorage indisponível (modo restrito) → tratar como já visitado
    // para não prender o usuário em loops de welcome
    return true;
  }
}

export function markSessionVisited(): void {
  try {
    sessionStorage.setItem(VISIT_KEY, "1");
  } catch {
    // ignore
  }
}

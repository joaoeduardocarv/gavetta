import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
import * as authHook from "@/hooks/useAuth";

// Mock do useAuth para controlar user/loading nos testes
vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

const useAuthMock = authHook.useAuth as unknown as ReturnType<typeof vi.fn>;

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <div>HOME_APP</div>
            </ProtectedRoute>
          }
        />
        <Route path="/welcome" element={<div>WELCOME_PAGE</div>} />
        <Route path="/auth" element={<div>AUTH_PAGE</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ProtectedRoute redirects", () => {
  beforeEach(() => {
    sessionStorage.clear();
    useAuthMock.mockReset();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it("shows loading spinner while auth state is loading", () => {
    useAuthMock.mockReturnValue({ user: null, loading: true, signOut: vi.fn() });

    const { container } = renderAt("/");

    // O spinner é o único conteúdo enquanto carrega
    expect(container.querySelector(".animate-spin")).toBeTruthy();
    expect(screen.queryByText("HOME_APP")).not.toBeInTheDocument();
    expect(screen.queryByText("WELCOME_PAGE")).not.toBeInTheDocument();
    expect(screen.queryByText("AUTH_PAGE")).not.toBeInTheDocument();
  });

  it("Cenário 1 — primeiro acesso sem login redireciona para /welcome", () => {
    useAuthMock.mockReturnValue({ user: null, loading: false, signOut: vi.fn() });

    renderAt("/");

    expect(screen.getByText("WELCOME_PAGE")).toBeInTheDocument();
    // Marca a sessão como visitada para próximas navegações
    expect(sessionStorage.getItem("gavetta:session-visited")).toBe("1");
  });

  it("Cenário 2 — segundo acesso na mesma sessão sem login vai para /auth", () => {
    sessionStorage.setItem("gavetta:session-visited", "1");
    useAuthMock.mockReturnValue({ user: null, loading: false, signOut: vi.fn() });

    renderAt("/");

    expect(screen.getByText("AUTH_PAGE")).toBeInTheDocument();
    expect(screen.queryByText("WELCOME_PAGE")).not.toBeInTheDocument();
  });

  it("Cenário 3 — usuário logado entra direto na home do app", () => {
    useAuthMock.mockReturnValue({
      user: { id: "user-123" } as never,
      loading: false,
      signOut: vi.fn(),
    });

    renderAt("/");

    expect(screen.getByText("HOME_APP")).toBeInTheDocument();
    expect(screen.queryByText("WELCOME_PAGE")).not.toBeInTheDocument();
    expect(screen.queryByText("AUTH_PAGE")).not.toBeInTheDocument();
  });

  it("Cenário 4 — login marca a sessão como visitada (logout posterior cai em /auth)", () => {
    expect(sessionStorage.getItem("gavetta:session-visited")).toBeNull();

    useAuthMock.mockReturnValue({
      user: { id: "user-123" } as never,
      loading: false,
      signOut: vi.fn(),
    });

    renderAt("/");

    // O effect roda no mount: usuário logado → marca sessão visitada
    expect(sessionStorage.getItem("gavetta:session-visited")).toBe("1");
  });

  it("Cenário 5 — refresh de página dentro da mesma sessão sem login vai para /auth", () => {
    // Simula: usuário viu /welcome, foi para /auth, e dá F5 numa rota protegida
    sessionStorage.setItem("gavetta:session-visited", "1");
    useAuthMock.mockReturnValue({ user: null, loading: false, signOut: vi.fn() });

    renderAt("/");

    expect(screen.getByText("AUTH_PAGE")).toBeInTheDocument();
  });

  it("Cenário 6 — sessão nova (após fechar/abrir navegador) sem login volta para /welcome", () => {
    // Estado inicial: usuário tinha visitado, mas fechou o navegador
    // -> sessionStorage foi limpo pelo navegador, simulamos com clear()
    sessionStorage.clear();
    useAuthMock.mockReturnValue({ user: null, loading: false, signOut: vi.fn() });

    renderAt("/");

    expect(screen.getByText("WELCOME_PAGE")).toBeInTheDocument();
  });

  it("Cenário 7 — fail-safe: sessionStorage indisponível trata como visitado e vai para /auth", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    useAuthMock.mockReturnValue({ user: null, loading: false, signOut: vi.fn() });

    renderAt("/");

    // Fail-safe evita loop em /welcome quando o storage está bloqueado
    expect(screen.getByText("AUTH_PAGE")).toBeInTheDocument();
  });
});

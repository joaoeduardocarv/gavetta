import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import GavettaPlus from "./GavettaPlus";

const mockUseGavettaPlusEnabled = vi.fn();
const mockUseIsPremium = vi.fn();
const mockStartBillingCheckout = vi.fn();

vi.mock("@/lib/gavettaPlus", () => ({
  GAVETTA_PLUS_ENABLED: false,
  useGavettaPlusEnabled: () => mockUseGavettaPlusEnabled(),
}));

vi.mock("@/hooks/useIsPremium", () => ({
  useIsPremium: () => mockUseIsPremium(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1", email: "user@example.com", user_metadata: { full_name: "Ana Silva" } },
    loading: false,
  }),
}));

vi.mock("@/lib/billing", () => ({
  startBillingCheckout: (...args: unknown[]) => mockStartBillingCheckout(...args),
}));

vi.mock("@/components/Header", () => ({
  Header: () => <header data-testid="header" />,
}));

vi.mock("@/components/BottomNav", () => ({
  BottomNav: () => <nav data-testid="bottom-nav" />,
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/gavetta-plus"]}>
          <Routes>
            <Route path="/gavetta-plus" element={<GavettaPlus />} />
            <Route path="/" element={<div>Página inicial</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>,
  );
}

describe("GavettaPlus page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    mockUseGavettaPlusEnabled.mockReturnValue({ enabled: true, isLoading: false });
    mockUseIsPremium.mockReturnValue({ isPremium: false, subscription: null, isLoading: false });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("redireciona para / quando a flag está desligada para o usuário", () => {
    mockUseGavettaPlusEnabled.mockReturnValue({ enabled: false, isLoading: false });
    renderPage();
    expect(screen.getByText("Página inicial")).toBeInTheDocument();
  });

  it("mostra 'Você já é Gavetta+' e link para gerenciar quando já é assinante", () => {
    mockUseIsPremium.mockReturnValue({
      isPremium: true,
      subscription: { plan: "yearly", current_period_end: "2027-11-25T00:00:00Z" },
      isLoading: false,
    });
    renderPage();
    expect(screen.getByText("Você já é Gavetta+")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Gerenciar assinatura/i })).toHaveAttribute("href", "/profile");
  });

  it("exibe comparativo, planos anual (economize 37%) e mensal, e valida CPF no dialog", async () => {
    renderPage();
    expect(screen.getByText("Gavetta+: mais do seu cinema, sem anúncios")).toBeInTheDocument();
    expect(screen.getByText("economize 37%")).toBeInTheDocument();
    expect(screen.getByText("R$ 59,90")).toBeInTheDocument();
    expect(screen.getByText("R$ 7,90")).toBeInTheDocument();
    expect(screen.getByText("5/mês")).toBeInTheDocument();
    expect(screen.getByText("Ilimitada")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Assinar Gavetta\+/i }));
    const cpfInput = await screen.findByLabelText("CPF");
    fireEvent.change(cpfInput, { target: { value: "11111111111" } });
    expect((cpfInput as HTMLInputElement).value).toBe("111.111.111-11");

    fireEvent.click(screen.getByRole("button", { name: /Gerar QR Code Pix/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/CPF inválido/i);
    expect(mockStartBillingCheckout).not.toHaveBeenCalled();
  });

  it("exibe QR Code Pix e muda para tela de sucesso quando Realtime ativa a assinatura", async () => {
    mockStartBillingCheckout.mockResolvedValue({
      subscriptionId: "sub-1",
      plan: "yearly",
      method: "pix",
      value: 59.9,
      qrCodeBase64: "iVBORw0KGgo=",
      pixCopyPaste: "00020126580014br.gov.bcb.pix",
      expirationDate: "2026-11-26T17:00:00Z",
    });

    const { rerender } = renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Assinar Gavetta\+/i }));
    fireEvent.change(await screen.findByLabelText("CPF"), { target: { value: "52998224725" } });
    fireEvent.click(screen.getByRole("button", { name: /Gerar QR Code Pix/i }));

    expect(await screen.findByRole("button", { name: /Copiar código Pix/i })).toBeInTheDocument();
    expect(screen.getByAltText(/QR Code Pix/i)).toBeInTheDocument();

    // Simula Realtime atualizando isPremium para true
    mockUseIsPremium.mockReturnValue({
      isPremium: true,
      subscription: { plan: "yearly", status: "active" },
      isLoading: false,
    });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    rerender(
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/gavetta-plus"]}>
            <Routes>
              <Route path="/gavetta-plus" element={<GavettaPlus />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </HelmetProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Bem-vindo ao Gavetta+!")).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /Ver minhas estatísticas/i })).toHaveAttribute(
      "href",
      "/profile#estatisticas",
    );
  });

  it("mostra 'Confirmando pagamento…' no cartão e mensagem amigável após timeout de 2 minutos", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    mockStartBillingCheckout.mockResolvedValue({
      subscriptionId: "sub-2",
      plan: "yearly",
      method: "credit_card",
      value: 59.9,
      invoiceUrl: "https://sandbox.asaas.com/i/test123",
    });

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Assinar Gavetta\+/i }));
    fireEvent.change(await screen.findByLabelText("CPF"), { target: { value: "52998224725" } });
    fireEvent.click(screen.getByRole("radio", { name: /Cartão/i }));

    vi.useFakeTimers({ shouldAdvanceTime: true });
    fireEvent.click(screen.getByRole("button", { name: /Continuar para pagamento/i }));

    expect(await screen.findByText("Confirmando pagamento…")).toBeInTheDocument();
    expect(openSpy).toHaveBeenCalledWith("https://sandbox.asaas.com/i/test123", "_blank", "noopener,noreferrer");

    act(() => {
      vi.advanceTimersByTime(120_000);
    });

    expect(await screen.findByText("Ainda aguardando confirmação")).toBeInTheDocument();
    openSpy.mockRestore();
  });
});
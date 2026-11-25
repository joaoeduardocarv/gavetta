import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PremiumGate } from "./PremiumGate";

const mockUseIsPremium = vi.fn();
const mockUseGavettaPlusEnabled = vi.fn();
const mockTrackEvent = vi.fn();

vi.mock("@/hooks/useIsPremium", () => ({
  useIsPremium: () => mockUseIsPremium(),
}));

vi.mock("@/lib/gavettaPlus", () => ({
  useGavettaPlusEnabled: () => mockUseGavettaPlusEnabled(),
}));

vi.mock("@/hooks/useAnalytics", () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

function renderGate(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("PremiumGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGavettaPlusEnabled.mockReturnValue({ enabled: true, isLoading: false });
    mockUseIsPremium.mockReturnValue({
      isPremium: false,
      subscription: null,
      isLoading: false,
    });
  });

  it("renderiza o conteúdo quando o usuário é premium", () => {
    mockUseIsPremium.mockReturnValue({
      isPremium: true,
      subscription: { id: "sub-1", status: "active" },
      isLoading: false,
    });

    renderGate(
      <PremiumGate feature="stats">
        <div>Estatísticas avançadas</div>
      </PremiumGate>,
    );

    expect(screen.getByText("Estatísticas avançadas")).toBeInTheDocument();
    expect(screen.queryByText("Recurso do Gavetta+")).not.toBeInTheDocument();
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  it("mostra o card padrão com link para /gavetta-plus e registra paywall_view quando não é premium", () => {
    renderGate(
      <PremiumGate feature="stats">
        <div>Estatísticas avançadas</div>
      </PremiumGate>,
    );

    expect(screen.queryByText("Estatísticas avançadas")).not.toBeInTheDocument();
    expect(screen.getByText("Recurso do Gavetta+")).toBeInTheDocument();

    const cta = screen.getByRole("link", { name: "Conhecer o Gavetta+" });
    expect(cta).toHaveAttribute("href", "/gavetta-plus");
    expect(mockTrackEvent).toHaveBeenCalledTimes(1);
    expect(mockTrackEvent).toHaveBeenCalledWith("paywall_view", { feature: "stats" });
  });

  it("mostra o fallback customizado quando fornecido e usuário não é premium", () => {
    renderGate(
      <PremiumGate feature="stats" fallback={<div>Prévia bloqueada</div>}>
        <div>Estatísticas avançadas</div>
      </PremiumGate>,
    );

    expect(screen.getByText("Prévia bloqueada")).toBeInTheDocument();
    expect(screen.queryByText("Estatísticas avançadas")).not.toBeInTheDocument();
    expect(screen.queryByText("Recurso do Gavetta+")).not.toBeInTheDocument();
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  it("exibe estado de carregamento sem mostrar conteúdo nem paywall enquanto carrega", () => {
    mockUseIsPremium.mockReturnValue({
      isPremium: false,
      subscription: null,
      isLoading: true,
    });

    renderGate(
      <PremiumGate feature="stats">
        <div>Estatísticas avançadas</div>
      </PremiumGate>,
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("Estatísticas avançadas")).not.toBeInTheDocument();
    expect(screen.queryByText("Recurso do Gavetta+")).not.toBeInTheDocument();
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  it("mostra o conteúdo normalmente quando a flag de lançamento está desligada", () => {
    mockUseGavettaPlusEnabled.mockReturnValue({ enabled: false, isLoading: false });
    mockUseIsPremium.mockReturnValue({
      isPremium: false,
      subscription: null,
      isLoading: false,
    });

    renderGate(
      <PremiumGate feature="stats">
        <div>Estatísticas avançadas</div>
      </PremiumGate>,
    );

    expect(screen.getByText("Estatísticas avançadas")).toBeInTheDocument();
    expect(screen.queryByText("Recurso do Gavetta+")).not.toBeInTheDocument();
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });
});
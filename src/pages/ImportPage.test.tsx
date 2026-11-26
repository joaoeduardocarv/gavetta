import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ImportPage from "./ImportPage";
import { ImportQuotaError } from "@/lib/importFromLink";

const mockUseGavettaPlusEnabled = vi.fn();
const mockUseIsPremium = vi.fn();
const mockTrackEvent = vi.fn();
const mockExtractTitlesFromSource = vi.fn();
const mockFetchMonthlyImportUsageCount = vi.fn();

vi.mock("@/lib/gavettaPlus", () => ({
  GAVETTA_PLUS_ENABLED: false,
  useGavettaPlusEnabled: () => mockUseGavettaPlusEnabled(),
}));

vi.mock("@/hooks/useIsPremium", () => ({
  useIsPremium: () => mockUseIsPremium(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "user-1" }, loading: false }),
}));

vi.mock("@/hooks/useAnalytics", () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

vi.mock("@/components/Header", () => ({ Header: () => null }));
vi.mock("@/components/BottomNav", () => ({ BottomNav: () => null }));
vi.mock("@/components/ImportQueueDialog", () => ({ ImportQueueDialog: () => null }));

vi.mock("@/lib/importFromLink", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/importFromLink")>();
  return {
    ...actual,
    extractTitlesFromSource: (...args: unknown[]) => mockExtractTitlesFromSource(...args),
    fetchMonthlyImportUsageCount: (...args: unknown[]) => mockFetchMonthlyImportUsageCount(...args),
    fetchRunningImportJob: vi.fn().mockResolvedValue(null),
  };
});

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ImportPage />
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>,
  );
}

describe("ImportPage — cota mensal e Gavetta+", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchMonthlyImportUsageCount.mockResolvedValue(3);
  });

  it("mostra '3 de 5 importações usadas este mês' e PremiumGate no lugar da opção de áudio para plano grátis", async () => {
    mockUseGavettaPlusEnabled.mockReturnValue({ enabled: true, isLoading: false });
    mockUseIsPremium.mockReturnValue({ isPremium: false, subscription: null, isLoading: false });

    renderPage();

    expect(await screen.findByText("3 de 5 importações usadas este mês")).toBeTruthy();
    expect(screen.getByText("Recurso do Gavetta+")).toBeTruthy();
    expect(screen.queryByText(/Episódios longos podem levar alguns minutos/i)).toBeNull();
  });

  it("abre o card do Gavetta+ (feature 'import') ao receber IMPORT_QUOTA", async () => {
    mockUseGavettaPlusEnabled.mockReturnValue({ enabled: true, isLoading: false });
    mockUseIsPremium.mockReturnValue({ isPremium: false, subscription: null, isLoading: false });
    mockExtractTitlesFromSource.mockRejectedValueOnce(
      new ImportQuotaError({
        used: 5,
        limit: 5,
        resetsAt: "2026-12-01T00:00:00.000Z",
      }),
    );

    renderPage();

    const textarea = screen.getByLabelText("Link ou texto do conteúdo");
    fireEvent.change(textarea, { target: { value: "Indico o filme Interestelar (2014)!" } });
    fireEvent.click(screen.getByRole("button", { name: /Encontrar filmes e séries/i }));

    await waitFor(() => {
      expect(screen.getByTestId("import-quota-paywall")).toBeTruthy();
    });
    expect(mockTrackEvent).toHaveBeenCalledWith("paywall_view", { feature: "import" });
  });

  it("não altera nada para o usuário comum quando GAVETTA_PLUS_ENABLED está desligada", () => {
    mockUseGavettaPlusEnabled.mockReturnValue({ enabled: false, isLoading: false });
    mockUseIsPremium.mockReturnValue({ isPremium: false, subscription: null, isLoading: false });

    renderPage();

    expect(screen.queryByTestId("import-quota-counter")).toBeNull();
    expect(screen.queryByText("Recurso do Gavetta+")).toBeNull();
    expect(screen.getByText(/Episódios longos podem levar alguns minutos/i)).toBeTruthy();
  });
});
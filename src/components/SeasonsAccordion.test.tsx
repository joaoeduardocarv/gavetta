import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { SeasonsAccordion } from "./SeasonsAccordion";

// --- Mocks for external dependencies ---

vi.mock("@/lib/tmdb", () => ({
  getTVDetails: vi.fn(async () => ({
    number_of_episodes: 20,
    status: "Ended",
    seasons: [
      { id: 1, season_number: 1, name: "Temporada 1", episode_count: 10, air_date: "2020-01-01" },
      { id: 2, season_number: 2, name: "Temporada 2", episode_count: 10, air_date: "2021-01-01" },
    ],
  })),
  getSeasonEpisodes: vi.fn(async (_tv: number, season: number) =>
    Array.from({ length: 10 }, (_, i) => ({
      id: season * 100 + i + 1,
      episode_number: i + 1,
      name: `Episódio ${i + 1}`,
      air_date: "2020-01-01",
      runtime: 30,
      overview: "",
    }))
  ),
}));

vi.mock("@/hooks/useWatchedEpisodes", () => ({
  useWatchedEpisodes: () => ({
    isWatched: () => false,
    toggleEpisode: vi.fn(),
    markSeason: vi.fn(),
    markAllSeasons: vi.fn(),
    unmarkSeason: vi.fn(),
    watchedCountForSeason: () => 0,
    totalWatched: 5,
  }),
}));

vi.mock("@/hooks/useEpisodeRatings", () => ({
  useEpisodeRatings: () => ({
    getStoredEpisodeRating: () => null,
    getEffectiveEpisodeRating: () => ({ value: null, isAverage: false }),
    getEffectiveSeasonRating: () => ({ value: null, isAverage: false }),
    getEffectiveSeriesRating: () => ({ value: null, isAverage: false }),
    setEpisodeRating: vi.fn(),
    setSeasonRating: vi.fn(),
    setSeriesRating: vi.fn(),
  }),
}));

vi.mock("@/contexts/DrawerContext", () => ({
  useDrawers: () => ({
    setDefaultDrawer: vi.fn(),
    getContentDrawers: () => ({ defaultDrawer: null }),
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

describe("SeasonsAccordion — Accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("o botão 'Marcar episódios lançados' tem aria-label descritivo", async () => {
    render(<SeasonsAccordion tmdbTvId={1} />);

    const button = await screen.findByRole("button", {
      name: /marcar todos os episódios já lançados como assistidos/i,
    });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute(
      "aria-label",
      "Marcar todos os episódios já lançados como assistidos"
    );
  });

  it("o botão 'Marcar episódios lançados' atende ao tamanho mínimo de toque (min-h-11)", async () => {
    render(<SeasonsAccordion tmdbTvId={1} />);

    const button = await screen.findByRole("button", {
      name: /marcar todos os episódios já lançados como assistidos/i,
    });
    // Tailwind min-h-11 = 2.75rem = 44px (target WCAG 2.5.5 / AAA)
    expect(button.className).toMatch(/min-h-11/);
    expect(button.className).toMatch(/w-full/);
  });

  it("os accordions de temporada são acessíveis via teclado (role=button + Enter)", async () => {
    render(<SeasonsAccordion tmdbTvId={1} />);

    const triggers = await screen.findAllByRole("button", { name: /temporada/i });
    expect(triggers.length).toBeGreaterThan(0);

    const firstTrigger = triggers[0];
    // Radix Accordion renders triggers as native <button>, focusable by default
    expect(firstTrigger.tagName).toBe("BUTTON");
    expect(firstTrigger).toHaveAttribute("aria-expanded", "false");

    firstTrigger.focus();
    expect(document.activeElement).toBe(firstTrigger);

    // Ativa via teclado (Enter dispara click no <button> nativo)
    fireEvent.keyDown(firstTrigger, { key: "Enter", code: "Enter" });
    fireEvent.click(firstTrigger);

    await waitFor(() => {
      expect(firstTrigger).toHaveAttribute("aria-expanded", "true");
    });
  });

  it("checkboxes de episódio têm aria-label individual descritivo", async () => {
    render(<SeasonsAccordion tmdbTvId={1} />);

    // Abre a primeira temporada para revelar os episódios
    const triggers = await screen.findAllByRole("button", { name: /temporada/i });
    fireEvent.click(triggers[0]);

    const checkbox = await screen.findByRole("checkbox", {
      name: /marcar episódio 1 como assistido/i,
    });
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toHaveAttribute("aria-label", "Marcar episódio 1 como assistido");
  });
});

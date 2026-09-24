import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuickStartLibrary } from "./QuickStartLibrary";

const quickAddToWatch = vi.fn();
const toast = vi.fn();

vi.mock("@/contexts/DrawerContext", () => ({
  useDrawers: () => ({
    assignments: [],
    setDefaultDrawer: vi.fn(),
    quickAddToWatch,
    pendingWatchedAssignment: null,
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast }),
}));

vi.mock("@/lib/tmdb", () => ({
  getTrendingMovies: vi.fn(async () => [
    { id: 1, title: "Filme um", overview: "", poster_path: "/one.jpg", backdrop_path: null, release_date: "2026-01-01", vote_average: 7, genre_ids: [], popularity: 10 },
    { id: 2, title: "Filme dois", overview: "", poster_path: "/two.jpg", backdrop_path: null, release_date: "2026-01-02", vote_average: 7, genre_ids: [], popularity: 9 },
    { id: 3, title: "Filme três", overview: "", poster_path: "/three.jpg", backdrop_path: null, release_date: "2026-01-03", vote_average: 7, genre_ids: [], popularity: 8 },
  ]),
  getTrendingTV: vi.fn(async () => [
    { id: 4, name: "Série um", overview: "", poster_path: "/four.jpg", backdrop_path: null, first_air_date: "2026-01-04", vote_average: 7, genre_ids: [], popularity: 7 },
    { id: 5, name: "Série dois", overview: "", poster_path: "/five.jpg", backdrop_path: null, first_air_date: "2026-01-05", vote_average: 7, genre_ids: [], popularity: 6 },
  ]),
  getTMDBImageUrl: (path: string) => `https://image.test${path}`,
}));

describe("QuickStartLibrary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function openLibrary() {
    render(<QuickStartLibrary />);
    act(() => window.dispatchEvent(new Event("gavetta:onboarding-finished")));
    await screen.findByText("Filme um");
  }

  it("avança antes de a gravação terminar", async () => {
    let resolveSave: (() => void) | undefined;
    quickAddToWatch.mockImplementation(() => new Promise<void>((resolve) => {
      resolveSave = resolve;
    }));

    await openLibrary();
    fireEvent.click(screen.getByRole("button", { name: "Quero ver" }));

    expect(screen.getByText("Série um")).toBeInTheDocument();
    expect(quickAddToWatch).toHaveBeenCalledTimes(1);

    act(() => resolveSave?.());
  });

  it("restaura o título quando a gravação falha", async () => {
    quickAddToWatch.mockRejectedValueOnce(new Error("offline"));

    await openLibrary();
    fireEvent.click(screen.getByRole("button", { name: "Quero ver" }));

    await waitFor(() => expect(screen.getByText("Filme um")).toBeInTheDocument());
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      title: "Não foi possível salvar",
    }));
  });
});
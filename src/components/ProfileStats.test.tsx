import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProfileStats } from "./ProfileStats";

vi.mock("@/contexts/DrawerContext", () => ({
  useDrawers: () => ({
    customDrawers: [],
    getDrawerContents: (drawerId: string) => drawerId === "watched" ? [{ id: "movie-1" }] : [],
  }),
}));

describe("ProfileStats", () => {
  it("não exibe nota média no Perfil", () => {
    render(<ProfileStats />);

    expect(screen.queryByText(/nota média/i)).not.toBeInTheDocument();
    expect(screen.getByText("Total de títulos")).toBeInTheDocument();
  });
});
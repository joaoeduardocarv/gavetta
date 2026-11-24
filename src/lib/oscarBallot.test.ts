import { describe, it, expect } from "vitest";
import { isOptionSelected, shareableCategories, SKIPPED_PICK } from "./oscarBallot";

describe("shareableCategories", () => {
  it("removes categories marked as 'Não vi' and unanswered ones from the share image", () => {
    const cats = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const picks = { a: { kind: "film" as const, tmdb_id: 1, title: "X", image: null }, b: SKIPPED_PICK };
    expect(shareableCategories(cats, picks).map((r) => r.category.id)).toEqual(["a"]);
  });
});

describe("isOptionSelected", () => {
  it("distinguishes the same person nominated for two different films", () => {
    const pick = { kind: "person" as const, tmdb_id: 955, title: "Penélope Cruz", sub: "O Convite", nominee_id: "n1", image: null };
    expect(isOptionSelected(pick, { kind: "person", tmdb_id: 955, title: "Penélope Cruz", sub: "O Convite", nominee_id: "n1" })).toBe(true);
    expect(isOptionSelected(pick, { kind: "person", tmdb_id: 955, title: "Penélope Cruz", sub: "A Bola Preta", nominee_id: "n2" })).toBe(false);
  });
});

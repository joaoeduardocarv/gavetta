import { describe, it, expect } from "vitest";
import { shareableCategories, SKIPPED_PICK } from "./oscarBallot";

describe("shareableCategories", () => {
  it("removes categories marked as 'Não vi' and unanswered ones from the share image", () => {
    const cats = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const picks = { a: { kind: "film" as const, tmdb_id: 1, title: "X", image: null }, b: SKIPPED_PICK };
    expect(shareableCategories(cats, picks).map((r) => r.category.id)).toEqual(["a"]);
  });
});

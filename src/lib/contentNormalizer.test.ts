import { describe, expect, it } from "vitest";

import { extractTmdbInfoFromId, normalizeStoredContent } from "@/lib/contentNormalizer";

describe("contentNormalizer TMDB identifiers", () => {
  it("keeps legacy numeric IDs local instead of inventing a TMDB identifier", () => {
    const content = normalizeStoredContent(
      { id: "8", type: "series", title: "Succession" },
      { productionId: "8", productionType: "tv" },
    );

    expect(content.id).toBe("8");
    expect(extractTmdbInfoFromId(content.id)).toBeNull();
  });

  it("uses a canonical production ID when the stored payload still has a numeric ID", () => {
    const content = normalizeStoredContent(
      { id: "8", type: "series", title: "Succession" },
      { productionId: "tv-76331", productionType: "tv" },
    );

    expect(content.id).toBe("tv-76331");
    expect(extractTmdbInfoFromId(content.id)).toEqual({ mediaType: "tv", tmdbId: 76331 });
  });

  it("preserves canonical movie IDs", () => {
    const content = normalizeStoredContent(
      { id: "movie-157336", type: "movie", title: "Interestelar" },
      { productionId: "movie-157336", productionType: "movie" },
    );

    expect(content.id).toBe("movie-157336");
    expect(extractTmdbInfoFromId(content.id)).toEqual({ mediaType: "movie", tmdbId: 157336 });
  });
});
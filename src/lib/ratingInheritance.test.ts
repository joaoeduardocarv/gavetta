import { describe, it, expect } from "vitest";
import {
  makeKey,
  getEffectiveEpisodeRating,
  getEffectiveSeasonRating,
  getEffectiveSeriesRating,
  type RatingsMap,
} from "./ratingInheritance";

/** Helper to build a ratings map fluently. */
function buildRatings(
  entries: Array<{ season: number | null; episode: number | null; rating: number }>
): RatingsMap {
  const map: RatingsMap = new Map();
  for (const { season, episode, rating } of entries) {
    map.set(makeKey(season, episode), rating);
  }
  return map;
}

describe("rating inheritance: Series → Season → Episode", () => {
  describe("Series rating propagation (top-down)", () => {
    it("propagates explicit series rating to seasons without their own rating", () => {
      const ratings = buildRatings([{ season: null, episode: null, rating: 8 }]);

      const s1 = getEffectiveSeasonRating(ratings, 1);
      const s2 = getEffectiveSeasonRating(ratings, 2);

      expect(s1).toEqual({ value: 8, isAverage: true });
      expect(s2).toEqual({ value: 8, isAverage: true });
    });

    it("propagates explicit series rating to episodes without their own rating", () => {
      const ratings = buildRatings([{ season: null, episode: null, rating: 7 }]);

      expect(getEffectiveEpisodeRating(ratings, 1, 1)).toEqual({
        value: 7,
        isAverage: true,
      });
      expect(getEffectiveEpisodeRating(ratings, 5, 12)).toEqual({
        value: 7,
        isAverage: true,
      });
    });

    it("series rating overrides bottom-up averages from old episode ratings", () => {
      // Old episode ratings exist; user later rates the whole series at 9.
      // Per rule "explicit always wins": series=9 must beat episode-average for the season.
      const ratings = buildRatings([
        { season: 1, episode: 1, rating: 4 },
        { season: 1, episode: 2, rating: 5 },
        { season: null, episode: null, rating: 9 },
      ]);

      // Season inherits explicit series rating (not the 4.5 avg)
      expect(getEffectiveSeasonRating(ratings, 1)).toEqual({
        value: 9,
        isAverage: true,
      });
      // Episode WITHOUT its own rating inherits series
      expect(getEffectiveEpisodeRating(ratings, 1, 3)).toEqual({
        value: 9,
        isAverage: true,
      });
    });
  });

  describe("Explicit ratings always win over inheritance", () => {
    it("explicit episode rating beats season inheritance", () => {
      const ratings = buildRatings([
        { season: null, episode: null, rating: 9 },
        { season: 1, episode: null, rating: 6 },
        { season: 1, episode: 1, rating: 3 },
      ]);

      expect(getEffectiveEpisodeRating(ratings, 1, 1)).toEqual({
        value: 3,
        isAverage: false,
      });
    });

    it("explicit season rating beats series inheritance", () => {
      const ratings = buildRatings([
        { season: null, episode: null, rating: 9 },
        { season: 2, episode: null, rating: 4 },
      ]);

      expect(getEffectiveSeasonRating(ratings, 2)).toEqual({
        value: 4,
        isAverage: false,
      });
      // Other seasons still inherit from series
      expect(getEffectiveSeasonRating(ratings, 1)).toEqual({
        value: 9,
        isAverage: true,
      });
    });

    it("old explicit episode rating is preserved even when series rating exists", () => {
      // User rated S1E1=10 long ago. Then later rates the series=5.
      // The episode keeps its explicit 10.
      const ratings = buildRatings([
        { season: 1, episode: 1, rating: 10 },
        { season: null, episode: null, rating: 5 },
      ]);

      expect(getEffectiveEpisodeRating(ratings, 1, 1)).toEqual({
        value: 10,
        isAverage: false,
      });
      // Sibling without own rating inherits the series value
      expect(getEffectiveEpisodeRating(ratings, 1, 2)).toEqual({
        value: 5,
        isAverage: true,
      });
    });
  });

  describe("Bottom-up averaging (fallback)", () => {
    it("averages stored episodes for a season when no explicit season/series rating exists", () => {
      const ratings = buildRatings([
        { season: 1, episode: 1, rating: 8 },
        { season: 1, episode: 2, rating: 6 },
        { season: 1, episode: 3, rating: 7 },
      ]);

      expect(getEffectiveSeasonRating(ratings, 1)).toEqual({
        value: 7,
        isAverage: true,
      });
    });

    it("series rating averages effective season ratings (mix of explicit + averaged)", () => {
      const ratings = buildRatings([
        { season: 1, episode: null, rating: 8 }, // explicit season 1 = 8
        { season: 2, episode: 1, rating: 6 }, // season 2 averaged = 6
        { season: 2, episode: 2, rating: 6 },
      ]);

      expect(getEffectiveSeriesRating(ratings, [1, 2])).toEqual({
        value: 7,
        isAverage: true,
      });
    });

    it("returns null when there is no rating at any level", () => {
      const ratings: RatingsMap = new Map();
      expect(getEffectiveEpisodeRating(ratings, 1, 1)).toEqual({
        value: null,
        isAverage: false,
      });
      expect(getEffectiveSeasonRating(ratings, 1)).toEqual({
        value: null,
        isAverage: false,
      });
      expect(getEffectiveSeriesRating(ratings, [1, 2])).toEqual({
        value: null,
        isAverage: false,
      });
    });

    it("does not mix episodes from different seasons into the average", () => {
      const ratings = buildRatings([
        { season: 1, episode: 1, rating: 10 },
        { season: 2, episode: 1, rating: 2 },
      ]);

      expect(getEffectiveSeasonRating(ratings, 1)).toEqual({
        value: 10,
        isAverage: true,
      });
      expect(getEffectiveSeasonRating(ratings, 2)).toEqual({
        value: 2,
        isAverage: true,
      });
    });
  });

  describe("Series-level effective rating", () => {
    it("explicit series rating wins over season averages", () => {
      const ratings = buildRatings([
        { season: 1, episode: null, rating: 4 },
        { season: 2, episode: null, rating: 4 },
        { season: null, episode: null, rating: 10 },
      ]);

      expect(getEffectiveSeriesRating(ratings, [1, 2])).toEqual({
        value: 10,
        isAverage: false,
      });
    });

    it("rounds bottom-up averages to one decimal place", () => {
      const ratings = buildRatings([
        { season: 1, episode: null, rating: 7 },
        { season: 2, episode: null, rating: 8 },
        { season: 3, episode: null, rating: 8 },
      ]);

      // (7 + 8 + 8) / 3 = 7.666… → 7.7
      expect(getEffectiveSeriesRating(ratings, [1, 2, 3])).toEqual({
        value: 7.7,
        isAverage: true,
      });
    });
  });

  describe("Edge case: legacy episode ratings + new series rating", () => {
    it("series rating overrides season averages computed from old episodes (regression)", () => {
      // The reported bug: user had old episode ratings; later rated the series
      // and expected the series value to propagate. Previously the season
      // showed the bottom-up average instead of inheriting the series rating.
      const ratings = buildRatings([
        { season: 1, episode: 1, rating: 2 },
        { season: 1, episode: 2, rating: 3 },
        { season: 2, episode: 1, rating: 4 },
        { season: null, episode: null, rating: 8 },
      ]);

      expect(getEffectiveSeasonRating(ratings, 1).value).toBe(8);
      expect(getEffectiveSeasonRating(ratings, 2).value).toBe(8);
      // Episodes without explicit rating inherit series
      expect(getEffectiveEpisodeRating(ratings, 1, 5).value).toBe(8);
      expect(getEffectiveEpisodeRating(ratings, 2, 2).value).toBe(8);
      // Episodes WITH explicit rating keep it
      expect(getEffectiveEpisodeRating(ratings, 1, 1).value).toBe(2);
      expect(getEffectiveEpisodeRating(ratings, 1, 2).value).toBe(3);
    });
  });
});

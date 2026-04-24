/**
 * Pure functions for computing effective ratings across the
 * Series → Season → Episode hierarchy.
 *
 * Storage model (mirrors the `episode_ratings` table):
 *  - episode-level: season + episode set
 *  - season-level:  season set, episode = null
 *  - series-level:  both null
 *
 * Map keys use `${season ?? "S"}:${episode ?? "S"}`, where "S" represents NULL.
 *
 * Rule of thumb: **explicit always wins**. A stored rating at a more specific
 * level overrides any inherited value from a higher level.
 */

export type RatingsMap = Map<string, number>;

export interface EffectiveRating {
  value: number | null;
  /** True when the value was inherited or averaged, not set explicitly. */
  isAverage: boolean;
}

export const makeKey = (
  season: number | null,
  episode: number | null
): string => `${season ?? "S"}:${episode ?? "S"}`;

// ---------- Stored (raw) accessors ----------
export const getStoredEpisodeRating = (
  ratings: RatingsMap,
  season: number,
  episode: number
): number | undefined => ratings.get(makeKey(season, episode));

export const getStoredSeasonRating = (
  ratings: RatingsMap,
  season: number
): number | undefined => ratings.get(makeKey(season, null));

export const getStoredSeriesRating = (
  ratings: RatingsMap
): number | undefined => ratings.get(makeKey(null, null));

// ---------- Effective (computed) accessors ----------
/**
 * Effective season rating priority:
 *  1. Explicit season rating
 *  2. Explicit series rating (top-down inheritance — explicit always wins)
 *  3. Average of stored episode ratings for the season (bottom-up)
 */
export function getEffectiveSeasonRating(
  ratings: RatingsMap,
  season: number
): EffectiveRating {
  const explicit = getStoredSeasonRating(ratings, season);
  if (explicit != null) return { value: explicit, isAverage: false };

  const series = getStoredSeriesRating(ratings);
  if (series != null) return { value: series, isAverage: true };

  const eps: number[] = [];
  ratings.forEach((value, key) => {
    const [s, e] = key.split(":");
    if (s === String(season) && e !== "S") eps.push(value);
  });
  if (eps.length > 0) {
    const avg = eps.reduce((a, b) => a + b, 0) / eps.length;
    return { value: Math.round(avg * 10) / 10, isAverage: true };
  }
  return { value: null, isAverage: false };
}

/**
 * Effective episode rating priority:
 *  1. Explicit episode rating
 *  2. Explicit season rating (top-down)
 *  3. Explicit series rating (top-down)
 */
export function getEffectiveEpisodeRating(
  ratings: RatingsMap,
  season: number,
  episode: number
): EffectiveRating {
  const explicit = getStoredEpisodeRating(ratings, season, episode);
  if (explicit != null) return { value: explicit, isAverage: false };

  const seasonExplicit = getStoredSeasonRating(ratings, season);
  if (seasonExplicit != null) return { value: seasonExplicit, isAverage: true };

  const series = getStoredSeriesRating(ratings);
  if (series != null) return { value: series, isAverage: true };

  return { value: null, isAverage: false };
}

/**
 * Effective series rating priority:
 *  1. Explicit series rating
 *  2. Average of effective season ratings (bottom-up)
 */
export function getEffectiveSeriesRating(
  ratings: RatingsMap,
  seasonNumbers: number[]
): EffectiveRating {
  const explicit = getStoredSeriesRating(ratings);
  if (explicit != null) return { value: explicit, isAverage: false };

  const seasonValues: number[] = [];
  seasonNumbers.forEach((s) => {
    const eff = getEffectiveSeasonRating(ratings, s);
    if (eff.value != null) seasonValues.push(eff.value);
  });
  if (seasonValues.length === 0) return { value: null, isAverage: false };
  const avg = seasonValues.reduce((a, b) => a + b, 0) / seasonValues.length;
  return { value: Math.round(avg * 10) / 10, isAverage: true };
}

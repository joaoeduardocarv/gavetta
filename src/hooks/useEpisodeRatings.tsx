import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  makeKey,
  getStoredEpisodeRating as pureGetStoredEpisodeRating,
  getStoredSeasonRating as pureGetStoredSeasonRating,
  getStoredSeriesRating as pureGetStoredSeriesRating,
  getEffectiveEpisodeRating as pureGetEffectiveEpisodeRating,
  getEffectiveSeasonRating as pureGetEffectiveSeasonRating,
  getEffectiveSeriesRating as pureGetEffectiveSeriesRating,
} from "@/lib/ratingInheritance";

interface RatingRow {
  season_number: number | null;
  episode_number: number | null;
  rating: number;
}

/**
 * Manages 1-10 ratings the user gives to episodes, seasons, or the whole series.
 *
 * Storage scopes (rows in `episode_ratings`):
 *  - episode: season_number + episode_number set
 *  - season:  season_number set, episode_number = null  → manual override
 *  - series:  both null                                  → manual override
 *
 * If a manual override exists, it wins. Otherwise the value is computed as the
 * average of the level below (episode → season → series).
 */
export function useEpisodeRatings(tmdbTvId: number | null) {
  const { user } = useAuth();
  // Map keyed by `${season ?? "S"}:${episode ?? "S"}`.
  // "S" stands for "series-level" (NULL).
  const [ratings, setRatings] = useState<Map<string, number>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const fetchKey = useRef<string | null>(null);

  const refetch = useCallback(async () => {
    if (!user || tmdbTvId == null) {
      setRatings(new Map());
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("episode_ratings")
        .select("season_number, episode_number, rating")
        .eq("user_id", user.id)
        .eq("tmdb_tv_id", tmdbTvId);
      if (error) throw error;
      const next = new Map<string, number>();
      (data as RatingRow[] | null)?.forEach((r) =>
        next.set(makeKey(r.season_number, r.episode_number), r.rating)
      );
      setRatings(next);
    } catch (err) {
      console.error("Error fetching episode ratings:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user, tmdbTvId]);

  useEffect(() => {
    const key = `${user?.id ?? ""}:${tmdbTvId ?? ""}`;
    if (fetchKey.current === key) return;
    fetchKey.current = key;
    refetch();
  }, [user?.id, tmdbTvId, refetch]);

  // ---------- Stored (raw) accessors ----------
  const getStoredEpisodeRating = useCallback(
    (season: number, episode: number) =>
      pureGetStoredEpisodeRating(ratings, season, episode),
    [ratings]
  );
  const getStoredSeasonRating = useCallback(
    (season: number) => pureGetStoredSeasonRating(ratings, season),
    [ratings]
  );
  const getStoredSeriesRating = useCallback(
    () => pureGetStoredSeriesRating(ratings),
    [ratings]
  );

  // ---------- Effective accessors (delegated to pure module — see ratingInheritance.ts) ----------
  const getEffectiveSeasonRating = useCallback(
    (season: number) => pureGetEffectiveSeasonRating(ratings, season),
    [ratings]
  );
  const getEffectiveEpisodeRating = useCallback(
    (season: number, episode: number) =>
      pureGetEffectiveEpisodeRating(ratings, season, episode),
    [ratings]
  );
  const getEffectiveSeriesRating = useCallback(
    (seasonNumbers: number[]) =>
      pureGetEffectiveSeriesRating(ratings, seasonNumbers),
    [ratings]
  );

  // ---------- Mutations ----------
  /** Generic upsert. Pass season=null & episode=null for series-level. */
  const setRating = useCallback(
    async (
      season: number | null,
      episode: number | null,
      value: number | null
    ) => {
      if (!user || tmdbTvId == null) return;
      const key = makeKey(season, episode);
      const previous = ratings.get(key);

      // Optimistic
      setRatings((prev) => {
        const next = new Map(prev);
        if (value == null) next.delete(key);
        else next.set(key, value);
        return next;
      });

      try {
        if (value == null) {
          let q = supabase
            .from("episode_ratings")
            .delete()
            .eq("user_id", user.id)
            .eq("tmdb_tv_id", tmdbTvId);
          q = season == null ? q.is("season_number", null) : q.eq("season_number", season);
          q = episode == null ? q.is("episode_number", null) : q.eq("episode_number", episode);
          const { error } = await q;
          if (error) throw error;
          return;
        }

        // Upsert via onConflict on the unique scope index.
        const { error } = await supabase
          .from("episode_ratings")
          .upsert(
            {
              user_id: user.id,
              tmdb_tv_id: tmdbTvId,
              season_number: season,
              episode_number: episode,
              rating: value,
            },
            { onConflict: "user_id,tmdb_tv_id,season_number,episode_number" }
          );
        if (error) throw error;
      } catch (err) {
        console.error("Error saving rating:", err);
        // Revert
        setRatings((prev) => {
          const next = new Map(prev);
          if (previous == null) next.delete(key);
          else next.set(key, previous);
          return next;
        });
      }
    },
    [user, tmdbTvId, ratings]
  );

  const setEpisodeRating = useCallback(
    (season: number, episode: number, value: number | null) =>
      setRating(season, episode, value),
    [setRating]
  );
  const setSeasonRating = useCallback(
    (season: number, value: number | null) => setRating(season, null, value),
    [setRating]
  );
  const setSeriesRating = useCallback(
    (value: number | null) => setRating(null, null, value),
    [setRating]
  );

  return useMemo(
    () => ({
      isLoading,
      getStoredEpisodeRating,
      getStoredSeasonRating,
      getStoredSeriesRating,
      getEffectiveEpisodeRating,
      getEffectiveSeasonRating,
      getEffectiveSeriesRating,
      setEpisodeRating,
      setSeasonRating,
      setSeriesRating,
      refetch,
    }),
    [
      isLoading,
      getStoredEpisodeRating,
      getStoredSeasonRating,
      getStoredSeriesRating,
      getEffectiveEpisodeRating,
      getEffectiveSeasonRating,
      getEffectiveSeriesRating,
      setEpisodeRating,
      setSeasonRating,
      setSeriesRating,
      refetch,
    ]
  );
}

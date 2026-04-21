import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface WatchedEpisodeRow {
  season_number: number;
  episode_number: number;
}

/**
 * Manages watched-episode state for a single TV series (by TMDB id).
 * Returns helpers to check, toggle individual episodes, and mark/unmark whole seasons.
 */
export function useWatchedEpisodes(tmdbTvId: number | null) {
  const { user } = useAuth();
  const [watched, setWatched] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const fetchKey = useRef<string | null>(null);

  const makeKey = (s: number, e: number) => `${s}:${e}`;

  const refetch = useCallback(async () => {
    if (!user || tmdbTvId == null) {
      setWatched(new Set());
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("watched_episodes")
        .select("season_number, episode_number")
        .eq("user_id", user.id)
        .eq("tmdb_tv_id", tmdbTvId);
      if (error) throw error;
      const next = new Set<string>();
      (data as WatchedEpisodeRow[] | null)?.forEach((r) =>
        next.add(makeKey(r.season_number, r.episode_number))
      );
      setWatched(next);
    } catch (err) {
      console.error("Error fetching watched episodes:", err);
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

  const isWatched = useCallback(
    (season: number, episode: number) => watched.has(makeKey(season, episode)),
    [watched]
  );

  const watchedCountForSeason = useCallback(
    (season: number) => {
      let count = 0;
      watched.forEach((k) => {
        if (k.startsWith(`${season}:`)) count++;
      });
      return count;
    },
    [watched]
  );

  const totalWatched = watched.size;

  const toggleEpisode = useCallback(
    async (season: number, episode: number) => {
      if (!user || tmdbTvId == null) return;
      const key = makeKey(season, episode);
      const wasWatched = watched.has(key);

      // Optimistic update
      setWatched((prev) => {
        const next = new Set(prev);
        if (wasWatched) next.delete(key);
        else next.add(key);
        return next;
      });

      try {
        if (wasWatched) {
          const { error } = await supabase
            .from("watched_episodes")
            .delete()
            .eq("user_id", user.id)
            .eq("tmdb_tv_id", tmdbTvId)
            .eq("season_number", season)
            .eq("episode_number", episode);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("watched_episodes").insert({
            user_id: user.id,
            tmdb_tv_id: tmdbTvId,
            season_number: season,
            episode_number: episode,
          });
          if (error) throw error;
        }
      } catch (err) {
        console.error("Error toggling episode:", err);
        // Revert
        setWatched((prev) => {
          const next = new Set(prev);
          if (wasWatched) next.add(key);
          else next.delete(key);
          return next;
        });
      }
    },
    [user, tmdbTvId, watched]
  );

  const markSeason = useCallback(
    async (season: number, episodeNumbers: number[]) => {
      if (!user || tmdbTvId == null) return;
      const toAdd = episodeNumbers.filter(
        (ep) => !watched.has(makeKey(season, ep))
      );
      if (toAdd.length === 0) return;

      // Optimistic
      setWatched((prev) => {
        const next = new Set(prev);
        toAdd.forEach((ep) => next.add(makeKey(season, ep)));
        return next;
      });

      try {
        const rows = toAdd.map((ep) => ({
          user_id: user.id,
          tmdb_tv_id: tmdbTvId,
          season_number: season,
          episode_number: ep,
        }));
        const { error } = await supabase
          .from("watched_episodes")
          .insert(rows);
        if (error) throw error;
      } catch (err) {
        console.error("Error marking season:", err);
        await refetch();
      }
    },
    [user, tmdbTvId, watched, refetch]
  );

  const unmarkSeason = useCallback(
    async (season: number) => {
      if (!user || tmdbTvId == null) return;
      const previous = new Set(watched);

      // Optimistic
      setWatched((prev) => {
        const next = new Set(prev);
        next.forEach((k) => {
          if (k.startsWith(`${season}:`)) next.delete(k);
        });
        return next;
      });

      try {
        const { error } = await supabase
          .from("watched_episodes")
          .delete()
          .eq("user_id", user.id)
          .eq("tmdb_tv_id", tmdbTvId)
          .eq("season_number", season);
        if (error) throw error;
      } catch (err) {
        console.error("Error unmarking season:", err);
        setWatched(previous);
      }
    },
      [user, tmdbTvId, watched]
  );

  /**
   * Marks every episode of the entire series as watched, given the list of seasons
   * with their episode counts. Skips already-watched episodes. Excludes season 0 (specials).
   */
  const markAllSeasons = useCallback(
    async (seasonsInfo: { season_number: number; episode_count: number }[]) => {
      if (!user || tmdbTvId == null) return;
      const toAdd: { season: number; episode: number }[] = [];
      seasonsInfo.forEach(({ season_number, episode_count }) => {
        if (season_number <= 0 || !episode_count) return;
        for (let ep = 1; ep <= episode_count; ep++) {
          if (!watched.has(makeKey(season_number, ep))) {
            toAdd.push({ season: season_number, episode: ep });
          }
        }
      });
      if (toAdd.length === 0) return;

      // Optimistic
      setWatched((prev) => {
        const next = new Set(prev);
        toAdd.forEach(({ season, episode }) => next.add(makeKey(season, episode)));
        return next;
      });

      try {
        const rows = toAdd.map(({ season, episode }) => ({
          user_id: user.id,
          tmdb_tv_id: tmdbTvId,
          season_number: season,
          episode_number: episode,
        }));
        const { error } = await supabase.from("watched_episodes").insert(rows);
        if (error) throw error;
      } catch (err) {
        console.error("Error marking all seasons:", err);
        await refetch();
      }
    },
    [user, tmdbTvId, watched, refetch]
  );

  return {
    isLoading,
    isWatched,
    toggleEpisode,
    markSeason,
    unmarkSeason,
    watchedCountForSeason,
    totalWatched,
    refetch,
  };
}

/**
 * Lightweight version: just counts total watched episodes for a TV id.
 * Used by ContentCard to show progress badge.
 */
export function useWatchedEpisodeCount(tmdbTvId: number | null) {
  const { user } = useAuth();
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    if (!user || tmdbTvId == null) {
      setCount(0);
      return;
    }
    supabase
      .from("watched_episodes")
      .select("episode_number", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("tmdb_tv_id", tmdbTvId)
      .then(({ count: c }) => {
        if (!cancelled) setCount(c ?? 0);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, tmdbTvId]);

  return count;
}

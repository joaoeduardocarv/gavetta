import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TitleAwards {
  media_type: string;
  tmdb_id: number;
  raw_text: string | null;
  oscar_wins: number;
  oscar_nominations: number;
  globe_wins: number;
  globe_nominations: number;
  emmy_wins: number;
  emmy_nominations: number;
  total_wins: number;
  total_nominations: number;
  has_awards: boolean;
  fetched_at?: string;
}

type MediaType = "movie" | "tv";

// Cache em memória para evitar chamadas repetidas na mesma sessão
const memoryCache = new Map<string, TitleAwards | null>();
const inFlight = new Map<string, Promise<TitleAwards | null>>();

async function loadAwards(mediaType: MediaType, tmdbId: number): Promise<TitleAwards | null> {
  const key = `${mediaType}:${tmdbId}`;
  if (memoryCache.has(key)) return memoryCache.get(key) ?? null;
  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const { data: cached } = await supabase
        .from("title_awards")
        .select("*")
        .eq("media_type", mediaType)
        .eq("tmdb_id", tmdbId)
        .maybeSingle();

      const cacheIsFresh = cached?.fetched_at
        ? Date.now() - new Date(cached.fetched_at).getTime() < 30 * 86400000
        : false;

      if (cached && cacheIsFresh) {
        const value = cached as unknown as TitleAwards;
        memoryCache.set(key, value);
        return value;
      }

      const { data, error } = await supabase.functions.invoke("awards", {
        body: { mediaType, tmdbId },
      });
      if (error) {
        if (cached) return cached as unknown as TitleAwards;
        throw error;
      }
      const value = (data?.awards ?? null) as TitleAwards | null;
      memoryCache.set(key, value);
      return value;
    } catch {
      memoryCache.set(key, null);
      return null;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, promise);
  return promise;
}

export function useAwards(mediaType: MediaType | null, tmdbId: number | null) {
  const [awards, setAwards] = useState<TitleAwards | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!mediaType || !tmdbId) {
      setAwards(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    loadAwards(mediaType, tmdbId).then((value) => {
      if (cancelled) return;
      setAwards(value);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [mediaType, tmdbId]);

  const hasAwards = Boolean(awards?.has_awards);
  return { awards, loading, hasAwards };
}

export function formatAwardsSummary(a: TitleAwards): string {
  const parts: string[] = [];
  if (a.total_wins > 0) parts.push(`${a.total_wins} ${a.total_wins === 1 ? "vitória" : "vitórias"}`);
  if (a.total_nominations > 0) {
    parts.push(`${a.total_nominations} ${a.total_nominations === 1 ? "indicação" : "indicações"}`);
  }
  return parts.join(" e ");
}

export interface AwardHighlight {
  label: string;
  wins: number;
  nominations: number;
}

export function getAwardHighlights(a: TitleAwards): AwardHighlight[] {
  return [
    { label: "Oscar", wins: a.oscar_wins, nominations: a.oscar_nominations },
    { label: "Globo de Ouro", wins: a.globe_wins, nominations: a.globe_nominations },
    { label: "Emmy", wins: a.emmy_wins, nominations: a.emmy_nominations },
  ].filter((h) => h.wins > 0 || h.nominations > 0);
}

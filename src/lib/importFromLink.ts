import { supabase } from "@/integrations/supabase/client";
import { Content } from "@/lib/mockData";
import { getTMDBImageUrl, mapGenreIdsToNames } from "@/lib/tmdb";

export interface TmdbMatch {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  originalTitle?: string;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string;
  overview: string;
  voteAverage: number;
  genreIds: number[];
  popularity: number;
}

export interface ExtractedItem {
  query: string;
  year?: number;
  type?: "movie" | "tv";
  match: TmdbMatch;
  alternatives: TmdbMatch[];
}

export interface ExtractResponse {
  needsText: boolean;
  sourceTitle: string;
  sourceProvider: string;
  items: ExtractedItem[];
  unmatched?: string[];
  message?: string;
}

export function matchToContent(match: TmdbMatch): Content {
  return {
    id: `${match.mediaType}-${match.tmdbId}`,
    title: match.title,
    originalTitle: match.originalTitle,
    type: match.mediaType === "movie" ? "movie" : "series",
    posterUrl: getTMDBImageUrl(match.posterPath),
    backdropUrl: match.backdropPath
      ? getTMDBImageUrl(match.backdropPath, "original")
      : undefined,
    rating: match.voteAverage,
    releaseDate: match.releaseDate || "",
    genres: mapGenreIdsToNames(match.genreIds || []),
    synopsis: match.overview || "",
    isInDrawer: false,
  };
}

export async function extractTitlesFromSource(input: {
  url?: string;
  text?: string;
}): Promise<ExtractResponse> {
  const { data, error } = await supabase.functions.invoke<ExtractResponse>(
    "extract-titles",
    { body: input },
  );

  if (error) {
    throw new Error(
      error.message?.includes("429")
        ? "Muitas requisições seguidas. Tente de novo em instantes."
        : "Não consegui analisar esse conteúdo agora. Tente colar a legenda do post.",
    );
  }
  if (!data) throw new Error("Resposta vazia do servidor.");
  return data;
}

/** Extrai a primeira URL de um texto colado (share sheets costumam mandar texto + link). */
export function firstUrlFrom(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s]+/i);
  return match ? match[0].replace(/[),.]+$/, "") : null;
}

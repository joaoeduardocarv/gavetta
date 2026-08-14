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
  context?: string;
  match: TmdbMatch;
  alternatives: TmdbMatch[];
}

export interface ExtractResponse {
  mode?: "text" | "audio";
  jobId?: string;
  needsText: boolean;
  sourceTitle: string;
  sourceProvider: string;
  items: ExtractedItem[];
  unmatched?: string[];
  message?: string;
}

export type ImportJobStatus =
  | "queued"
  | "listening"
  | "extracting"
  | "done"
  | "error";

export interface ImportJob {
  id: string;
  status: ImportJobStatus;
  stage: string | null;
  progress: number;
  total: number | null;
  source_title: string | null;
  source_provider: string | null;
  error: string | null;
  updated_at: string;
  result: {
    items?: ExtractedItem[];
    unmatched?: string[];
    partial?: boolean;
  } | null;
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

export async function fetchImportJob(jobId: string): Promise<ImportJob | null> {
  const { data, error } = await supabase
    .from("import_jobs")
    .select(
      "id, status, stage, progress, total, source_title, source_provider, error, updated_at, result",
    )
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as ImportJob) ?? null;
}

/** Retoma (ou inicia) o processamento do áudio em segundo plano. */
export async function resumeImportJob(jobId: string): Promise<void> {
  await supabase.functions.invoke("transcribe-episode", { body: { jobId } });
}

/** Último job de importação por áudio ainda em andamento, para retomar ao voltar na tela. */
export async function fetchRunningImportJob(): Promise<ImportJob | null> {
  const { data } = await supabase
    .from("import_jobs")
    .select(
      "id, status, stage, progress, total, source_title, source_provider, error, updated_at, result",
    )
    .in("status", ["queued", "listening", "extracting"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as unknown as ImportJob) ?? null;
}

/** Extrai a primeira URL de um texto colado (share sheets costumam mandar texto + link). */
export function firstUrlFrom(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s]+/i);
  return match ? match[0].replace(/[),.]+$/, "") : null;
}

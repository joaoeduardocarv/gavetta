import { Content } from "@/lib/mockData";
import {
  extractStreamingLogos,
  extractStreamingNames,
  getTMDBImageUrl,
  type TMDBWatchProvidersResult,
} from "@/lib/tmdb";

type MediaType = "movie" | "tv";

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toStringValue = (value: unknown): string | undefined => {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return undefined;
};

const toName = (value: unknown): string | undefined => {
  if (typeof value === "string") return value;
  if (!isRecord(value)) return undefined;

  return (
    toStringValue(value.name) ||
    toStringValue(value.title) ||
    toStringValue(value.original_name) ||
    toStringValue(value.originalTitle)
  );
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => toName(item))
    .filter((item): item is string => Boolean(item && item.trim()));
};

type OfferType = 'flatrate' | 'rent' | 'buy' | 'free' | 'ads';
const VALID_OFFER_TYPES: OfferType[] = ['flatrate', 'rent', 'buy', 'free', 'ads'];

const toOfferTypes = (value: unknown): OfferType[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const out = value
    .map((v) => toStringValue(v))
    .filter((v): v is OfferType => !!v && (VALID_OFFER_TYPES as string[]).includes(v));
  return out.length > 0 ? out : undefined;
};

const toProviderLogos = (
  value: unknown,
): { name: string; logoPath: string; offerTypes?: OfferType[] }[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!isRecord(item)) return null;
      const name = toStringValue(item.name) || toStringValue(item.provider_name);
      const logoPath =
        toStringValue(item.logoPath) || toStringValue(item.logo_path);
      if (!name || !logoPath) return null;
      return { name, logoPath, offerTypes: toOfferTypes(item.offerTypes) };
    })
    .filter(
      (item): item is { name: string; logoPath: string; offerTypes: OfferType[] | undefined } =>
        item !== null,
    );
};

const normalizeImageUrl = (value: unknown): string | undefined => {
  const raw = toStringValue(value);
  if (!raw) return undefined;
  if (raw.startsWith("http")) return raw;
  if (
    raw.startsWith("/placeholder") ||
    raw.startsWith("/assets/") ||
    raw.startsWith("/avatars/")
  ) {
    return raw;
  }
  if (raw.startsWith("/")) return getTMDBImageUrl(raw);
  return raw;
};

const normalizeMediaType = (
  typeValue: unknown,
  productionType?: string,
): MediaType => {
  if (typeValue === "movie") return "movie";
  if (typeValue === "series" || typeValue === "tv") return "tv";
  if (productionType === "movie") return "movie";
  return "tv";
};

export const extractTmdbInfoFromId = (
  value: unknown,
): { mediaType: MediaType; tmdbId: number } | null => {
  const id = toStringValue(value);
  if (!id) return null;

  const patterns = [/^tmdb-(movie|tv)-(\d+)$/i, /^(movie|tv)-(\d+)$/i];

  for (const pattern of patterns) {
    const match = id.match(pattern);
    if (match) {
      return {
        mediaType: match[1].toLowerCase() as MediaType,
        tmdbId: Number(match[2]),
      };
    }
  }

  return null;
};

const normalizeContentId = (
  rawId: unknown,
  productionId: string | undefined,
  mediaType: MediaType,
): string => {
  const rawString = toStringValue(rawId);
  const parsedFromRawId = extractTmdbInfoFromId(rawString);
  if (parsedFromRawId) {
    return `${parsedFromRawId.mediaType}-${parsedFromRawId.tmdbId}`;
  }

  const parsedFromProductionId = extractTmdbInfoFromId(productionId);
  if (parsedFromProductionId) {
    return `${parsedFromProductionId.mediaType}-${parsedFromProductionId.tmdbId}`;
  }

  if (typeof rawId === "number") {
    return `${mediaType}-${rawId}`;
  }

  if (rawString && /^\d+$/.test(rawString)) {
    return `${mediaType}-${rawString}`;
  }

  if (productionId && /^\d+$/.test(productionId)) {
    return `${mediaType}-${productionId}`;
  }

  return rawString || productionId || `${mediaType}-${Date.now()}`;
};

export function normalizeStoredContent(
  rawData: unknown,
  options?: { productionId?: string; productionType?: string },
): Content {
  const data = isRecord(rawData) ? rawData : {};

  const mediaType = normalizeMediaType(data.type, options?.productionType);
  const normalizedId = normalizeContentId(data.id, options?.productionId, mediaType);

  const watchProviders = isRecord(data.watch_providers)
    ? (data.watch_providers as TMDBWatchProvidersResult)
    : null;

  const availableOn = toStringArray(data.availableOn);
  const watchProviderLogos = toProviderLogos(data.watchProviderLogos);

  const posterUrl =
    normalizeImageUrl(data.posterUrl) ||
    normalizeImageUrl(data.poster_path) ||
    "/placeholder.svg";

  const backdropUrl =
    normalizeImageUrl(data.backdropUrl) || normalizeImageUrl(data.backdrop_path);

  const title = toStringValue(data.title) || toStringValue(data.name) || "Sem título";
  const releaseDate =
    toStringValue(data.releaseDate) ||
    toStringValue(data.release_date) ||
    toStringValue(data.first_air_date) ||
    "";

  const ratingValue =
    typeof data.rating === "number"
      ? data.rating
      : typeof data.vote_average === "number"
        ? Math.round(data.vote_average * 10) / 10
        : undefined;

  const statusValue = toStringValue(data.status);
  const status: Content["status"] | undefined =
    statusValue === "watched" ||
    statusValue === "watching" ||
    statusValue === "to_watch"
      ? statusValue
      : undefined;

  return {
    id: normalizedId,
    type: mediaType === "movie" ? "movie" : "series",
    title,
    originalTitle:
      toStringValue(data.originalTitle) ||
      toStringValue(data.original_title) ||
      toStringValue(data.name),
    releaseDate,
    synopsis: toStringValue(data.synopsis) || toStringValue(data.overview) || "",
    posterUrl,
    backdropUrl,
    genres: toStringArray(data.genres),
    director: toName(data.director),
    cast: toStringArray(data.cast),
    availableOn:
      availableOn.length > 0 ? availableOn : extractStreamingNames(watchProviders),
    watchProviderLogos:
      watchProviderLogos.length > 0
        ? watchProviderLogos
        : extractStreamingLogos(watchProviders),
    watchProvidersLink:
      toStringValue(data.watchProvidersLink) || watchProviders?.link || undefined,
    rating: ratingValue,
    status,
    isInTheaters: typeof data.isInTheaters === "boolean" ? data.isInTheaters : undefined,
    runtime: extractRuntime(data, mediaType),
  };
}

function extractRuntime(
  data: Record<string, unknown>,
  mediaType: MediaType,
): number | undefined {
  if (typeof data.runtime === "number" && data.runtime > 0) return data.runtime;
  if (mediaType === "tv" && Array.isArray(data.episode_run_time)) {
    const runtimes = data.episode_run_time
      .map((v) => typeof v === "number" ? v : NaN)
      .filter((v) => !isNaN(v) && v > 0);
    if (runtimes.length > 0) {
      return Math.round(runtimes.reduce((a, b) => a + b, 0) / runtimes.length);
    }
  }
  return undefined;
}

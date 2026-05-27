import { Content } from "@/lib/mockData";
import { ContentDrawerAssignment } from "@/contexts/DrawerContext";
import {
  discoverMovies,
  discoverTVShows,
  getTMDBImageUrl,
  getMovieWatchProviders,
  getTVWatchProviders,
  extractStreamingNames,
  extractStreamingLogos,
  mapGenreIdsToNames,
  MOVIE_GENRES,
  TV_GENRES,
  TMDBMovie,
  TMDBTVShow,
} from "@/lib/tmdb";

export interface DestinyPick {
  content: Content;
  topGenres: string[];
}

const RATING_THRESHOLD = 7;
const TOP_GENRES_COUNT = 3;

/** Mapeia nome de gênero (pt-BR) para IDs TMDB. Inclui "Ficção Científica" → também 10765 em TV. */
function genreNameToIds(name: string): { movieIds: number[]; tvIds: number[] } {
  const normalized = name.trim().toLowerCase();
  const movieIds = MOVIE_GENRES.filter(g => g.name.toLowerCase() === normalized).map(g => g.id);
  const tvIds = TV_GENRES.filter(g => g.name.toLowerCase().includes(normalized) || normalized.includes(g.name.toLowerCase())).map(g => g.id);
  return { movieIds, tvIds };
}

/** Conta frequência de gêneros nas avaliações com nota >= 7. */
export function rankUserGenres(assignments: ContentDrawerAssignment[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const a of assignments) {
    if (a.rating == null || a.rating < RATING_THRESHOLD) continue;
    const genres = a.content?.genres || [];
    for (const g of genres) {
      if (!g) continue;
      counts.set(g, (counts.get(g) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

/** Extrai o conjunto de tmdbIds (numéricos) já presentes em qualquer gaveta do usuário. */
export function extractExcludedTmdbIds(assignments: ContentDrawerAssignment[]): Set<string> {
  const set = new Set<string>();
  for (const a of assignments) {
    const pid = a.productionId;
    if (!pid) continue;
    // production_id formats: "movie-123" or "tv-123" or "123"
    const match = pid.match(/(\d+)$/);
    if (match) set.add(`${a.productionType}-${match[1]}`);
  }
  return set;
}

function tmdbMovieToContent(m: TMDBMovie): Content & { popularity: number; vote_average: number } {
  return {
    id: `movie-${m.id}`,
    title: m.title,
    originalTitle: m.original_title,
    type: 'movie',
    posterUrl: getTMDBImageUrl(m.poster_path),
    backdropUrl: m.backdrop_path ? getTMDBImageUrl(m.backdrop_path, 'original') : undefined,
    rating: m.vote_average,
    releaseDate: m.release_date || '',
    genres: mapGenreIdsToNames(m.genre_ids || []),
    synopsis: m.overview,
    isInDrawer: false,
    popularity: m.popularity ?? 0,
    vote_average: m.vote_average ?? 0,
  };
}

function tmdbTVToContent(t: TMDBTVShow): Content & { popularity: number; vote_average: number } {
  return {
    id: `tv-${t.id}`,
    title: t.name,
    originalTitle: t.original_name,
    type: 'series',
    posterUrl: getTMDBImageUrl(t.poster_path),
    backdropUrl: t.backdrop_path ? getTMDBImageUrl(t.backdrop_path, 'original') : undefined,
    rating: t.vote_average,
    releaseDate: t.first_air_date || '',
    genres: mapGenreIdsToNames(t.genre_ids || []),
    synopsis: t.overview,
    isInDrawer: false,
    popularity: t.popularity ?? 0,
    vote_average: t.vote_average ?? 0,
  };
}

export interface DestinyFilters {
  type?: 'movie' | 'series' | 'all';
  genreName?: string | null;
  watchProviderId?: number | null;
}

/**
 * Seleciona um único título personalizado.
 * @param assignments — todas as assignments do usuário (com ratings + drawers)
 * @param alreadyShown — ids já revelados na sessão (ex: "movie-123")
 * @param filters — filtros opcionais (tipo, gênero, streaming). Quando filtros estão setados, complementam o ranking de gêneros do usuário.
 */
export async function pickDestinyContent(
  assignments: ContentDrawerAssignment[],
  alreadyShown: Set<string> = new Set(),
  filters: DestinyFilters = {},
): Promise<DestinyPick | null> {
  const ranked = rankUserGenres(assignments);
  const filterType = filters.type ?? 'all';

  // Define gêneros de busca: filtro explícito tem prioridade, senão usa top do usuário
  let topGenreNames: string[];
  const movieIds = new Set<number>();
  const tvIds = new Set<number>();

  if (filters.genreName) {
    topGenreNames = [filters.genreName];
    const { movieIds: mi, tvIds: ti } = genreNameToIds(filters.genreName);
    mi.forEach(id => movieIds.add(id));
    ti.forEach(id => tvIds.add(id));
  } else {
    if (ranked.length === 0) return null;
    const topGenres = ranked.slice(0, TOP_GENRES_COUNT);
    topGenreNames = topGenres.map(g => g.name);
    for (const g of topGenres) {
      const { movieIds: mi, tvIds: ti } = genreNameToIds(g.name);
      mi.forEach(id => movieIds.add(id));
      ti.forEach(id => tvIds.add(id));
    }
  }

  const providerIds = filters.watchProviderId ? [filters.watchProviderId] : undefined;
  const wantMovies = filterType === 'all' || filterType === 'movie';
  const wantSeries = filterType === 'all' || filterType === 'series';

  // Busca discover em paralelo (páginas 1 e 2)
  const [movies1, movies2, tvs1, tvs2] = await Promise.all([
    wantMovies && movieIds.size > 0
      ? discoverMovies({ genreIds: Array.from(movieIds), watchProviderIds: providerIds, page: 1 })
      : Promise.resolve([] as TMDBMovie[]),
    wantMovies && movieIds.size > 0
      ? discoverMovies({ genreIds: Array.from(movieIds), watchProviderIds: providerIds, page: 2 })
      : Promise.resolve([] as TMDBMovie[]),
    wantSeries && tvIds.size > 0
      ? discoverTVShows({ genreIds: Array.from(tvIds), watchProviderIds: providerIds, page: 1 })
      : Promise.resolve([] as TMDBTVShow[]),
    wantSeries && tvIds.size > 0
      ? discoverTVShows({ genreIds: Array.from(tvIds), watchProviderIds: providerIds, page: 2 })
      : Promise.resolve([] as TMDBTVShow[]),
  ]);

  const excluded = extractExcludedTmdbIds(assignments);

  const allCandidates = [
    ...movies1.map(tmdbMovieToContent),
    ...movies2.map(tmdbMovieToContent),
    ...tvs1.map(tmdbTVToContent),
    ...tvs2.map(tmdbTVToContent),
  ].filter(c => c.posterUrl && !excluded.has(c.id) && !alreadyShown.has(c.id));

  if (allCandidates.length === 0) return null;

  const maxPop = Math.max(...allCandidates.map(c => c.popularity), 1);
  const scored = allCandidates
    .filter(c => c.vote_average >= 6)
    .map(c => ({
      ...c,
      _score: c.vote_average * 0.6 + (c.popularity / maxPop) * 10 * 0.4,
    }))
    .sort((a, b) => b._score - a._score);

  const pool = scored.slice(0, 10);
  if (pool.length === 0) return null;
  const chosen = pool[Math.floor(Math.random() * pool.length)];

  // Enriquece com streaming providers
  try {
    const tmdbId = parseInt(chosen.id.split('-')[1]);
    const providers = chosen.type === 'movie'
      ? await getMovieWatchProviders(tmdbId)
      : await getTVWatchProviders(tmdbId);
    const names = extractStreamingNames(providers);
    const logos = extractStreamingLogos(providers);
    chosen.availableOn = names.length > 0 ? names : undefined;
    chosen.watchProviderLogos = logos.length > 0 ? logos : undefined;
  } catch {
    // segue sem providers
  }

  const { popularity: _p, vote_average: _v, _score, ...content } = chosen as Content & {
    popularity: number; vote_average: number; _score: number;
  };

  return { content: content as Content, topGenres: topGenreNames };
}

export function buildDestinyMessage(topGenres: string[]): string {
  if (topGenres.length === 0) return 'Esse foi escolhido pra você.';
  if (topGenres.length === 1) return `Você curte muito ${topGenres[0]} — esse foi escolhido pra você.`;
  return `Você curte muito ${topGenres[0]} e ${topGenres[1]} — esse foi escolhido pra você.`;
}

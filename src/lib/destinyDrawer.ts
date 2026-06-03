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
const SOFT_RATING_THRESHOLD = 6; // pra montar pool de gêneros "adjacentes"
const HISTORY_PREFIX = "gavetta:destiny-history:";
const HISTORY_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias
const WILDCARD_CHANCE = 0.3;

// ─────────────────────────────── HISTÓRICO (7 DIAS) ───────────────────────────────

type HistoryMap = Record<string, number>;

function historyKey(userId: string): string {
  return `${HISTORY_PREFIX}${userId}`;
}

function readHistory(userId: string): HistoryMap {
  try {
    const raw = localStorage.getItem(historyKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as HistoryMap;
    const cutoff = Date.now() - HISTORY_TTL_MS;
    const cleaned: HistoryMap = {};
    for (const [id, ts] of Object.entries(parsed)) {
      if (typeof ts === "number" && ts >= cutoff) cleaned[id] = ts;
    }
    return cleaned;
  } catch {
    return {};
  }
}

/** Retorna o conjunto de ids vistos nos últimos 7 dias para o usuário. */
export function loadDestinyRecentIds(userId: string | undefined | null): Set<string> {
  if (!userId) return new Set();
  return new Set(Object.keys(readHistory(userId)));
}

/** Marca o id como visto agora, mantendo histórico de 7 dias. */
export function rememberDestinyPick(userId: string | undefined | null, contentId: string): void {
  if (!userId || !contentId) return;
  try {
    const map = readHistory(userId);
    map[contentId] = Date.now();
    localStorage.setItem(historyKey(userId), JSON.stringify(map));
  } catch {
    // ignore
  }
}

// ─────────────────────────────── HELPERS ───────────────────────────────

function genreNameToIds(name: string): { movieIds: number[]; tvIds: number[] } {
  const normalized = name.trim().toLowerCase();
  const movieIds = MOVIE_GENRES.filter(g => g.name.toLowerCase() === normalized).map(g => g.id);
  const tvIds = TV_GENRES.filter(g => g.name.toLowerCase().includes(normalized) || normalized.includes(g.name.toLowerCase())).map(g => g.id);
  return { movieIds, tvIds };
}

/** Conta frequência de gêneros, ponderando pela nota acima de 7. */
export function rankUserGenres(assignments: ContentDrawerAssignment[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const a of assignments) {
    if (a.rating == null || a.rating < RATING_THRESHOLD) continue;
    const weight = a.rating - 6; // 7→1, 8→2, 9→3, 10→4
    for (const g of a.content?.genres || []) {
      if (!g) continue;
      counts.set(g, (counts.get(g) || 0) + weight);
    }
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

/** Gêneros "adjacentes" — qualquer gênero que apareça em títulos com nota ≥ 6, ordenado por frequência. */
function rankAdjacentGenres(assignments: ContentDrawerAssignment[]): string[] {
  const counts = new Map<string, number>();
  for (const a of assignments) {
    if (a.rating == null || a.rating < SOFT_RATING_THRESHOLD) continue;
    for (const g of a.content?.genres || []) {
      if (!g) continue;
      counts.set(g, (counts.get(g) || 0) + 1);
    }
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([n]) => n);
}

export function extractExcludedTmdbIds(assignments: ContentDrawerAssignment[]): Set<string> {
  const set = new Set<string>();
  for (const a of assignments) {
    const pid = a.productionId;
    if (!pid) continue;
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

function pickRandom<T>(arr: T[]): T | undefined {
  if (!arr.length) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface DestinyFilters {
  type?: 'movie' | 'series' | 'all';
  genreName?: string | null;
  watchProviderId?: number | null;
}

/**
 * Escolhe gêneros pra busca, com criatividade:
 *  - Quando há filtro explícito, usa apenas o filtro.
 *  - Caso contrário, escolhe um SUBCONJUNTO aleatório dos top gêneros do usuário (1-2),
 *    e com WILDCARD_CHANCE injeta um gênero "adjacente" menos óbvio.
 */
function selectGenres(
  assignments: ContentDrawerAssignment[],
  filters: DestinyFilters,
): { names: string[]; allTopNames: string[] } {
  if (filters.genreName) {
    return { names: [filters.genreName], allTopNames: [filters.genreName] };
  }

  const ranked = rankUserGenres(assignments).slice(0, 8);
  const allTopNames = ranked.slice(0, 3).map(g => g.name);
  if (ranked.length === 0) return { names: [], allTopNames: [] };

  // Escolhe 1-2 gêneros aleatoriamente dos top 6 (não sempre os 3 primeiros)
  const pool = ranked.slice(0, 6).map(g => g.name);
  const shuffled = shuffle(pool);
  const k = Math.min(pool.length, 1 + Math.floor(Math.random() * 2)); // 1 ou 2
  const picked = shuffled.slice(0, k);

  // Wildcard: 30% das vezes, troca/adiciona um gênero "adjacente" menos óbvio
  if (Math.random() < WILDCARD_CHANCE) {
    const adjacent = rankAdjacentGenres(assignments).filter(g => !picked.includes(g));
    // prefere os do meio (não top-1, não muito raros) — posição 3 em diante
    const wildPool = adjacent.slice(2, 10);
    const wild = pickRandom(wildPool.length > 0 ? wildPool : adjacent);
    if (wild) {
      if (picked.length >= 2) picked.pop();
      picked.push(wild);
    }
  }

  return { names: picked, allTopNames };
}

/**
 * Seleciona um único título personalizado.
 * @param assignments — todas as assignments do usuário
 * @param alreadyShown — ids já revelados nesta sessão
 * @param filters — filtros opcionais
 * @param recentlyShown — ids revelados nos últimos 7 dias (persistido)
 */
export async function pickDestinyContent(
  assignments: ContentDrawerAssignment[],
  alreadyShown: Set<string> = new Set(),
  filters: DestinyFilters = {},
  recentlyShown: Set<string> = new Set(),
): Promise<DestinyPick | null> {
  const filterType = filters.type ?? 'all';

  const { names: pickedGenres, allTopNames } = selectGenres(assignments, filters);
  if (pickedGenres.length === 0) return null;

  const movieIds = new Set<number>();
  const tvIds = new Set<number>();
  for (const name of pickedGenres) {
    const { movieIds: mi, tvIds: ti } = genreNameToIds(name);
    mi.forEach(id => movieIds.add(id));
    ti.forEach(id => tvIds.add(id));
  }

  const providerIds = filters.watchProviderId ? [filters.watchProviderId] : undefined;
  const wantMovies = filterType === 'all' || filterType === 'movie';
  const wantSeries = filterType === 'all' || filterType === 'series';

  // Páginas aleatórias entre 1-5 (TMDB discover suporta) — mais variedade a cada chamada
  const pageA = 1 + Math.floor(Math.random() * 3);     // 1-3
  const pageB = 3 + Math.floor(Math.random() * 3);     // 3-5

  const [movies1, movies2, tvs1, tvs2] = await Promise.all([
    wantMovies && movieIds.size > 0
      ? discoverMovies({ genreIds: Array.from(movieIds), watchProviderIds: providerIds, page: pageA })
      : Promise.resolve([] as TMDBMovie[]),
    wantMovies && movieIds.size > 0
      ? discoverMovies({ genreIds: Array.from(movieIds), watchProviderIds: providerIds, page: pageB })
      : Promise.resolve([] as TMDBMovie[]),
    wantSeries && tvIds.size > 0
      ? discoverTVShows({ genreIds: Array.from(tvIds), watchProviderIds: providerIds, page: pageA })
      : Promise.resolve([] as TMDBTVShow[]),
    wantSeries && tvIds.size > 0
      ? discoverTVShows({ genreIds: Array.from(tvIds), watchProviderIds: providerIds, page: pageB })
      : Promise.resolve([] as TMDBTVShow[]),
  ]);

  const excluded = extractExcludedTmdbIds(assignments);

  let allCandidates = [
    ...movies1.map(tmdbMovieToContent),
    ...movies2.map(tmdbMovieToContent),
    ...tvs1.map(tmdbTVToContent),
    ...tvs2.map(tmdbTVToContent),
  ].filter(c =>
    c.posterUrl &&
    !excluded.has(c.id) &&
    !alreadyShown.has(c.id) &&
    !recentlyShown.has(c.id),
  );

  if (allCandidates.length === 0) {
    // Fallback: relaxa o filtro de "últimos 7 dias" para não travar quando o pool é raso
    allCandidates = [
      ...movies1.map(tmdbMovieToContent),
      ...movies2.map(tmdbMovieToContent),
      ...tvs1.map(tmdbTVToContent),
      ...tvs2.map(tmdbTVToContent),
    ].filter(c => c.posterUrl && !excluded.has(c.id) && !alreadyShown.has(c.id));
  }

  if (allCandidates.length === 0) return null;

  const maxPop = Math.max(...allCandidates.map(c => c.popularity), 1);
  const scored = allCandidates
    .filter(c => c.vote_average >= 6)
    .map(c => {
      const qualityScore = c.vote_average * 0.5;
      const popScore = (c.popularity / maxPop) * 10 * 0.2;
      // Boost "joia escondida": alta nota + baixa popularidade
      const isHiddenGem = c.vote_average >= 7.5 && (c.popularity / maxPop) < 0.3;
      const gemBoost = isHiddenGem ? 1.8 : 0;
      // Componente aleatório forte pra evitar mesmo "top" sempre
      const randomScore = Math.random() * 3;
      return { ...c, _score: qualityScore + popScore + gemBoost + randomScore };
    })
    .sort((a, b) => b._score - a._score);

  // Pool maior (30) com pick aleatório → muito mais variedade
  const pool = scored.slice(0, 30);
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

  // Mensagem usa os top gêneros reais do usuário (ou o gênero filtrado),
  // não a seleção aleatória da rodada — fica mais coerente.
  const messageGenres = filters.genreName ? [filters.genreName] : allTopNames;

  return { content: content as Content, topGenres: messageGenres };
}

export function buildDestinyMessage(topGenres: string[]): string {
  if (topGenres.length === 0) return 'Esse foi escolhido pra você.';
  if (topGenres.length === 1) return `Você curte muito ${topGenres[0]} — esse foi escolhido pra você.`;
  return `Você curte muito ${topGenres[0]} e ${topGenres[1]} — esse foi escolhido pra você.`;
}

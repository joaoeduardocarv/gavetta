// =============== TIPOS ===============

export interface TMDBMovie {
  id: number;
  title: string;
  original_title?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  genre_ids: number[];
  popularity: number;
}

export interface TMDBMovieDetails extends TMDBMovie {
  runtime: number;
  genres: { id: number; name: string }[];
  tagline: string;
  status: string;
  budget: number;
  revenue: number;
  production_companies: { id: number; name: string; logo_path: string | null }[];
  /** True if the movie is currently in theaters in Brazil (within ~60 days of theatrical release). */
  isInTheaters?: boolean;
}

export interface TMDBTVShow {
  id: number;
  name: string;
  original_name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  vote_average: number;
  genre_ids: number[];
  popularity: number;
}

export interface TMDBTVDetails extends TMDBTVShow {
  number_of_seasons: number;
  number_of_episodes: number;
  episode_run_time?: number[];
  seasons: TMDBSeason[];
  genres: { id: number; name: string }[];
  status: string;
  created_by: { id: number; name: string }[];
}

export interface TMDBSeason {
  id: number;
  season_number: number;
  episode_count: number;
  air_date: string;
  poster_path: string | null;
  name: string;
  overview: string;
}

export interface TMDBEpisode {
  id: number;
  name: string;
  overview: string;
  still_path: string | null;
  episode_number: number;
  season_number: number;
  air_date: string;
  vote_average: number;
  runtime: number;
}

export interface TMDBCastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
}

export interface TMDBCrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

export interface TMDBWatchProvider {
  logo_path: string;
  provider_id: number;
  provider_name: string;
  display_priority: number;
}

export type TMDBOfferType = 'flatrate' | 'rent' | 'buy' | 'free' | 'ads';

export interface TMDBWatchProvidersResult {
  link?: string;
  flatrate?: TMDBWatchProvider[];
  rent?: TMDBWatchProvider[];
  buy?: TMDBWatchProvider[];
  free?: TMDBWatchProvider[];
  ads?: TMDBWatchProvider[];
}

export interface TMDBPerson {
  id: number;
  name: string;
  profile_path: string | null;
  known_for_department: string;
  biography: string;
  birthday: string | null;
  place_of_birth: string | null;
}

export interface TMDBPersonCredit {
  id: number;
  title?: string;
  original_title?: string;
  name?: string;
  original_name?: string;
  poster_path: string | null;
  backdrop_path?: string | null;
  overview?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  popularity?: number;
  genre_ids?: number[];
  media_type: 'movie' | 'tv';
  character?: string;
  job?: string;
}

// =============== BUSCA PESSOA COM CRÉDITOS ===============

export interface PersonWithCredits {
  person: { id: number; name: string; profile_path: string | null };
  credits: TMDBPersonCredit[];
}

export async function searchPersonWithCredits(name: string): Promise<PersonWithCredits | null> {
  const people = await searchPerson(name);
  if (people.length === 0) return null;
  
  const person = people[0];
  const credits = await getPersonCredits(person.id);
  
  return {
    person,
    credits: credits
      .filter(c => c.poster_path)
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0)),
  };
}

// =============== UTILITÁRIOS DE IMAGEM ===============

export function getTMDBImageUrl(path: string | null, size: 'w92' | 'w154' | 'w185' | 'w200' | 'w300' | 'w500' | 'original' = 'w300'): string {
  if (!path) return '/placeholder.svg';
  return `https://image.tmdb.org/t/p/${size}${path}`;
}


export function getTMDBProfileUrl(path: string | null): string {
  return getTMDBImageUrl(path, 'w300');
}

// =============== CLIENT-SIDE CACHE ===============

const clientCache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes default
const PROVIDERS_CACHE_TTL = 60 * 1000; // 1 minute for watch providers (change often)

async function cachedCall<T>(cacheKey: string, fetcher: () => Promise<T>, ttl: number = CACHE_TTL): Promise<T> {
  const cached = clientCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < ttl) {
    return cached.data as T;
  }
  const data = await fetcher();
  clientCache.set(cacheKey, { data, ts: Date.now() });
  return data;
}

// =============== HELPER PARA CHAMAR A EDGE FUNCTION ===============

async function callTMDBFunction<T>(action: string, params: Record<string, string> = {}): Promise<T> {
  const cacheKey = `${action}:${JSON.stringify(params)}`;
  const ttl = action.includes('Providers') ? PROVIDERS_CACHE_TTL : CACHE_TTL;
  return cachedCall(cacheKey, async () => {
    const queryParams = new URLSearchParams({ action, ...params });

    // Get the user's session token for authenticated edge function calls
    const { supabase } = await import('@/integrations/supabase/client');
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tmdb?${queryParams}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `TMDB API error: ${response.status}`);
    }

    return await response.json();
  }, ttl);
}

// =============== ACTION 1 — BUSCAR FILMES ===============

export async function searchMovies(termoBusca: string): Promise<TMDBMovie[]> {
  if (!termoBusca.trim()) return [];
  return callTMDBFunction<TMDBMovie[]>('searchMovies', { query: termoBusca });
}

// =============== ACTION 2 — BUSCAR SÉRIES ===============

export async function searchTVShows(termoBusca: string): Promise<TMDBTVShow[]> {
  if (!termoBusca.trim()) return [];
  return callTMDBFunction<TMDBTVShow[]>('searchTVShows', { query: termoBusca });
}

// =============== ACTION 3 — DETALHES DO FILME ===============

export async function getMovieDetails(movieId: number): Promise<TMDBMovieDetails> {
  return callTMDBFunction<TMDBMovieDetails>('getMovieDetails', { movieId: String(movieId) });
}

// =============== ACTION 4 — ELENCO DO FILME ===============

export async function getMovieCredits(movieId: number): Promise<{ cast: TMDBCastMember[]; crew: TMDBCrewMember[] }> {
  return callTMDBFunction<{ cast: TMDBCastMember[]; crew: TMDBCrewMember[] }>('getMovieCredits', { movieId: String(movieId) });
}

// =============== ACTION 5 — DETALHES DA SÉRIE ===============

export async function getTVDetails(tvId: number): Promise<TMDBTVDetails> {
  return callTMDBFunction<TMDBTVDetails>('getTVDetails', { tvId: String(tvId) });
}

// =============== ACTION 4b — ELENCO DA SÉRIE ===============

export async function getTVCredits(tvId: number): Promise<{ cast: TMDBCastMember[]; crew: TMDBCrewMember[] }> {
  return callTMDBFunction<{ cast: TMDBCastMember[]; crew: TMDBCrewMember[] }>('getTVCredits', { tvId: String(tvId) });
}

// =============== ACTION 6 — TEMPORADAS DA SÉRIE ===============

export async function getTVSeasons(tvId: number): Promise<TMDBSeason[]> {
  const details = await getTVDetails(tvId);
  return details.seasons;
}

// =============== ACTION 7 — EPISÓDIOS DE UMA TEMPORADA ===============

export async function getSeasonEpisodes(tvId: number, seasonNumber: number): Promise<TMDBEpisode[]> {
  return callTMDBFunction<TMDBEpisode[]>('getSeasonEpisodes', { tvId: String(tvId), seasonNumber: String(seasonNumber) });
}

// =============== BUSCA COMBINADA (FILMES + SÉRIES) ===============

export async function searchAll(termoBusca: string): Promise<{ movies: TMDBMovie[]; tvShows: TMDBTVShow[] }> {
  if (!termoBusca.trim()) return { movies: [], tvShows: [] };

  const [movies, tvShows] = await Promise.all([
    searchMovies(termoBusca),
    searchTVShows(termoBusca)
  ]);

  return { movies, tvShows };
}

// =============== ACTION 8 — WATCH PROVIDERS (STREAMINGS) ===============

export async function getMovieWatchProviders(movieId: number): Promise<TMDBWatchProvidersResult | null> {
  return callTMDBFunction<TMDBWatchProvidersResult | null>('getMovieWatchProviders', { movieId: String(movieId) });
}

export async function getTVWatchProviders(tvId: number): Promise<TMDBWatchProvidersResult | null> {
  return callTMDBFunction<TMDBWatchProvidersResult | null>('getTVWatchProviders', { tvId: String(tvId) });
}

// Função auxiliar para extrair nomes de streaming
export function extractStreamingNames(providers: TMDBWatchProvidersResult | null): string[] {
  if (!providers) return [];
  
  const names = new Set<string>();
  
  // Prioriza flatrate (assinatura) mas também inclui aluguel/compra
  providers.flatrate?.forEach(p => names.add(p.provider_name));
  providers.rent?.forEach(p => names.add(p.provider_name));
  providers.buy?.forEach(p => names.add(p.provider_name));
  
  return Array.from(names);
}

// Extrai logos únicos dos provedores de streaming, com tipos de oferta agregados
export function extractStreamingLogos(
  providers: TMDBWatchProvidersResult | null
): { name: string; logoPath: string; offerTypes: TMDBOfferType[] }[] {
  if (!providers) return [];

  const byId = new Map<number, { name: string; logoPath: string; offerTypes: Set<TMDBOfferType> }>();

  const addProviders = (list: TMDBWatchProvider[] | undefined, type: TMDBOfferType) => {
    list?.forEach(p => {
      let entry = byId.get(p.provider_id);
      if (!entry) {
        entry = { name: p.provider_name, logoPath: p.logo_path, offerTypes: new Set() };
        byId.set(p.provider_id, entry);
      }
      entry.offerTypes.add(type);
    });
  };

  // Ordem de prioridade: flatrate primeiro
  addProviders(providers.flatrate, 'flatrate');
  addProviders(providers.free, 'free');
  addProviders(providers.ads, 'ads');
  addProviders(providers.rent, 'rent');
  addProviders(providers.buy, 'buy');

  return Array.from(byId.values()).map(e => ({
    name: e.name,
    logoPath: e.logoPath,
    offerTypes: Array.from(e.offerTypes),
  }));
}

// Extrai o link público (JustWatch) para a página BR de assistir
export function extractWatchProvidersLink(providers: TMDBWatchProvidersResult | null): string | undefined {
  return providers?.link || undefined;
}

// =============== ACTION 9 — DETALHES DE PESSOA ===============

export async function getPersonDetails(personId: number): Promise<TMDBPerson> {
  return callTMDBFunction<TMDBPerson>('getPersonDetails', { personId: String(personId) });
}

// =============== ACTION 10 — FILMOGRAFIA DE PESSOA ===============

export async function getPersonCredits(personId: number): Promise<TMDBPersonCredit[]> {
  return callTMDBFunction<TMDBPersonCredit[]>('getPersonCredits', { personId: String(personId) });
}

// =============== ACTION 11 — BUSCAR PESSOA POR NOME ===============

export async function searchPerson(name: string): Promise<{ id: number; name: string; profile_path: string | null }[]> {
  if (!name.trim()) return [];
  return callTMDBFunction<{ id: number; name: string; profile_path: string | null }[]>('searchPerson', { query: name });
}

// =============== ACTION 12 — DISCOVER (FILMES POR GÊNERO/FILTROS) ===============

export async function discoverMovies(options: { genreId?: number; genreIds?: number[]; watchProviderIds?: number[]; page?: number } = {}): Promise<TMDBMovie[]> {
  const params: Record<string, string> = {};
  if (options.genreIds && options.genreIds.length > 0) params.genreIds = options.genreIds.join(',');
  else if (options.genreId) params.genreId = String(options.genreId);
  if (options.watchProviderIds && options.watchProviderIds.length > 0) params.watchProviderIds = options.watchProviderIds.join('|');
  if (options.page) params.page = String(options.page);
  return callTMDBFunction<TMDBMovie[]>('discoverMovies', params);
}

export async function discoverTVShows(options: { genreId?: number; genreIds?: number[]; watchProviderIds?: number[]; page?: number } = {}): Promise<TMDBTVShow[]> {
  const params: Record<string, string> = {};
  if (options.genreIds && options.genreIds.length > 0) params.genreIds = options.genreIds.join(',');
  else if (options.genreId) params.genreId = String(options.genreId);
  if (options.watchProviderIds && options.watchProviderIds.length > 0) params.watchProviderIds = options.watchProviderIds.join('|');
  if (options.page) params.page = String(options.page);
  return callTMDBFunction<TMDBTVShow[]>('discoverTVShows', params);
}

// =============== STREAMINGS BR COMUNS (TMDB provider IDs) ===============

export const BR_STREAMING_PROVIDERS = [
  { id: 8, name: 'Netflix' },
  { id: 119, name: 'Prime Video' },
  { id: 337, name: 'Disney+' },
  { id: 1899, name: 'HBO Max' },
  { id: 350, name: 'Apple TV+' },
  { id: 531, name: 'Paramount+' },
  { id: 307, name: 'Globoplay' },
  { id: 619, name: 'MUBI' },
];

// =============== ACTION 13 — TRENDING (EM ALTA) ===============

export async function getTrendingMovies(timeWindow: 'day' | 'week' = 'day'): Promise<TMDBMovie[]> {
  return callTMDBFunction<TMDBMovie[]>('getTrendingMovies', { timeWindow });
}

export async function getTrendingTV(timeWindow: 'day' | 'week' = 'day'): Promise<TMDBTVShow[]> {
  return callTMDBFunction<TMDBTVShow[]>('getTrendingTV', { timeWindow });
}

// =============== GENRE IDS (PT-BR) ===============

export const MOVIE_GENRES = [
  { id: 28, name: 'Ação' },
  { id: 12, name: 'Aventura' },
  { id: 16, name: 'Animação' },
  { id: 35, name: 'Comédia' },
  { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentário' },
  { id: 18, name: 'Drama' },
  { id: 10751, name: 'Família' },
  { id: 14, name: 'Fantasia' },
  { id: 36, name: 'História' },
  { id: 27, name: 'Terror' },
  { id: 10402, name: 'Música' },
  { id: 9648, name: 'Mistério' },
  { id: 10749, name: 'Romance' },
  { id: 878, name: 'Ficção Científica' },
  { id: 53, name: 'Thriller' },
  { id: 10752, name: 'Guerra' },
  { id: 37, name: 'Faroeste' }
];

export const TV_GENRES = [
  { id: 10759, name: 'Ação & Aventura' },
  { id: 16, name: 'Animação' },
  { id: 35, name: 'Comédia' },
  { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentário' },
  { id: 18, name: 'Drama' },
  { id: 10751, name: 'Família' },
  { id: 10762, name: 'Kids' },
  { id: 9648, name: 'Mistério' },
  { id: 10763, name: 'News' },
  { id: 10764, name: 'Reality' },
  { id: 10765, name: 'Ficção Científica & Fantasia' },
  { id: 10766, name: 'Soap' },
  { id: 10767, name: 'Talk' },
  { id: 10768, name: 'Guerra & Política' },
  { id: 37, name: 'Faroeste' }
];

// =============== UTILITÁRIO: MAPEAR GENRE IDS PARA NOMES ===============

const _allGenresMap = new Map<number, string>();
MOVIE_GENRES.forEach(g => _allGenresMap.set(g.id, g.name));
TV_GENRES.forEach(g => { if (!_allGenresMap.has(g.id)) _allGenresMap.set(g.id, g.name); });

export function mapGenreIdsToNames(genreIds: number[]): string[] {
  return genreIds.map(id => _allGenresMap.get(id)).filter((n): n is string => !!n);
}

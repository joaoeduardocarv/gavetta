const TMDB_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJlMGZjMWEzNTUxNGIxYWM2YTlkZGNjY2VlYzg0YTk2MyIsIm5iZiI6MTc2NDg3MzM1My4zMDksInN1YiI6IjY5MzFkNDg5ZjIyYzJiYmU0ZTY5YjliZCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.KWCojutvNgsTGcdtnIFEJVPsEdINVBi0jUN838-EswE";

const TMDB_HEADERS = {
  "Authorization": `Bearer ${TMDB_TOKEN}`,
  "Accept": "application/json"
};

// =============== TIPOS ===============

export interface TMDBMovie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  genre_ids: number[];
}

export interface TMDBMovieDetails extends TMDBMovie {
  runtime: number;
  genres: { id: number; name: string }[];
  tagline: string;
  status: string;
  budget: number;
  revenue: number;
  production_companies: { id: number; name: string; logo_path: string | null }[];
}

export interface TMDBTVShow {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  vote_average: number;
  genre_ids: number[];
}

export interface TMDBTVDetails extends TMDBTVShow {
  number_of_seasons: number;
  number_of_episodes: number;
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

export interface TMDBWatchProvidersResult {
  flatrate?: TMDBWatchProvider[];
  rent?: TMDBWatchProvider[];
  buy?: TMDBWatchProvider[];
}

// =============== UTILITÁRIOS DE IMAGEM ===============

export function getTMDBImageUrl(path: string | null, size: 'w200' | 'w300' | 'w500' | 'original' = 'w500'): string {
  if (!path) return '/placeholder.svg';
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export function getTMDBProfileUrl(path: string | null): string {
  return getTMDBImageUrl(path, 'w300');
}

// =============== ACTION 1 — BUSCAR FILMES ===============

export async function searchMovies(termoBusca: string): Promise<TMDBMovie[]> {
  if (!termoBusca.trim()) return [];

  const response = await fetch(
    `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(termoBusca)}&language=pt-BR`,
    {
      method: "GET",
      headers: TMDB_HEADERS
    }
  );

  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status}`);
  }

  const data = await response.json();
  return data.results;
}

// =============== ACTION 2 — BUSCAR SÉRIES ===============

export async function searchTVShows(termoBusca: string): Promise<TMDBTVShow[]> {
  if (!termoBusca.trim()) return [];

  const response = await fetch(
    `https://api.themoviedb.org/3/search/tv?query=${encodeURIComponent(termoBusca)}&language=pt-BR`,
    {
      method: "GET",
      headers: TMDB_HEADERS
    }
  );

  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status}`);
  }

  const data = await response.json();
  return data.results;
}

// =============== ACTION 3 — DETALHES DO FILME ===============

export async function getMovieDetails(movieId: number): Promise<TMDBMovieDetails> {
  const response = await fetch(
    `https://api.themoviedb.org/3/movie/${movieId}?language=pt-BR`,
    {
      method: "GET",
      headers: TMDB_HEADERS
    }
  );

  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status}`);
  }

  return await response.json();
}

// =============== ACTION 4 — ELENCO DO FILME ===============

export async function getMovieCredits(movieId: number): Promise<{ cast: TMDBCastMember[]; crew: TMDBCrewMember[] }> {
  const response = await fetch(
    `https://api.themoviedb.org/3/movie/${movieId}/credits?language=pt-BR`,
    {
      method: "GET",
      headers: TMDB_HEADERS
    }
  );

  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status}`);
  }

  const data = await response.json();
  return { cast: data.cast, crew: data.crew };
}

// =============== ACTION 5 — DETALHES DA SÉRIE ===============

export async function getTVDetails(tvId: number): Promise<TMDBTVDetails> {
  const response = await fetch(
    `https://api.themoviedb.org/3/tv/${tvId}?language=pt-BR`,
    {
      method: "GET",
      headers: TMDB_HEADERS
    }
  );

  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status}`);
  }

  return await response.json();
}

// =============== ACTION 4b — ELENCO DA SÉRIE ===============

export async function getTVCredits(tvId: number): Promise<{ cast: TMDBCastMember[]; crew: TMDBCrewMember[] }> {
  const response = await fetch(
    `https://api.themoviedb.org/3/tv/${tvId}/credits?language=pt-BR`,
    {
      method: "GET",
      headers: TMDB_HEADERS
    }
  );

  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status}`);
  }

  const data = await response.json();
  return { cast: data.cast, crew: data.crew };
}

// =============== ACTION 6 — TEMPORADAS DA SÉRIE ===============

export async function getTVSeasons(tvId: number): Promise<TMDBSeason[]> {
  const details = await getTVDetails(tvId);
  return details.seasons;
}

// =============== ACTION 7 — EPISÓDIOS DE UMA TEMPORADA ===============

export async function getSeasonEpisodes(tvId: number, seasonNumber: number): Promise<TMDBEpisode[]> {
  const response = await fetch(
    `https://api.themoviedb.org/3/tv/${tvId}/season/${seasonNumber}?language=pt-BR`,
    {
      method: "GET",
      headers: TMDB_HEADERS
    }
  );

  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status}`);
  }

  const data = await response.json();
  return data.episodes;
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
  const response = await fetch(
    `https://api.themoviedb.org/3/movie/${movieId}/watch/providers`,
    {
      method: "GET",
      headers: TMDB_HEADERS
    }
  );

  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status}`);
  }

  const data = await response.json();
  // Retorna os provedores do Brasil (BR), ou null se não disponível
  return data.results?.BR || null;
}

export async function getTVWatchProviders(tvId: number): Promise<TMDBWatchProvidersResult | null> {
  const response = await fetch(
    `https://api.themoviedb.org/3/tv/${tvId}/watch/providers`,
    {
      method: "GET",
      headers: TMDB_HEADERS
    }
  );

  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status}`);
  }

  const data = await response.json();
  // Retorna os provedores do Brasil (BR), ou null se não disponível
  return data.results?.BR || null;
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

// =============== TIPOS DE PESSOA ===============

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
  name?: string;
  poster_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  media_type: 'movie' | 'tv';
  character?: string;
  job?: string;
}

// =============== ACTION 9 — DETALHES DE PESSOA ===============

export async function getPersonDetails(personId: number): Promise<TMDBPerson> {
  const response = await fetch(
    `https://api.themoviedb.org/3/person/${personId}?language=pt-BR`,
    {
      method: "GET",
      headers: TMDB_HEADERS
    }
  );

  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status}`);
  }

  return await response.json();
}

// =============== ACTION 10 — FILMOGRAFIA DE PESSOA ===============

export async function getPersonCredits(personId: number): Promise<TMDBPersonCredit[]> {
  const response = await fetch(
    `https://api.themoviedb.org/3/person/${personId}/combined_credits?language=pt-BR`,
    {
      method: "GET",
      headers: TMDB_HEADERS
    }
  );

  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status}`);
  }

  const data = await response.json();
  
  // Combina cast e crew, removendo duplicatas e ordenando por popularidade
  const allCredits: TMDBPersonCredit[] = [
    ...data.cast.map((c: any) => ({ ...c, media_type: c.media_type })),
    ...data.crew.filter((c: any) => c.job === 'Director').map((c: any) => ({ ...c, media_type: c.media_type }))
  ];
  
  // Remove duplicatas por ID
  const uniqueCredits = allCredits.reduce((acc: TMDBPersonCredit[], curr) => {
    if (!acc.find(c => c.id === curr.id && c.media_type === curr.media_type)) {
      acc.push(curr);
    }
    return acc;
  }, []);
  
  // Ordena por data de lançamento (mais recente primeiro)
  return uniqueCredits.sort((a, b) => {
    const dateA = a.release_date || a.first_air_date || '';
    const dateB = b.release_date || b.first_air_date || '';
    return dateB.localeCompare(dateA);
  });
}

// =============== ACTION 11 — BUSCAR PESSOA POR NOME ===============

export async function searchPerson(name: string): Promise<{ id: number; name: string; profile_path: string | null }[]> {
  if (!name.trim()) return [];

  const response = await fetch(
    `https://api.themoviedb.org/3/search/person?query=${encodeURIComponent(name)}&language=pt-BR`,
    {
      method: "GET",
      headers: TMDB_HEADERS
    }
  );

  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status}`);
  }

  const data = await response.json();
  return data.results.slice(0, 5).map((p: any) => ({
    id: p.id,
    name: p.name,
    profile_path: p.profile_path
  }));
}

// =============== ACTION 12 — DISCOVER (FILMES POR GÊNERO/FILTROS) ===============

export async function discoverMovies(options: { genreId?: number; page?: number } = {}): Promise<TMDBMovie[]> {
  const params = new URLSearchParams({
    language: 'pt-BR',
    sort_by: 'popularity.desc',
    page: String(options.page || 1)
  });
  
  if (options.genreId) {
    params.append('with_genres', String(options.genreId));
  }

  const response = await fetch(
    `https://api.themoviedb.org/3/discover/movie?${params}`,
    {
      method: "GET",
      headers: TMDB_HEADERS
    }
  );

  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status}`);
  }

  const data = await response.json();
  return data.results;
}

export async function discoverTVShows(options: { genreId?: number; page?: number } = {}): Promise<TMDBTVShow[]> {
  const params = new URLSearchParams({
    language: 'pt-BR',
    sort_by: 'popularity.desc',
    page: String(options.page || 1)
  });
  
  if (options.genreId) {
    params.append('with_genres', String(options.genreId));
  }

  const response = await fetch(
    `https://api.themoviedb.org/3/discover/tv?${params}`,
    {
      method: "GET",
      headers: TMDB_HEADERS
    }
  );

  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status}`);
  }

  const data = await response.json();
  return data.results;
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

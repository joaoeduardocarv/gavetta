import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TMDB_TOKEN = Deno.env.get('TMDB_TOKEN');
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

const TMDB_HEADERS = {
  "Authorization": `Bearer ${TMDB_TOKEN}`,
  "Accept": "application/json"
};

// =============== CACHE ===============
interface CacheEntry {
  data: unknown;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

// TTL em milissegundos por tipo de dados
const CACHE_TTL = {
  search: 5 * 60 * 1000,        // 5 minutos para buscas
  details: 60 * 60 * 1000,      // 1 hora para detalhes (raramente mudam)
  credits: 24 * 60 * 60 * 1000, // 24 horas para elenco (quase nunca muda)
  providers: 6 * 60 * 60 * 1000, // 6 horas para providers (mudam ocasionalmente)
  discover: 30 * 60 * 1000,     // 30 minutos para discover
  person: 24 * 60 * 60 * 1000,  // 24 horas para dados de pessoa
};

function getCacheKey(action: string, params: URLSearchParams): string {
  const sortedParams = [...params.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  return `${action}:${sortedParams.map(([k, v]) => `${k}=${v}`).join('&')}`;
}

function getTTLForAction(action: string): number {
  if (action.includes('search') || action === 'searchPerson') return CACHE_TTL.search;
  if (action.includes('Details')) return CACHE_TTL.details;
  if (action.includes('Credits') || action === 'getPersonCredits') return CACHE_TTL.credits;
  if (action.includes('Providers')) return CACHE_TTL.providers;
  if (action.includes('discover')) return CACHE_TTL.discover;
  if (action.includes('Person')) return CACHE_TTL.person;
  return CACHE_TTL.search; // default
}

function getFromCache(key: string, ttl: number): unknown | null {
  const entry = cache.get(key);
  if (!entry) return null;
  
  const isExpired = Date.now() - entry.timestamp > ttl;
  if (isExpired) {
    cache.delete(key);
    return null;
  }
  
  return entry.data;
}

function setCache(key: string, data: unknown): void {
  // Limitar tamanho do cache (máximo 500 entradas)
  if (cache.size >= 500) {
    // Remove as 100 entradas mais antigas
    const entries = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
    entries.slice(0, 100).forEach(([key]) => cache.delete(key));
  }
  
  cache.set(key, { data, timestamp: Date.now() });
}

// =============== TMDB FETCH ===============

async function fetchTMDB(endpoint: string): Promise<Response> {
  const response = await fetch(`${TMDB_BASE_URL}${endpoint}`, {
    method: "GET",
    headers: TMDB_HEADERS
  });
  
  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status}`);
  }
  
  return response;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    
    if (!action) {
      return new Response(
        JSON.stringify({ error: 'Action is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Gerar chave de cache
    const cacheKey = getCacheKey(action, url.searchParams);
    const ttl = getTTLForAction(action);
    
    // Verificar cache
    const cachedData = getFromCache(cacheKey, ttl);
    if (cachedData !== null) {
      console.log(`Cache HIT for: ${action}`);
      return new Response(
        JSON.stringify(cachedData),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'HIT' } }
      );
    }
    
    console.log(`Cache MISS for: ${action} - Fetching from TMDB...`);
    
    let data: unknown;
    
    switch (action) {
      case 'searchMovies': {
        const query = url.searchParams.get('query');
        if (!query?.trim()) {
          data = [];
        } else {
          const response = await fetchTMDB(`/search/movie?query=${encodeURIComponent(query)}&language=pt-BR`);
          const result = await response.json();
          data = result.results;
        }
        break;
      }
      
      case 'searchTVShows': {
        const query = url.searchParams.get('query');
        if (!query?.trim()) {
          data = [];
        } else {
          const response = await fetchTMDB(`/search/tv?query=${encodeURIComponent(query)}&language=pt-BR`);
          const result = await response.json();
          data = result.results;
        }
        break;
      }
      
      case 'getMovieDetails': {
        const movieId = url.searchParams.get('movieId');
        const response = await fetchTMDB(`/movie/${movieId}?language=pt-BR`);
        data = await response.json();
        break;
      }
      
      case 'getMovieCredits': {
        const movieId = url.searchParams.get('movieId');
        const response = await fetchTMDB(`/movie/${movieId}/credits?language=pt-BR`);
        const result = await response.json();
        data = { cast: result.cast, crew: result.crew };
        break;
      }
      
      case 'getTVDetails': {
        const tvId = url.searchParams.get('tvId');
        const response = await fetchTMDB(`/tv/${tvId}?language=pt-BR`);
        data = await response.json();
        break;
      }
      
      case 'getTVCredits': {
        const tvId = url.searchParams.get('tvId');
        const response = await fetchTMDB(`/tv/${tvId}/credits?language=pt-BR`);
        const result = await response.json();
        data = { cast: result.cast, crew: result.crew };
        break;
      }
      
      case 'getSeasonEpisodes': {
        const tvId = url.searchParams.get('tvId');
        const seasonNumber = url.searchParams.get('seasonNumber');
        const response = await fetchTMDB(`/tv/${tvId}/season/${seasonNumber}?language=pt-BR`);
        const result = await response.json();
        data = result.episodes;
        break;
      }
      
      case 'getMovieWatchProviders': {
        const movieId = url.searchParams.get('movieId');
        const response = await fetchTMDB(`/movie/${movieId}/watch/providers`);
        const result = await response.json();
        data = result.results?.BR || null;
        break;
      }
      
      case 'getTVWatchProviders': {
        const tvId = url.searchParams.get('tvId');
        const response = await fetchTMDB(`/tv/${tvId}/watch/providers`);
        const result = await response.json();
        data = result.results?.BR || null;
        break;
      }
      
      case 'getPersonDetails': {
        const personId = url.searchParams.get('personId');
        const response = await fetchTMDB(`/person/${personId}?language=pt-BR`);
        data = await response.json();
        break;
      }
      
      case 'getPersonCredits': {
        const personId = url.searchParams.get('personId');
        const response = await fetchTMDB(`/person/${personId}/combined_credits?language=pt-BR`);
        const result = await response.json();
        
        // Combina cast e crew, removendo duplicatas
        interface CreditItem {
          id: number;
          media_type: 'movie' | 'tv';
          job?: string;
          release_date?: string;
          first_air_date?: string;
          [key: string]: unknown;
        }
        
        const allCredits: CreditItem[] = [
          ...result.cast.map((c: CreditItem) => ({ ...c, media_type: c.media_type })),
          ...result.crew.filter((c: CreditItem) => c.job === 'Director').map((c: CreditItem) => ({ ...c, media_type: c.media_type }))
        ];
        
        const uniqueCredits = allCredits.reduce((acc: CreditItem[], curr) => {
          if (!acc.find(c => c.id === curr.id && c.media_type === curr.media_type)) {
            acc.push(curr);
          }
          return acc;
        }, []);
        
        // Ordena por data
        data = uniqueCredits.sort((a, b) => {
          const dateA = a.release_date || a.first_air_date || '';
          const dateB = b.release_date || b.first_air_date || '';
          return dateB.localeCompare(dateA);
        });
        break;
      }
      
      case 'searchPerson': {
        const query = url.searchParams.get('query');
        if (!query?.trim()) {
          data = [];
        } else {
          const response = await fetchTMDB(`/search/person?query=${encodeURIComponent(query)}&language=pt-BR`);
          const result = await response.json();
          data = result.results.slice(0, 5).map((p: { id: number; name: string; profile_path: string | null }) => ({
            id: p.id,
            name: p.name,
            profile_path: p.profile_path
          }));
        }
        break;
      }
      
      case 'discoverMovies': {
        const genreId = url.searchParams.get('genreId');
        const page = url.searchParams.get('page') || '1';
        const params = new URLSearchParams({
          language: 'pt-BR',
          sort_by: 'popularity.desc',
          page
        });
        if (genreId) params.append('with_genres', genreId);
        
        const response = await fetchTMDB(`/discover/movie?${params}`);
        const result = await response.json();
        data = result.results;
        break;
      }
      
      case 'discoverTVShows': {
        const genreId = url.searchParams.get('genreId');
        const page = url.searchParams.get('page') || '1';
        const params = new URLSearchParams({
          language: 'pt-BR',
          sort_by: 'popularity.desc',
          page
        });
        if (genreId) params.append('with_genres', genreId);
        
        const response = await fetchTMDB(`/discover/tv?${params}`);
        const result = await response.json();
        data = result.results;
        break;
      }
      
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
    
    // Salvar no cache
    setCache(cacheKey, data);
    
    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'MISS' } }
    );
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('TMDB Edge Function error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

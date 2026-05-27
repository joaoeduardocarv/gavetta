import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
  trending: 30 * 60 * 1000,     // 30 minutos para trending
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
  if (action.includes('trending') || action.includes('Trending')) return CACHE_TTL.trending;
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

async function fetchTMDB(endpoint: string, retries = 3): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(`${TMDB_BASE_URL}${endpoint}`, {
        method: "GET",
        headers: TMDB_HEADERS,
        signal: controller.signal,
      });

      if (!response.ok) {
        // Consume body to avoid leaks before retrying
        try { await response.text(); } catch { /* ignore */ }
        throw new Error(`TMDB API error: ${response.status}`);
      }

      // Read body as text first so we can detect empty/truncated responses
      // and avoid the cryptic "unexpected end of file" from response.json().
      let text: string;
      try {
        text = await response.text();
      } catch (readErr) {
        throw new Error(
          `TMDB body read failed: ${readErr instanceof Error ? readErr.message : String(readErr)}`,
        );
      }

      if (!text || text.trim().length === 0) {
        throw new Error("TMDB API returned empty body");
      }

      // Validate JSON before returning so the caller's .json() never sees garbage
      try {
        JSON.parse(text);
      } catch {
        throw new Error("TMDB API returned invalid JSON");
      }

      return new Response(text, {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      lastError = err;
      console.warn(
        `fetchTMDB attempt ${attempt + 1}/${retries + 1} failed for ${endpoint}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("TMDB fetch failed");
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // Public read-only actions can be called without an authenticated user
    // (used by /share/:type/:tmdbId public pages).
    const PUBLIC_ACTIONS = new Set([
      'getMovieDetails',
      'getTVDetails',
      'getMovieCredits',
      'getTVCredits',
      'getMovieWatchProviders',
      'getTVWatchProviders',
      'getSeasonEpisodes',
    ]);

    const authHeader = req.headers.get('Authorization');
    const isPublicAction = action ? PUBLIC_ACTIONS.has(action) : false;

    if (!isPublicAction) {
      if (!authHeader?.startsWith('Bearer ')) {
        console.log('TMDB: Missing or invalid authorization header');
        return new Response(
          JSON.stringify({ error: 'Unauthorized - Missing authorization' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      );

      const token = authHeader.replace('Bearer ', '');
      const { data: claimsData, error: authError } = await supabaseClient.auth.getClaims(token);

      if (authError || !claimsData?.claims) {
        console.log('TMDB: Invalid or expired token', authError?.message);
        return new Response(
          JSON.stringify({ error: 'Unauthorized - Invalid or expired token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`TMDB: Authenticated request from user: ${claimsData.claims.sub}`);
    } else {
      console.log(`TMDB: Public request for action: ${action}`);
    }

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
        // Append release_dates so we can detect if the movie is currently in theaters in BR.
        const response = await fetchTMDB(`/movie/${movieId}?language=pt-BR&append_to_response=release_dates`);
        const result = await response.json();

        // Compute `isInTheaters` for Brazil from the release_dates payload.
        // TMDB type codes: 1=Premiere, 2=Theatrical (limited), 3=Theatrical, 4=Digital, 5=Physical, 6=TV
        let isInTheaters = false;
        try {
          const brEntry = result?.release_dates?.results?.find((r: { iso_3166_1: string }) => r.iso_3166_1 === 'BR');
          const theatricalDates: string[] = (brEntry?.release_dates ?? [])
            .filter((rd: { type: number; release_date: string }) => rd.type === 2 || rd.type === 3)
            .map((rd: { release_date: string }) => rd.release_date)
            .filter(Boolean);

          if (theatricalDates.length > 0) {
            // Earliest theatrical release in BR
            const earliest = theatricalDates.sort()[0];
            const releaseTime = new Date(earliest).getTime();
            const now = Date.now();
            // Average theatrical window ≈ 45 days; we use 60 to be slightly inclusive,
            // but only mark as "in theaters" if the release date is in the past or today.
            const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;
            if (!isNaN(releaseTime) && releaseTime <= now && now - releaseTime <= SIXTY_DAYS_MS) {
              isInTheaters = true;
            }
          }
        } catch (err) {
          console.warn('Failed to compute isInTheaters:', err);
        }

        // Strip the heavy release_dates blob from the response — we only need the boolean.
        const { release_dates: _omit, ...rest } = result;
        data = { ...rest, isInTheaters };
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
        const genreIds = url.searchParams.get('genreIds');
        const page = url.searchParams.get('page') || '1';
        const params = new URLSearchParams({
          language: 'pt-BR',
          sort_by: 'popularity.desc',
          page
        });
        if (genreIds) params.append('with_genres', genreIds);
        else if (genreId) params.append('with_genres', genreId);
        
        const response = await fetchTMDB(`/discover/movie?${params}`);
        const result = await response.json();
        data = result.results;
        break;
      }
      
      case 'discoverTVShows': {
        const genreId = url.searchParams.get('genreId');
        const genreIds = url.searchParams.get('genreIds');
        const page = url.searchParams.get('page') || '1';
        const params = new URLSearchParams({
          language: 'pt-BR',
          sort_by: 'popularity.desc',
          page
        });
        if (genreIds) params.append('with_genres', genreIds);
        else if (genreId) params.append('with_genres', genreId);
        
        const response = await fetchTMDB(`/discover/tv?${params}`);
        const result = await response.json();
        data = result.results;
        break;
      }
      
      case 'getTrendingMovies': {
        const timeWindow = url.searchParams.get('timeWindow') || 'day';
        const response = await fetchTMDB(`/trending/movie/${timeWindow}?language=pt-BR`);
        const result = await response.json();
        data = result.results;
        break;
      }
      
      case 'getTrendingTV': {
        const timeWindow = url.searchParams.get('timeWindow') || 'day';
        const response = await fetchTMDB(`/trending/tv/${timeWindow}?language=pt-BR`);
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
    let clientMsg = 'An unexpected error occurred.';
    if (error instanceof Error) {
      const m = error.message.toLowerCase();
      if (m.includes('timeout') || m.includes('abort')) clientMsg = 'Service temporarily unavailable.';
      else if (m.includes('key') || m.includes('config') || m.includes('credential')) clientMsg = 'Service configuration error.';
      else if (m.includes('api') || m.includes('fetch')) clientMsg = 'Unable to retrieve data. Try again.';
    }
    return new Response(
      JSON.stringify({ error: clientMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

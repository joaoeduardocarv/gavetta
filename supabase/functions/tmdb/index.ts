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
    
    console.log(`TMDB Edge Function called with action: ${action}`);
    
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
    
    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

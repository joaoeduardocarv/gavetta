import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const TMDB_TOKEN = Deno.env.get('TMDB_TOKEN');
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

const TMDB_HEADERS = {
  "Authorization": `Bearer ${TMDB_TOKEN}`,
  "Accept": "application/json"
};

async function fetchTMDB(endpoint: string): Promise<unknown> {
  const response = await fetch(`${TMDB_BASE_URL}${endpoint}`, {
    method: "GET",
    headers: TMDB_HEADERS
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`TMDB API error ${response.status}: ${body}`);
  }
  return response.json();
}

async function enrichProduction(productionId: string, productionType: string): Promise<Record<string, unknown> | null> {
  try {
    const mediaType = productionType === 'movie' ? 'movie' : 'tv';
    const idParam = mediaType === 'movie' ? 'movieId' : 'tvId';

    // Fetch details
    const details = await fetchTMDB(`/${mediaType}/${productionId}?language=pt-BR`) as Record<string, unknown>;

    // Fetch credits
    const creditsRes = await fetchTMDB(`/${mediaType}/${productionId}/credits?language=pt-BR`) as { cast: unknown[]; crew: { job: string; name: string }[] };
    const director = creditsRes.crew?.find((c) => c.job === 'Director')?.name || null;
    const cast = creditsRes.cast?.slice(0, 10) || [];

    // Fetch watch providers (BR)
    const providersRes = await fetchTMDB(`/${mediaType}/${productionId}/watch/providers`) as { results?: { BR?: unknown } };
    const providers = providersRes.results?.BR || null;

    // Build enriched data
    const enriched: Record<string, unknown> = {
      id: details.id,
      title: details.title || details.name,
      name: details.name || details.title,
      overview: details.overview,
      poster_path: details.poster_path,
      backdrop_path: details.backdrop_path,
      vote_average: details.vote_average,
      release_date: details.release_date || details.first_air_date,
      first_air_date: details.first_air_date,
      genres: details.genres,
      runtime: details.runtime,
      number_of_seasons: details.number_of_seasons,
      number_of_episodes: details.number_of_episodes,
      status: details.status,
      director,
      cast,
      watch_providers: providers,
      _last_refreshed: new Date().toISOString(),
    };

    return enriched;
  } catch (error) {
    console.error(`Failed to enrich ${productionType}/${productionId}:`, error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase credentials');
    }
    if (!TMDB_TOKEN) {
      throw new Error('Missing TMDB_TOKEN');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get all unique production_id + production_type combinations
    const { data: assignments, error: fetchError } = await supabase
      .from('user_drawer_assignments')
      .select('production_id, production_type')
      .limit(1000);

    if (fetchError) {
      throw new Error(`Failed to fetch assignments: ${fetchError.message}`);
    }

    // Deduplicate
    const uniqueProductions = new Map<string, string>();
    for (const a of assignments || []) {
      const key = `${a.production_type}:${a.production_id}`;
      if (!uniqueProductions.has(key)) {
        uniqueProductions.set(key, a.production_type);
      }
    }

    console.log(`Refreshing ${uniqueProductions.size} unique productions...`);

    let updated = 0;
    let failed = 0;

    // Process in batches of 5 to respect TMDB rate limits (~40 req/10s)
    const entries = [...uniqueProductions.entries()];
    for (let i = 0; i < entries.length; i += 5) {
      const batch = entries.slice(i, i + 5);

      const results = await Promise.allSettled(
        batch.map(async ([key, type]) => {
          const rawId = key.split(':')[1];
          // Strip prefix like "movie-" or "tv-" to get the numeric TMDB id
          const numericId = rawId.replace(/^(movie|tv)-/, '');
          const enrichedData = await enrichProduction(numericId, type);

          if (!enrichedData) {
            failed++;
            return;
          }

          // Update all assignments with this production
          const { error: updateError } = await supabase
            .from('user_drawer_assignments')
            .update({ production_data: enrichedData })
            .eq('production_id', productionId)
            .eq('production_type', type);

          if (updateError) {
            console.error(`Failed to update ${key}:`, updateError.message);
            failed++;
          } else {
            updated++;
          }
        })
      );

      // Small delay between batches to respect rate limits
      if (i + 5 < entries.length) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    const summary = {
      total: uniqueProductions.size,
      updated,
      failed,
      timestamp: new Date().toISOString(),
    };

    console.log('Refresh complete:', JSON.stringify(summary));

    return new Response(
      JSON.stringify(summary),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Refresh error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

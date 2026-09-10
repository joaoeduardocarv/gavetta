import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const OMDB_API_KEY = Deno.env.get('OMDB_API_KEY');
const TMDB_API_KEY = Deno.env.get('TMDB_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const STALE_DAYS = 30;

interface ParsedAwards {
  oscar_wins: number;
  oscar_nominations: number;
  globe_wins: number;
  globe_nominations: number;
  emmy_wins: number;
  emmy_nominations: number;
  total_wins: number;
  total_nominations: number;
  has_awards: boolean;
}

const EMPTY: ParsedAwards = {
  oscar_wins: 0,
  oscar_nominations: 0,
  globe_wins: 0,
  globe_nominations: 0,
  emmy_wins: 0,
  emmy_nominations: 0,
  total_wins: 0,
  total_nominations: 0,
  has_awards: false,
};

export function parseAwards(raw: string | null | undefined): ParsedAwards {
  const result: ParsedAwards = { ...EMPTY };
  if (!raw || raw === 'N/A') return result;
  const text = raw.toLowerCase();

  const num = (s: string) => {
    const words: Record<string, number> = {
      one: 1, two: 2, three: 3, four: 4, five: 5,
      six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    };
    return words[s] ?? (parseInt(s, 10) || 0);
  };
  const N = '(\\d+|one|two|three|four|five|six|seven|eight|nine|ten)';

  // "Won 2 Oscars." / "Won 1 Primetime Emmy." / "Won 3 Golden Globes."
  const wonOscar = text.match(new RegExp(`won ${N} oscar`));
  if (wonOscar) result.oscar_wins = num(wonOscar[1]);
  const nomOscar = text.match(new RegExp(`nominated for ${N} oscar`));
  if (nomOscar) result.oscar_nominations = num(nomOscar[1]);

  const wonGlobe = text.match(new RegExp(`won ${N} golden globe`));
  if (wonGlobe) result.globe_wins = num(wonGlobe[1]);
  const nomGlobe = text.match(new RegExp(`nominated for ${N} golden globe`));
  if (nomGlobe) result.globe_nominations = num(nomGlobe[1]);

  const wonEmmy = text.match(new RegExp(`won ${N} (?:primetime )?emmy`));
  if (wonEmmy) result.emmy_wins = num(wonEmmy[1]);
  const nomEmmy = text.match(new RegExp(`nominated for ${N} (?:primetime )?emmy`));
  if (nomEmmy) result.emmy_nominations = num(nomEmmy[1]);

  // "158 wins & 271 nominations total"
  const wins = text.match(/(\d+)\s+wins?/);
  if (wins) result.total_wins = parseInt(wins[1], 10);
  const noms = text.match(/(\d+)\s+nominations?/);
  if (noms) result.total_nominations = parseInt(noms[1], 10);

  result.total_wins = Math.max(
    result.total_wins,
    result.oscar_wins + result.globe_wins + result.emmy_wins,
  );
  result.total_nominations = Math.max(
    result.total_nominations,
    result.oscar_nominations + result.globe_nominations + result.emmy_nominations,
  );
  result.has_awards = result.total_wins > 0 || result.total_nominations > 0;
  return result;
}

async function fetchImdbId(mediaType: string, tmdbId: number): Promise<string | null> {
  if (!TMDB_API_KEY) return null;
  const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return data?.imdb_id || null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const url = new URL(req.url);
    let mediaType = url.searchParams.get('mediaType');
    let tmdbIdRaw = url.searchParams.get('tmdbId');

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      mediaType = body.mediaType ?? mediaType;
      tmdbIdRaw = body.tmdbId != null ? String(body.tmdbId) : tmdbIdRaw;
    }

    if (mediaType !== 'movie' && mediaType !== 'tv') {
      return json({ error: 'mediaType must be "movie" or "tv"' }, 400);
    }
    const tmdbId = parseInt(String(tmdbIdRaw), 10);
    if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
      return json({ error: 'tmdbId must be a positive integer' }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: cached } = await supabase
      .from('title_awards')
      .select('*')
      .eq('media_type', mediaType)
      .eq('tmdb_id', tmdbId)
      .maybeSingle();

    const isFresh =
      cached &&
      Date.now() - new Date(cached.fetched_at).getTime() < STALE_DAYS * 86400000;

    if (isFresh) return json({ awards: cached, cached: true });

    if (!OMDB_API_KEY) {
      return json({ awards: cached ?? null, cached: Boolean(cached), warning: 'OMDB_API_KEY not configured' });
    }

    const imdbId = cached?.imdb_id || (await fetchImdbId(mediaType, tmdbId));
    if (!imdbId) {
      return json({ awards: cached ?? null, cached: Boolean(cached), warning: 'imdb_id not found' });
    }

    const omdbRes = await fetch(
      `https://www.omdbapi.com/?i=${encodeURIComponent(imdbId)}&apikey=${OMDB_API_KEY}`,
    );
    if (!omdbRes.ok) {
      return json({ awards: cached ?? null, cached: Boolean(cached), warning: `omdb ${omdbRes.status}` });
    }
    const omdb = await omdbRes.json();
    if (omdb?.Response === 'False') {
      return json({ awards: cached ?? null, cached: Boolean(cached), warning: omdb?.Error ?? 'omdb error' });
    }

    const parsed = parseAwards(omdb?.Awards);
    const row = {
      media_type: mediaType,
      tmdb_id: tmdbId,
      imdb_id: imdbId,
      raw_text: omdb?.Awards && omdb.Awards !== 'N/A' ? omdb.Awards : null,
      ...parsed,
      fetched_at: new Date().toISOString(),
    };

    const { data: saved, error } = await supabase
      .from('title_awards')
      .upsert(row, { onConflict: 'media_type,tmdb_id' })
      .select()
      .maybeSingle();

    if (error) {
      console.error('upsert failed', error);
      return json({ awards: { ...row }, cached: false });
    }

    return json({ awards: saved, cached: false });
  } catch (err) {
    console.error('awards error', err);
    return json({ awards: null, error: 'unexpected error' }, 200);
  }
});

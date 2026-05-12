import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GNEWS_API_KEY = Deno.env.get('GNEWS_API_KEY');
const GNEWS_BASE_URL = 'https://gnews.io/api/v4';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('GNews: Missing or invalid authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Missing authorization', news: [] }),
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
      console.log('GNews: Invalid or expired token', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid or expired token', news: [] }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;
    console.log(`GNews: Authenticated request from user: ${userId}`);

    if (!GNEWS_API_KEY) {
      console.error('GNEWS_API_KEY not configured');
      throw new Error('API key not configured');
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'movies';
    const query = url.searchParams.get('query') || '';
    const language = url.searchParams.get('lang') || 'pt';
    const country = url.searchParams.get('country') || 'br';
    const max = url.searchParams.get('max') || '10';

    // Use search endpoint with cinema/series keywords for better results
    const endpoint = '/search';
    const params = new URLSearchParams({
      apikey: GNEWS_API_KEY,
      lang: language,
      country: country,
      max: max,
      // Restrict matching to title + description so unrelated body mentions
      // (e.g. a sports article that happens to namedrop "Netflix") don't slip in.
      in: 'title,description',
      // GNews supports comma-separated topic exclusions; avoids sports feeds entirely.
      // Note: GNews ignores `topic` on /search, but `excludetopics` works on the search endpoint.
      excludetopics: 'sports',
      sortby: 'publishedAt',
    });

    // Define search query based on action.
    // GNews limits `q` to 200 characters, so keep includes/excludes compact.
    let searchQuery = query;
    if (!query || action === 'movies') {
      // Keep API query short (200-char limit). Heavy filtering happens client-side
      // via SPORT_DENYLIST + CINEMA_ALLOWLIST below.
      const include = [
        'filme', 'série', 'temporada', 'cinema', 'trailer', 'estreia',
        'Netflix', 'HBO', '"Disney+"', 'Globoplay', 'Marvel', 'Oscar',
      ].join(' OR ');
      searchQuery = `(${include}) AND NOT futebol AND NOT esporte AND NOT economia`;
    }
    if (searchQuery.length > 200) {
      searchQuery = searchQuery.slice(0, 200);
    }
    params.append('q', searchQuery);

    console.log(`Fetching news from GNews API: ${endpoint} with query: ${searchQuery}`);

    // Add timeout controller
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await fetch(`${GNEWS_BASE_URL}${endpoint}?${params.toString()}`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('GNews API error:', response.status, errorText);
        throw new Error(`GNews API error: ${response.status}`);
      }

      const data = await response.json();
      console.log(`Successfully fetched ${data.articles?.length || 0} news articles`);

      // Post-filter: drop sports, economy, health, politics, and other off-topic news.
      const SPORT_DENYLIST = [
        // Sports
        /\bfutebol\b/i, /\bjogador(a)?\b/i, /\bgol(s)?\b/i, /\bcampeonato\b/i,
        /\bbrasileir(ã|a)o\b/i, /\blibertadores\b/i, /\bchampions\s+league\b/i,
        /\bcopa\s+(do|da)\b/i, /\bseleção\b/i, /\btécnico\b.*\b(time|clube)\b/i,
        /\bnba\b/i, /\bnfl\b/i, /\bufc\b/i, /\bmma\b/i, /\bboxe\b/i,
        /\bf[óo]rmula\s*1\b/i, /\bf1\b/i, /\bgp\s+(do|de|da)\b/i, /\bgrand\s*prix\b/i,
        /\besport(e|es|iv[oa])\b/i, /\bvit[óo]ria\b.*\b(time|jogo)\b/i,
        /\be[\-\s]?sports?\b/i, /\bvalorant\b/i, /\bcs\s*2\b/i, /\bleague\s+of\s+legends\b/i,
        /\batleta\b/i, /\btreinador(a)?\b/i, /\bolimp[íi]ad/i,
        // Economy / finance
        /\beconomia\b/i, /\beconômic[oa]\b/i, /\bmercado\s+financeiro\b/i,
        /\bbolsa\s+de\s+valores\b/i, /\bibovespa\b/i, /\bd[óo]lar\b/i, /\beuro\b/i,
        /\binfla[çc][ãa]o\b/i, /\bpib\b/i, /\bjuros\b/i, /\bselic\b/i,
        /\bfundo\s+(imobili|de)\b/i, /\bcripto(moeda)?s?\b/i, /\bbitcoin\b/i,
        /\bcâmbio\b/i, /\bbanco\s+central\b/i, /\bdesemprego\b/i,
        // Health / virus / disease
        /\bv[íi]rus\b/i, /\bcovid(\-?19)?\b/i, /\bgripe\b/i, /\bdengue\b/i,
        /\bsa[úu]de\b/i, /\bdoen[çc]a\b/i, /\bsurto\b/i, /\bepidemia\b/i,
        /\bpandemia\b/i, /\bvacina(s|ção)?\b/i, /\bhospital\b/i,
        // Politics / war / crime
        /\bpol[íi]tica\b/i, /\beleiç[ãa]o\b/i, /\bgoverno\b/i, /\bpresidente\b/i,
        /\bcongresso\b/i, /\bsenad(o|or)\b/i, /\bdeputad[oa]\b/i,
        /\bguerra\b/i, /\bm[íi]ssil\b/i, /\bex[ée]rcito\b/i,
        /\bhomic[íi]dio\b/i, /\bassassinato\b/i, /\bpris[ãa]o\b/i,
      ];
      const isSportsy = (text: string) =>
        SPORT_DENYLIST.some((re) => re.test(text));

      // Whitelist: must mention at least one cinema/series/streaming signal.
      // Prevents generic "estreia" articles (e.g. an album release) from passing.
      const CINEMA_ALLOWLIST = [
        /\bfilme(s)?\b/i, /\bs[ée]rie(s)?\b/i, /\btemporada\b/i, /\bepis[óo]dio(s)?\b/i,
        /\bcinema(s)?\b/i, /\bbilheteria\b/i, /\btrailer\b/i, /\bestreia(s)?\b/i,
        /\bnetflix\b/i, /\bhbo\b/i, /\bdisney\+?\b/i, /\bprime\s+video\b/i,
        /\bamazon\s+prime\b/i, /\bapple\s+tv\b/i, /\bparamount\+?\b/i, /\bglobopla(y|i)\b/i,
        /\bmax\b/i, /\bstreaming\b/i, /\bhollywood\b/i, /\bdiretor(a)?\b/i,
        /\broteirista\b/i, /\belenco\b/i, /\boscar\b/i, /\bgolden\s+globe\b/i,
        /\bglobo\s+de\s+ouro\b/i, /\bcannes\b/i, /\bmarvel\b/i, /\bdc\b/i, /\bpixar\b/i,
        /\bdocument[áa]rio\b/i, /\bcurta[\-\s]?metragem\b/i, /\blongametragem\b/i,
      ];
      const looksLikeCinema = (text: string) =>
        CINEMA_ALLOWLIST.some((re) => re.test(text));

      const filteredArticles = (data.articles || []).filter((article: any) => {
        const haystack = `${article.title ?? ''} ${article.description ?? ''}`;
        if (isSportsy(haystack)) return false;
        if (!looksLikeCinema(haystack)) return false;
        return true;
      });

      console.log(
        `Filtered ${data.articles?.length || 0} → ${filteredArticles.length} cinema-relevant articles`
      );

      // Transform GNews response to match our expected format
      const transformedNews = filteredArticles.map((article: any, index: number) => ({
        id: `gnews-${index}-${Date.now()}`,
        title: article.title,
        description: article.description,
        published: article.publishedAt,
        url: article.url,
        image: article.image,
        author: article.source?.name || 'Unknown',
        source: article.source?.name,
      }));

      return new Response(JSON.stringify({ 
        news: transformedNews,
        totalArticles: data.totalArticles || transformedNews.length 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error('GNews API timeout');
        throw new Error('API timeout - tente novamente');
      }
      throw fetchError;
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in gnews function:', errorMessage);
    let clientMsg = 'An unexpected error occurred.';
    if (error instanceof Error) {
      const m = error.message.toLowerCase();
      if (m.includes('timeout') || m.includes('abort')) clientMsg = 'Service temporarily unavailable.';
      else if (m.includes('key') || m.includes('config') || m.includes('credential')) clientMsg = 'Service configuration error.';
      else if (m.includes('api') || m.includes('fetch')) clientMsg = 'Unable to retrieve data. Try again.';
    }
    return new Response(
      JSON.stringify({ error: clientMsg, news: [] }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

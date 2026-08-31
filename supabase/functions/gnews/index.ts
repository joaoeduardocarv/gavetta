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
      // Keep API query short (200-char limit). Heavy filtering happens server-side
      // via SPORT_DENYLIST + CINEMA_ALLOWLIST below.
      const include = [
        'filme', 'série', 'temporada', 'cinema', 'trailer', 'estreia',
        'Netflix', 'HBO', '"Disney+"', 'Globoplay', 'Marvel', 'Oscar',
      ].join(' OR ');
      const excludes = ['futebol', 'esporte', 'jogador', 'campeonato', 'gol'];
      searchQuery = `(${include})`;
      // Append exclusions one by one, never truncating mid-operator (GNews 400s on that).
      for (const term of excludes) {
        const next = `${searchQuery} AND NOT ${term}`;
        if (next.length > 200) break;
        searchQuery = next;
      }
    }
    if (searchQuery.length > 200) {
      // Only user-supplied queries can reach here; trim at a word boundary.
      searchQuery = searchQuery.slice(0, 200).replace(/\s+\S*$/, '');
    }
    params.append('q', searchQuery);


    // ---- Fontes próprias (RSS) — apenas sites aprovados ----
    const RSS_FEEDS = [
      'https://cinepop.com.br/feed/',
      'https://cinemacomrapadura.com.br/feed/',
      'https://www.cinematorio.com.br/feed',
      'https://rollingstone.com.br/canal/cinema/feed/',
    ];

    const decodeEntities = (s: string) =>
      s
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#0?39;|&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();

    const pick = (block: string, tag: string) => {
      const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
      return m ? decodeEntities(m[1]) : '';
    };

    const fetchFeed = async (feedUrl: string) => {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 8000);
        const res = await fetch(feedUrl, {
          signal: ctrl.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GavettaBot/1.0)' },
        });
        clearTimeout(t);
        if (!res.ok) return [];
        const xml = await res.text();
        const items = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
        return items.slice(0, 12).map((block) => {
          const imgMatch =
            block.match(/<media:content[^>]+url="([^"]+)"/i) ||
            block.match(/<enclosure[^>]+url="([^"]+)"/i) ||
            block.match(/<img[^>]+src="([^"]+)"/i);
          const link = pick(block, 'link');
          let host = '';
          try {
            host = new URL(link).hostname.replace(/^www\./, '');
          } catch { /* ignore */ }
          return {
            title: pick(block, 'title'),
            description: pick(block, 'description').slice(0, 240),
            publishedAt: pick(block, 'pubDate'),
            url: link,
            image: imgMatch ? imgMatch[1] : null,
            source: { name: host, url: link },
          };
        });
      } catch (e) {
        console.error('RSS feed error', feedUrl, (e as Error).message);
        return [];
      }
    };

    const rssArticles = (await Promise.all(RSS_FEEDS.map(fetchFeed))).flat();
    console.log(`RSS: ${rssArticles.length} artigos de fontes aprovadas`);

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
        // Gracefully degrade on upstream errors (e.g. 429 rate limit): serve RSS only
        const fallback = rssArticles
          .sort((a, b) => Date.parse(b.publishedAt || '') - Date.parse(a.publishedAt || ''))
          .slice(0, Number(max) || 10)
          .map((a, index) => ({
            id: `rss-${index}-${Date.now()}`,
            title: a.title,
            description: a.description,
            published: a.publishedAt,
            url: a.url,
            image: a.image,
            author: a.source?.name || 'Unknown',
            source: a.source?.name,
          }));
        return new Response(
          JSON.stringify({
            news: fallback,
            totalArticles: fallback.length,
            warning: response.status === 429 ? 'rate_limited' : 'upstream_error',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      }

      const data = await response.json();
      console.log(`Successfully fetched ${data.articles?.length || 0} news articles`);

      // Post-filter: drop sports, economy, health, politics, and other off-topic news.
      const SPORT_DENYLIST = [
        // Sports
        /\bfutebol\b/i, /\bfutsal\b/i, /\bjogador(a|es|as)?\b/i, /\bgol(s|eiro|aço)?\b/i,
        /\bcampeonato\b/i, /\bcampe[ãa]o(ato)?\b/i, /\bt[íi]tulo\s+(brasileiro|estadual|mundial)\b/i,
        /\bbrasileir(ã|a)o\b/i, /\blibertadores\b/i, /\bsul[\-\s]?americana\b/i,
        /\bchampions\s+league\b/i, /\bpremier\s+league\b/i, /\blaliga\b/i, /\bla\s+liga\b/i,
        /\bserie\s+a\s+(italiana|it[áa]lia)\b/i, /\bbundesliga\b/i, /\bligue\s*1\b/i,
        /\bcopa\s+(do|da|libertadores|am[ée]rica)\b/i, /\bmundial\s+de\s+clubes\b/i,
        /\bsele[çc][ãa]o\b/i, /\bt[ée]cnico\b/i, /\bescala[çc][ãa]o\b/i, /\bconvocad[oa]s?\b/i,
        /\bcontrata[çc][ãa]o\b/i, /\btransfer[êe]ncia\s+(de|do)\s+jogador\b/i,
        /\bflamengo\b/i, /\bcorinthians\b/i, /\bpalmeiras\b/i, /\bs[ãa]o\s+paulo\s+fc\b/i,
        /\bvasco\b/i, /\bfluminense\b/i, /\bbotafogo\b/i, /\bgr[êe]mio\b/i,
        /\binternacional\s+(x|vs)\b/i, /\bcruzeiro\b/i, /\batl[ée]tico[\-\s]?(mg|mineiro)\b/i,
        /\bsantos\s+fc\b/i, /\breal\s+madrid\b/i, /\bbarcelona\s+(fc|x|vs)\b/i,
        /\bneymar\b/i, /\bmessi\b/i, /\bcristiano\s+ronaldo\b/i, /\bvin[íi]cius\s+j[úu]nior\b/i,
        /\bnba\b/i, /\bnfl\b/i, /\bmlb\b/i, /\bnhl\b/i, /\bufc\b/i, /\bmma\b/i, /\bboxe\b/i,
        /\bv[ôo]lei\b/i, /\bbasquete\b/i, /\bt[êe]nis\b/i, /\batletismo\b/i, /\bnata[çc][ãa]o\b/i,
        /\bsurf(e|ista)?\b/i, /\bskate\b/i, /\bgin[áa]stica\b/i, /\bhandebol\b/i,
        /\bf[óo]rmula\s*1\b/i, /\bf1\b/i, /\bgp\s+(do|de|da)\b/i, /\bgrand\s*prix\b/i,
        /\bpole\s+position\b/i, /\bp[óo]dio\b/i, /\bmotogp\b/i, /\bstock\s+car\b/i,
        /\besport(e|es|iv[oa]|ivas)\b/i, /\bplacar\b/i, /\brodada\b/i, /\bartilheiro\b/i,
        /\bp[êe]nalti\b/i, /\bcart[ãa]o\s+(amarelo|vermelho)\b/i, /\best[áa]dio\b/i,
        /\btorcida\b/i, /\btorcedor(es|a)?\b/i, /\barbitr(o|agem)\b/i, /\bvar\b\s+/i,
        /\be[\-\s]?sports?\b/i, /\bvalorant\b/i, /\bcs\s*2\b/i, /\bleague\s+of\s+legends\b/i,
        /\batleta\b/i, /\btreinador(a)?\b/i, /\bolimp[íi]ad/i, /\bparalimp/i,
        /\bmedalha\s+(de\s+)?(ouro|prata|bronze)\b/i, /\bamistoso\b/i, /\bcl[áa]ssico\s+(regional|paulista|carioca)\b/i,

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
      // Allowlist: STRONG signals (any one is enough) vs WEAK signals (need 2+).
      // This avoids false positives like "trailer do novo álbum", "Max anuncia plano",
      // "DC anuncia gabinete", "Marvel" como sobrenome, etc.
      const STRONG_CINEMA_SIGNALS = [
        // Formats / production
        /\bfilme(s)?\b/i, /\bs[ée]rie(s)?\s+(de\s+tv|original|nova|brasileira|americana)?/i,
        /\btemporada\s+\d/i, /\bnova\s+temporada\b/i, /\bepis[óo]dio(s)?\b/i,
        /\bcinema(s)?\b/i, /\bbilheteria\b/i, /\blongametragem\b/i,
        /\bcurta[\-\s]?metragem\b/i, /\bdocument[áa]rio\b/i, /\banima(ção|ções)\b/i,
        // Streaming services as full names
        /\bnetflix\b/i, /\bdisney\s*\+/i, /\bdisney\s+plus\b/i,
        /\bprime\s+video\b/i, /\bamazon\s+prime\s+video\b/i, /\bapple\s+tv\s*\+?/i,
        /\bparamount\s*\+/i, /\bparamount\s+plus\b/i, /\bglobopla(y|i)\b/i,
        /\bhbo\s+max\b/i, /\bhbo\b/i, /\bmax\s+(stream|libera|anuncia|estreia)/i,
        /\bhulu\b/i, /\bmubi\b/i, /\bcrunchyroll\b/i,
        /\bpeacock\b/i, /\bpluto\s+tv\b/i, /\btubi\b/i,
        /\bdiscovery\+\b/i, /\bdiscovery\s+plus\b/i,
        /\bamc\+\b/i, /\bamc\s+plus\b/i,
        /\blionsgate\+\b/i, /\blionsgate\s+plus\b/i, /\bstarz(play)?\b/i,
        /\bbritbox\b/i, /\bshudder\b/i, /\bacorn\s+tv\b/i,
        /\bstar\+\b/i, /\bstar\s+plus\b/i,
        /\brakuten\s+tv\b/i, /\btelecine\b/i, /\bnow\b/i,
        /\byoutube\s+(premium|originals?)\b/i,
        /\bimdb\s+tv\b/i, /\bfreevee\b/i,
        /\badult\s+swim\b/i, /\bfx\b/i, /\btnt\b/i, /\btbs\b/i,
        /\bfubo(tv)?\b/i, /\bsling\s+tv\b/i, /\bdirectv\b/i,
        /\bclaro\s+video\b/i, /\bvivo\s+play\b/i,
        /\bbet\+\b/i, /\ballblk\b/i, /\bpantaya\b/i,
        // Industry / awards / festivals
        /\bhollywood\b/i, /\boscar\b/i, /\bgolden\s+globe\b/i, /\bglobo\s+de\s+ouro\b/i,
        /\bcannes\b/i, /\bberlim\s+festival\b/i, /\bfestival\s+de\s+(cinema|cannes|veneza|berlim|sundance)\b/i,
        /\bemm[yi]\b/i, /\bbafta\b/i, /\bsag\s+awards\b/i,
        // Roles
        /\bdiretor(a)?\s+(de\s+cinema|de\s+arte|do\s+filme|da\s+s[ée]rie)/i,
        /\broteirista\b/i, /\belenco\s+(do|da|de)\b/i, /\bator\s+principal\b/i,
        /\batriz\s+principal\b/i, /\bprotagoniza(r|do|da|m)\b/i,
        // Studios / franchises (unambiguous)
        /\bmarvel\s+studios\b/i, /\bmcu\b/i, /\bdc\s+(studios|comics|universe|films)\b/i,
        /\bpixar\b/i, /\ba24\b/i, /\bwarner\s+bros/i, /\buniversal\s+pictures\b/i,
        /\bsony\s+pictures\b/i, /\b20th\s+century\b/i, /\blucasfilm\b/i,
        // Spinoff / sequel language
        /\bspin[\-\s]?off\b/i, /\bcontinua[çc][ãa]o\b/i, /\bsequ[êe]ncia\b.*\bfilme\b/i,
        /\bremake\b/i, /\breboot\b/i, /\bprequel\b/i,
      ];

      // Weak signals — count only when paired with another weak signal,
      // since each one alone matches too many off-topic articles.
      const WEAK_CINEMA_SIGNALS = [
        /\bestreia(s|r|ram)?\b/i, /\btrailer\b/i, /\btemporada\b/i,
        /\bdiretor(a)?\b/i, /\belenco\b/i, /\bator(es)?\b/i, /\batriz(es)?\b/i,
        /\bstreaming\b/i, /\bplataforma\b/i, /\blan[çc]amento\b/i,
        /\bcatálogo\b/i, /\bassinatura\b/i, /\bdublag(em|ens)\b/i,
        /\blegendado\b/i, /\bprodu[çc][ãa]o\b/i, /\bcr[íi]tica(s)?\b/i,
      ];

      const looksLikeCinema = (text: string) => {
        if (STRONG_CINEMA_SIGNALS.some((re) => re.test(text))) return true;
        const weakHits = WEAK_CINEMA_SIGNALS.reduce(
          (n, re) => n + (re.test(text) ? 1 : 0),
          0,
        );
        return weakHits >= 2;
      };

      // Sports outlets / URL paths — block regardless of wording.
      const SPORTS_SOURCES = [
        /\bge\.globo\b/i, /\bespn\b/i, /\blance\b/i, /\bgazeta\s*esportiva\b/i,
        /\bsportbuzz\b/i, /\bitatiaia\s*esporte\b/i, /\bplacar\b/i, /\bfut/i,
        /\bgoal\.com\b/i, /\bmeu\s*time(fc)?\b/i, /\bsofascore\b/i, /\btrivela\b/i,
        /\bnetflancers\b/i, /\bolimpiada\b/i,
      ];
      const SPORTS_URL_PATHS = /\/(esporte|esportes|futebol|sports?|nba|nfl|f1|formula-?1|olimpiadas?)(\/|$|\?)/i;

      // Allowlist de domínios: se definida, SÓ esses sites aparecem.
      // Pode ser sobrescrita por requisição via ?domains=site1.com,site2.com
      const DEFAULT_ALLOWED_DOMAINS: string[] = [
        'cinematorio.com.br',
        'adorocinema.com',
        'cinepop.com.br',
        'rollingstone.com.br',
        'omelete.com.br',
        'jovemnerd.com.br',
        'cinemacomrapadura.com.br',
      ];

      const domainsParam = url.searchParams.get('domains') || '';
      const allowedDomains = (domainsParam
        ? domainsParam.split(',')
        : DEFAULT_ALLOWED_DOMAINS)
        .map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, ''))
        .filter(Boolean);

      const hostOf = (link: string) => {
        try {
          return new URL(link).hostname.toLowerCase().replace(/^www\./, '');
        } catch {
          return '';
        }
      };
      const isAllowedDomain = (article: any) => {
        if (allowedDomains.length === 0) return true;
        const host = hostOf(article.url ?? '') || hostOf(article.source?.url ?? '');
        if (!host) return false;
        return allowedDomains.some((d) => host === d || host.endsWith(`.${d}`));
      };

      const filteredArticles = (data.articles || []).filter((article: any) => {
        const haystack = `${article.title ?? ''} ${article.description ?? ''}`;
        const src = `${article.source?.name ?? ''} ${article.source?.url ?? ''}`;
        if (!isAllowedDomain(article)) return false;
        if (isSportsy(haystack)) return false;
        if (SPORTS_SOURCES.some((re) => re.test(src))) return false;
        if (typeof article.url === 'string' && SPORTS_URL_PATHS.test(article.url)) return false;
        if (!looksLikeCinema(haystack)) return false;
        return true;
      });


      // Junta RSS (fontes aprovadas) com GNews já restrito ao allowlist
      const rssFiltered = rssArticles.filter((a) => {
        const haystack = `${a.title ?? ''} ${a.description ?? ''}`;
        return !isSportsy(haystack);
      });

      const seen = new Set<string>();
      const merged = [...rssFiltered, ...filteredArticles].filter((a: any) => {
        const key = (a.url || a.title || '').split('?')[0];
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      merged.sort(
        (a: any, b: any) => Date.parse(b.publishedAt || '') - Date.parse(a.publishedAt || '')
      );

      console.log(
        `GNews ${data.articles?.length || 0} → ${filteredArticles.length}; RSS ${rssFiltered.length}; total ${merged.length}`
      );

      // Transform response to match our expected format
      const transformedNews = merged.slice(0, Number(max) || 10).map((article: any, index: number) => ({
        id: `news-${index}-${Date.now()}`,
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
        totalArticles: transformedNews.length 
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

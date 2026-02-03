import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    });

    // Define search query based on action
    let searchQuery = query;
    if (!query || action === 'movies') {
      // Search for movie and series related news - focused on entertainment
      searchQuery = 'Netflix OR "novo filme" OR "nova série" OR cinema OR streaming OR "Amazon Prime" OR "Disney+"';
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

      // Transform GNews response to match our expected format
      const transformedNews = (data.articles || []).map((article: any, index: number) => ({
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
    return new Response(
      JSON.stringify({ error: errorMessage, news: [] }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

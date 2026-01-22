import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CURRENTS_API_KEY = Deno.env.get('CURRENTS_API_KEY');
const CURRENTS_BASE_URL = 'https://api.currentsapi.services/v1';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!CURRENTS_API_KEY) {
      console.error('CURRENTS_API_KEY not configured');
      throw new Error('API key not configured');
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'latest';
    const query = url.searchParams.get('query') || '';
    const category = url.searchParams.get('category') || 'entertainment';
    const language = url.searchParams.get('language') || 'pt';

    let endpoint = '';
    const params = new URLSearchParams({
      apiKey: CURRENTS_API_KEY,
      language: language,
    });

    if (action === 'search' && query) {
      endpoint = '/search';
      params.append('keywords', query);
    } else {
      endpoint = '/latest-news';
      params.append('category', category);
    }

    console.log(`Fetching news from Currents API: ${endpoint}`);

    const response = await fetch(`${CURRENTS_BASE_URL}${endpoint}?${params.toString()}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Currents API error:', errorText);
      throw new Error(`Currents API error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`Successfully fetched ${data.news?.length || 0} news items`);

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in currents-news function:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage, news: [] }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

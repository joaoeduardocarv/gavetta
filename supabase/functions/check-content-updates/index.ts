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

interface ProviderEntry {
  provider_id: number;
  provider_name: string;
}

interface WatchProviders {
  flatrate?: ProviderEntry[];
  rent?: ProviderEntry[];
  buy?: ProviderEntry[];
}

function getProviderNames(providers: WatchProviders | null): string[] {
  if (!providers) return [];
  const names = new Set<string>();
  for (const entry of providers.flatrate || []) names.add(entry.provider_name);
  return [...names].sort();
}

function providersDiffer(oldProviders: WatchProviders | null, newProviders: WatchProviders | null): { added: string[]; removed: string[] } {
  const oldNames = getProviderNames(oldProviders);
  const newNames = getProviderNames(newProviders);
  const added = newNames.filter(n => !oldNames.includes(n));
  const removed = oldNames.filter(n => !newNames.includes(n));
  return { added, removed };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing Supabase credentials');
    if (!TMDB_TOKEN) throw new Error('Missing TMDB_TOKEN');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch assignments in "want_to_watch" and "watching" drawers
    const { data: assignments, error: fetchError } = await supabase
      .from('user_drawer_assignments')
      .select('id, user_id, production_id, production_type, production_data, drawer_id')
      .in('drawer_id', ['want_to_watch', 'watching'])
      .limit(1000);

    if (fetchError) throw new Error(`Failed to fetch assignments: ${fetchError.message}`);
    if (!assignments || assignments.length === 0) {
      return new Response(JSON.stringify({ message: 'No assignments to check', notifications: 0 }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Group by unique production to avoid duplicate TMDB calls
    const productionMap = new Map<string, {
      productionId: string;
      productionType: string;
      userIds: Set<string>;
      oldData: Record<string, unknown>;
    }>();

    for (const a of assignments) {
      const key = `${a.production_type}:${a.production_id}`;
      if (!productionMap.has(key)) {
        productionMap.set(key, {
          productionId: a.production_id,
          productionType: a.production_type,
          userIds: new Set([a.user_id]),
          oldData: (a.production_data as Record<string, unknown>) || {},
        });
      } else {
        productionMap.get(key)!.userIds.add(a.user_id);
      }
    }

    console.log(`Checking ${productionMap.size} unique productions for updates...`);

    // Fetch all user notification preferences
    const allUserIds = new Set<string>();
    for (const prod of productionMap.values()) {
      for (const uid of prod.userIds) allUserIds.add(uid);
    }

    const { data: prefsData } = await supabase
      .from('notification_preferences')
      .select('user_id, streaming_changes, new_seasons, new_episodes, upcoming_content')
      .in('user_id', [...allUserIds]);

    const userPrefs = new Map<string, Record<string, boolean>>();
    for (const p of prefsData || []) {
      userPrefs.set(p.user_id, p);
    }

    // Helper: check if user wants this notification type
    const userWants = (userId: string, type: string): boolean => {
      const p = userPrefs.get(userId);
      if (!p) return true; // default: all enabled
      const map: Record<string, string> = {
        streaming_change: 'streaming_changes',
        new_season: 'new_seasons',
        new_episodes: 'new_episodes',
        upcoming_content: 'upcoming_content',
      };
      const col = map[type];
      return col ? (p[col] !== false) : true;
    };

    let notificationsCreated = 0;
    const entries = [...productionMap.entries()];

    // Process in batches of 5
    for (let i = 0; i < entries.length; i += 5) {
      const batch = entries.slice(i, i + 5);

      await Promise.allSettled(
        batch.map(async ([_key, prod]) => {
          try {
            const mediaType = prod.productionType === 'movie' ? 'movie' : 'tv';
            const numericId = prod.productionId.replace(/^(movie|tv)-/, '');

            // Fetch current TMDB data
            const details = await fetchTMDB(`/${mediaType}/${numericId}?language=pt-BR`) as Record<string, unknown>;
            const providersRes = await fetchTMDB(`/${mediaType}/${numericId}/watch/providers`) as { results?: { BR?: WatchProviders } };
            const newProviders = providersRes.results?.BR || null;
            const oldProviders = (prod.oldData.watch_providers as WatchProviders) || null;

            const title = (details.title || details.name || 'Conteúdo') as string;
            const notifications: { user_id: string; type: string; title: string; message: string; related_content_id: string }[] = [];

            // 1. Check streaming provider changes
            const { added, removed } = providersDiffer(oldProviders, newProviders);
            if (added.length > 0 || removed.length > 0) {
              let message = '';
              if (added.length > 0) message += `Agora disponível em: ${added.join(', ')}. `;
              if (removed.length > 0) message += `Removido de: ${removed.join(', ')}.`;

              for (const userId of prod.userIds) {
                if (!userWants(userId, 'streaming_change')) continue;
                notifications.push({
                  user_id: userId,
                  type: 'streaming_change',
                  title: `📺 ${title}`,
                  message: message.trim(),
                  related_content_id: prod.productionId,
                });
              }
            }

            // 2. Check new seasons/episodes (TV only)
            if (mediaType === 'tv') {
              const oldSeasons = (prod.oldData.number_of_seasons as number) || 0;
              const newSeasons = (details.number_of_seasons as number) || 0;
              const oldEpisodes = (prod.oldData.number_of_episodes as number) || 0;
              const newEpisodes = (details.number_of_episodes as number) || 0;

              // Check for next season info (next_episode_to_air)
              const nextEpisode = details.next_episode_to_air as Record<string, unknown> | null;

              if (newSeasons > oldSeasons) {
                for (const userId of prod.userIds) {
                  if (!userWants(userId, 'new_season')) continue;
                  notifications.push({
                    user_id: userId,
                    type: 'new_season',
                    title: `🎬 Nova temporada: ${title}`,
                    message: `A temporada ${newSeasons} está disponível!`,
                    related_content_id: prod.productionId,
                  });
                }
              } else if (newEpisodes > oldEpisodes) {
                const diff = newEpisodes - oldEpisodes;
                for (const userId of prod.userIds) {
                  notifications.push({
                    user_id: userId,
                    type: 'new_episodes',
                    title: `🆕 ${title}`,
                    message: `${diff} novo${diff > 1 ? 's' : ''} episódio${diff > 1 ? 's' : ''} disponíve${diff > 1 ? 'is' : 'l'}!`,
                    related_content_id: prod.productionId,
                  });
                }
              }

              // Upcoming season/episode
              if (nextEpisode && nextEpisode.season_number && (nextEpisode.season_number as number) > oldSeasons) {
                const airDate = nextEpisode.air_date as string | undefined;
                if (airDate) {
                  // Only notify if air date is within next 7 days
                  const airDateObj = new Date(airDate);
                  const now = new Date();
                  const diffDays = (airDateObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
                  if (diffDays > 0 && diffDays <= 7) {
                    for (const userId of prod.userIds) {
                      notifications.push({
                        user_id: userId,
                        type: 'upcoming_content',
                        title: `📅 Em breve: ${title}`,
                        message: `Novo episódio em ${airDate}!`,
                        related_content_id: prod.productionId,
                      });
                    }
                  }
                }
              }
            }

            // Insert notifications (deduplicate: don't send same notification twice in 24h)
            for (const notif of notifications) {
              const { data: existing } = await supabase
                .from('notifications')
                .select('id')
                .eq('user_id', notif.user_id)
                .eq('type', notif.type)
                .eq('related_content_id', notif.related_content_id)
                .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
                .limit(1);

              if (!existing || existing.length === 0) {
                const { error: insertError } = await supabase
                  .from('notifications')
                  .insert(notif);

                if (insertError) {
                  console.error(`Failed to insert notification:`, insertError.message);
                } else {
                  notificationsCreated++;
                }
              }
            }

            // Update production_data with new info for future comparisons
            await supabase
              .from('user_drawer_assignments')
              .update({
                production_data: {
                  ...prod.oldData,
                  watch_providers: newProviders,
                  number_of_seasons: details.number_of_seasons,
                  number_of_episodes: details.number_of_episodes,
                  status: details.status,
                  next_episode_to_air: details.next_episode_to_air,
                  _last_update_check: new Date().toISOString(),
                }
              })
              .eq('production_id', prod.productionId)
              .eq('production_type', prod.productionType);

          } catch (error) {
            console.error(`Error checking ${prod.productionId}:`, error);
          }
        })
      );

      if (i + 5 < entries.length) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    const summary = {
      productions_checked: productionMap.size,
      notifications_created: notificationsCreated,
      timestamp: new Date().toISOString(),
    };

    console.log('Check complete:', JSON.stringify(summary));

    return new Response(JSON.stringify(summary), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Check error:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

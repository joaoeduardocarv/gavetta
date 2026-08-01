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

function getRentProviderNames(providers: WatchProviders | null): string[] {
  if (!providers) return [];
  const names = new Set<string>();
  for (const entry of providers.rent || []) names.add(entry.provider_name);
  return [...names].sort();
}

function getBuyProviderNames(providers: WatchProviders | null): string[] {
  if (!providers) return [];
  const names = new Set<string>();
  for (const entry of providers.buy || []) names.add(entry.provider_name);
  return [...names].sort();
}

/** Todos os provedores de "disponível em" (streaming + aluguel + compra) */
function getAllProviderNames(providers: WatchProviders | null): string[] {
  if (!providers) return [];
  const names = new Set<string>();
  for (const entry of providers.flatrate || []) names.add(entry.provider_name);
  for (const entry of providers.rent || []) names.add(entry.provider_name);
  for (const entry of providers.buy || []) names.add(entry.provider_name);
  return [...names].sort();
}

function providersDiffer(oldProviders: WatchProviders | null, newProviders: WatchProviders | null): { added: string[]; removed: string[] } {
  const oldNames = getAllProviderNames(oldProviders);
  const newNames = getAllProviderNames(newProviders);
  const added = newNames.filter(n => !oldNames.includes(n));
  const removed = oldNames.filter(n => !newNames.includes(n));
  return { added, removed };
}

/** Data "hoje" no fuso do Brasil (UTC-3), formato YYYY-MM-DD */
function brToday(): string {
  const now = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

/** Dias inteiros entre hoje (BR) e uma data YYYY-MM-DD. 0 = hoje, 7 = daqui a 7 dias */
function daysUntil(dateStr: string): number {
  const target = Date.parse(`${dateStr.slice(0, 10)}T00:00:00Z`);
  const today = Date.parse(`${brToday()}T00:00:00Z`);
  if (Number.isNaN(target)) return Number.NaN;
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

/** Data de estreia nos cinemas no Brasil (tipos 2/3 do TMDB) */
async function getBrTheatricalDate(movieId: string): Promise<string | null> {
  try {
    const res = await fetchTMDB(`/movie/${movieId}/release_dates`) as {
      results?: Array<{ iso_3166_1: string; release_dates: Array<{ type: number; release_date: string }> }>;
    };
    const br = res.results?.find((r) => r.iso_3166_1 === 'BR');
    if (!br) return null;
    const theatrical = br.release_dates
      .filter((r) => r.type === 2 || r.type === 3)
      .map((r) => r.release_date)
      .sort()[0];
    return theatrical ? theatrical.slice(0, 10) : null;
  } catch {
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
      .select('user_id, streaming_changes, new_seasons, new_episodes, upcoming_content, rental_arrival, purchase_arrival')
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
        rental_arrival: 'rental_arrival',
        purchase_arrival: 'purchase_arrival',
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

            // 1. "Filme ou série no streaming" — mudança/adição em streaming
            const { added, removed } = providersDiffer(oldProviders, newProviders);
            if (added.length > 0 || removed.length > 0) {
              let message = '';
              if (added.length > 0) message += `${title} agora está em: ${added.join(', ')}. `;
              if (removed.length > 0) message += `Saiu de: ${removed.join(', ')}.`;

              for (const userId of prod.userIds) {
                if (!userWants(userId, 'streaming_change')) continue;
                notifications.push({
                  user_id: userId,
                  type: 'streaming_change',
                  title: `📺 ${mediaType === 'movie' ? 'Filme' : 'Série'} no streaming`,
                  message: message.trim(),
                  related_content_id: prod.productionId,
                });
              }
            }

            if (mediaType === 'movie') {
              // 2. "Filme disponível no VOD" — aluguel
              const oldRent = getRentProviderNames(oldProviders);
              const newRent = getRentProviderNames(newProviders);
              if (oldRent.length === 0 && newRent.length > 0) {
                for (const userId of prod.userIds) {
                  if (!userWants(userId, 'rental_arrival')) continue;
                  notifications.push({
                    user_id: userId,
                    type: 'rental_arrival',
                    title: `💵 Filme disponível no VOD`,
                    message: `${title} já pode ser alugado em: ${newRent.join(', ')}.`,
                    related_content_id: prod.productionId,
                  });
                }
              }

              // 3. "Filme disponível no VOD" — compra
              const oldBuy = getBuyProviderNames(oldProviders);
              const newBuy = getBuyProviderNames(newProviders);
              if (oldBuy.length === 0 && newBuy.length > 0) {
                for (const userId of prod.userIds) {
                  if (!userWants(userId, 'purchase_arrival')) continue;
                  notifications.push({
                    user_id: userId,
                    type: 'purchase_arrival',
                    title: `🛒 Filme disponível no VOD`,
                    message: `${title} já pode ser comprado em: ${newBuy.join(', ')}.`,
                    related_content_id: prod.productionId,
                  });
                }
              }

              // 4. Estreia nos cinemas do Brasil
              const brRelease = await getBrTheatricalDate(numericId)
                ?? (details.release_date as string | undefined) ?? null;
              if (brRelease) {
                const d = daysUntil(brRelease);
                if (d === 0) {
                  for (const userId of prod.userIds) {
                    if (!userWants(userId, 'upcoming_content')) continue;
                    notifications.push({
                      user_id: userId,
                      type: 'upcoming_content',
                      title: `🍿 Filme estreia nos cinemas`,
                      message: `${title} estreia hoje nos cinemas!`,
                      related_content_id: prod.productionId,
                    });
                  }
                } else if (d === 7) {
                  for (const userId of prod.userIds) {
                    if (!userWants(userId, 'upcoming_content')) continue;
                    notifications.push({
                      user_id: userId,
                      type: 'upcoming_content',
                      title: `🎟️ Filme estreia nos cinemas em breve`,
                      message: `${title} chega aos cinemas em %%${brRelease}%%.`,
                      related_content_id: prod.productionId,
                    });
                  }
                }
              }
            }

            // 5. Séries: temporadas e episódios
            if (mediaType === 'tv') {
              const oldSeasons = (prod.oldData.number_of_seasons as number) || 0;
              const newSeasons = (details.number_of_seasons as number) || 0;

              const lastEpisode = details.last_episode_to_air as Record<string, unknown> | null;
              const nextEpisode = details.next_episode_to_air as Record<string, unknown> | null;
              const oldLastEpisode = prod.oldData.last_episode_to_air as Record<string, unknown> | null;

              const seasons = (details.seasons as Array<Record<string, unknown>>) || [];
              const knownSeasonNumbers = (prod.oldData._known_seasons as number[]) || [];
              const currentSeasonNumbers = seasons
                .map((s) => s.season_number as number)
                .filter((n) => typeof n === 'number' && n > 0);

              // 5a. "Nova temporada disponível" — estreia hoje / temporada nova apareceu já no ar
              const newlyAiredSeason = seasons.find((s) => {
                const n = s.season_number as number;
                const air = s.air_date as string | undefined;
                return n > 0 && n > oldSeasons && air ? daysUntil(air as string) === 0 : false;
              });
              if (newlyAiredSeason || newSeasons > oldSeasons) {
                const seasonNum = (newlyAiredSeason?.season_number as number) ?? newSeasons;
                for (const userId of prod.userIds) {
                  if (!userWants(userId, 'new_season')) continue;
                  notifications.push({
                    user_id: userId,
                    type: 'new_season',
                    title: `🎬 Nova temporada disponível`,
                    message: `A temporada ${seasonNum} de ${title} já está disponível!`,
                    related_content_id: prod.productionId,
                  });
                }
              }

              // 5b. "Nova temporada em breve" — 7 dias antes da estreia da temporada
              const upcomingSeason = seasons.find((s) => {
                const air = s.air_date as string | undefined;
                const n = s.season_number as number;
                return n > 0 && air ? daysUntil(air) === 7 : false;
              });
              if (upcomingSeason) {
                for (const userId of prod.userIds) {
                  if (!userWants(userId, 'new_season')) continue;
                  notifications.push({
                    user_id: userId,
                    type: 'new_season',
                    title: `📅 Nova temporada em breve`,
                    message: `A temporada ${upcomingSeason.season_number} de ${title} estreia em %%${upcomingSeason.air_date}%%.`,
                    related_content_id: prod.productionId,
                  });
                }
              }


              // 5d. "Novo episódio hoje"
              if (lastEpisode) {
                const newEpNum = lastEpisode.episode_number as number;
                const newSeasonNum = lastEpisode.season_number as number;
                const oldEpNum = oldLastEpisode ? (oldLastEpisode.episode_number as number) : 0;
                const oldSeasonNum = oldLastEpisode ? (oldLastEpisode.season_number as number) : 0;

                const isNewEpisode = !oldLastEpisode ||
                  newSeasonNum > oldSeasonNum ||
                  (newSeasonNum === oldSeasonNum && newEpNum > oldEpNum);

                const epAirDate = lastEpisode.air_date as string | undefined;
                const airedToday = epAirDate ? daysUntil(epAirDate) === 0 : false;

                if (isNewEpisode && airedToday) {
                  const epName = (lastEpisode.name as string) || '';
                  for (const userId of prod.userIds) {
                    if (!userWants(userId, 'new_episodes')) continue;
                    notifications.push({
                      user_id: userId,
                      type: 'new_episodes',
                      title: `🆕 Novo episódio hoje`,
                      message: `${title} S${String(newSeasonNum).padStart(2, '0')}E${String(newEpNum).padStart(2, '0')}${epName ? ` — ${epName}` : ''} já disponível!`,
                      related_content_id: prod.productionId,
                    });
                  }
                }
              }

              // 5e. "Em breve novo episódio" — 2 dias antes
              if (nextEpisode) {
                const airDate = nextEpisode.air_date as string | undefined;
                if (airDate && daysUntil(airDate) === 2) {
                  const nextSeasonNum = nextEpisode.season_number as number;
                  const nextEpNum = nextEpisode.episode_number as number;
                  for (const userId of prod.userIds) {
                    if (!userWants(userId, 'upcoming_content')) continue;
                    notifications.push({
                      user_id: userId,
                      type: 'upcoming_content',
                      title: `⏳ Em breve novo episódio`,
                      message: `${title} S${String(nextSeasonNum).padStart(2, '0')}E${String(nextEpNum).padStart(2, '0')} estreia em %%${airDate}%%.`,
                      related_content_id: prod.productionId,
                    });
                  }
                }
              }

              prod.oldData._known_seasons = currentSeasonNumbers;
            }



            // Insert notifications (deduplicate: don't send same notification twice in 24h)
            for (const notif of notifications) {
              const { data: existing } = await supabase
                .from('notifications')
                .select('id')
                .eq('user_id', notif.user_id)
                .eq('type', notif.type)
                .eq('title', notif.title)

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
                  last_episode_to_air: details.last_episode_to_air,
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
    let clientMsg = 'An unexpected error occurred.';
    if (error instanceof Error) {
      const m = error.message.toLowerCase();
      if (m.includes('timeout') || m.includes('abort')) clientMsg = 'Service temporarily unavailable.';
      else if (m.includes('key') || m.includes('config') || m.includes('credential')) clientMsg = 'Service configuration error.';
      else if (m.includes('api') || m.includes('fetch')) clientMsg = 'Unable to retrieve data. Try again.';
    }
    return new Response(JSON.stringify({ error: clientMsg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

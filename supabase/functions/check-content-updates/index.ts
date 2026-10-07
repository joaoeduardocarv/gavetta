import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { shouldNotify } from './notificationFilters.ts';
import { brToday, daysUntil } from './dateHelpers.ts';

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
  const oldNames = (oldProviders?.flatrate || []).map(p => p.provider_name);
  const newNames = (newProviders?.flatrate || []).map(p => p.provider_name);
  const added = newNames.filter(n => !oldNames.includes(n));
  const removed = oldNames.filter(n => !newNames.includes(n));
  return { added, removed };
}

// brToday/daysUntil vivem em ./dateHelpers.ts e são testados unitariamente


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
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer /, '');
    const { data: authorized, error: authorizationError } = await supabase.rpc('verify_content_update_token', { _token: token });
    if (authorizationError || !authorized) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });


    // A bounded, leased batch resumes where earlier runs stopped; assignments are paginated.
    const { data: claimed, error: claimError } = await supabase.rpc('claim_content_update_batch', { _limit: 30 });
    if (claimError) throw claimError;
    const assignments: Array<{ id: string; user_id: string; production_id: string; production_type: string; production_data: unknown; drawer_id: string }> = [];
    for (const title of claimed || []) {
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase.from('user_drawer_assignments')
          .select('id,user_id,production_id,production_type,production_data,drawer_id')
          .eq('production_id', title.production_id).eq('production_type', title.production_type)
          .order('id').range(offset, offset + 499);
        if (error) throw error;
        assignments.push(...(data || []));
        if (!data || data.length < 500) break;
      }
    }
    if (!assignments.length) return new Response(JSON.stringify({ message: 'No titles due', notifications: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Group by unique production to avoid duplicate TMDB calls
    const productionMap = new Map<string, {
      productionId: string;
      productionType: string;
      userIds: Set<string>;
      oldData: Record<string, unknown>;
      // userId -> true if ALL assignments of this production for this user are in "watched"
      userDrawers: Map<string, Set<string>>;
    }>();

    for (const a of assignments) {
      const key = `${a.production_type}:${a.production_id}`;
      if (!productionMap.has(key)) {
        productionMap.set(key, {
          productionId: a.production_id,
          productionType: a.production_type,
          userIds: new Set([a.user_id]),
          oldData: (a.production_data as Record<string, unknown>) || {},
          userDrawers: new Map([[a.user_id, new Set([a.drawer_id as string])]]),
        });
      } else {
        const p = productionMap.get(key);
        if (!p) continue;
        p.userIds.add(a.user_id);
        const set = p.userDrawers.get(a.user_id) ?? new Set<string>();
        set.add(a.drawer_id as string);
        p.userDrawers.set(a.user_id, set);
      }
    }


    console.log(`Checking ${productionMap.size} unique productions for updates...`);

    // Fetch all user notification preferences
    const allUserIds = new Set<string>();
    for (const prod of productionMap.values()) {
      for (const uid of prod.userIds) allUserIds.add(uid);
    }

    const prefsData: Array<Record<string, boolean> & { user_id: string }> = [];
    const ids = [...allUserIds];
    for (let offset = 0; offset < ids.length; offset += 300) {
      const { data, error } = await supabase.from('notification_preferences')
        .select('user_id, streaming_changes, new_seasons, new_episodes, upcoming_content, rental_arrival, purchase_arrival, watched_availability').in('user_id', ids.slice(offset, offset + 300));
      if (error) throw error;
      prefsData.push(...(data || []) as Array<Record<string, boolean> & { user_id: string }>);
    }

    const userPrefs = new Map<string, Record<string, boolean>>();
    for (const p of prefsData || []) {
      userPrefs.set(p.user_id, p);
    }

    // Helper: check if user wants this notification type
    // (availability rules live in ./notificationFilters.ts and are unit-tested)
    const userWants = (
      userId: string,
      type: string,
      drawerIds?: Set<string>
    ): boolean => shouldNotify(userPrefs.get(userId), type, drawerIds);



    let notificationsCreated = 0;
    const failures: string[] = [];
    const entries = [...productionMap.entries()];

    // Process in batches of 5
    for (let i = 0; i < entries.length; i += 5) {
      const batch = entries.slice(i, i + 5);

      await Promise.allSettled(
        batch.map(async ([_key, prod]) => {
          try {
            const mediaType = prod.productionType === 'movie' ? 'movie' : 'tv';
            const numericId = prod.productionId.replace(/^(movie|tv)-/, '');

            const { data: checkpoint, error: checkpointError } = await supabase.from('content_update_progress').select('snapshot').eq('production_id', prod.productionId).eq('production_type', prod.productionType).maybeSingle();
            if (checkpointError) throw checkpointError;
            if (checkpoint?.snapshot && typeof checkpoint.snapshot === 'object') prod.oldData = checkpoint.snapshot as Record<string, unknown>;
            // Fetch current TMDB data
            const details = await fetchTMDB(`/${mediaType}/${numericId}?language=pt-BR`) as Record<string, unknown>;
            const providersRes = await fetchTMDB(`/${mediaType}/${numericId}/watch/providers`) as { results?: { BR?: WatchProviders } };
            const newProviders = providersRes.results?.BR || null;
            const oldProviders = (prod.oldData.watch_providers as WatchProviders) || null;

            const title = (details.title || details.name || 'Conteúdo') as string;
            const notifications: { user_id: string; type: string; title: string; message: string; related_content_id: string }[] = [];

            // 1. Mudança em "Disponível em" (streaming, aluguel ou compra)
            const { added, removed } = providersDiffer(oldProviders, newProviders);
            if (added.length > 0 || removed.length > 0) {
              let message = '';
              if (added.length > 0) message += `${title} agora está disponível em: ${added.join(', ')}. `;
              if (removed.length > 0) message += `Saiu de: ${removed.join(', ')}.`;

              for (const userId of prod.userIds) {
                if (!userWants(userId, 'streaming_change', prod.userDrawers.get(userId))) continue;
                notifications.push({
                  user_id: userId,
                  type: 'streaming_change',
                  title: `📺 Mudança em "Disponível em"`,
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
                  if (!userWants(userId, 'rental_arrival', prod.userDrawers.get(userId))) continue;
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
                  if (!userWants(userId, 'purchase_arrival', prod.userDrawers.get(userId))) continue;
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
              
              const currentSeasonNumbers = seasons
                .map((s) => s.season_number as number)
                .filter((n) => typeof n === 'number' && n > 0);

              // 5a. "Nova temporada disponível" — estreia hoje / temporada nova apareceu já no ar
              const newlyAiredSeason = seasons.find((s) => {
                const n = s.season_number as number;
                const air = s.air_date as string | undefined;
                return n > 0 && n > oldSeasons && air ? daysUntil(air as string) === 0 : false;
              });
              const airedNewSeason = seasons.find(season => Number(season.season_number) > oldSeasons && typeof season.air_date === "string" && daysUntil(season.air_date) <= 0);
              if (newlyAiredSeason || airedNewSeason) {
                const seasonNum = Number(newlyAiredSeason?.season_number ?? airedNewSeason?.season_number);
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
                    const { data: watched, error: watchedError } = await supabase.from('watched_episodes').select('id').eq('user_id', userId).eq('tmdb_tv_id', Number(numericId)).eq('season_number', newSeasonNum).eq('episode_number', newEpNum).limit(1);
                    if (watchedError) throw watchedError;
                    if (watched?.length) continue;
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



            // Stable event identity uses structured offer/season/episode/date facts, never the heading.
            for (const notif of notifications) {
              const episodeMatch = notif.message.match(/S(\d+)E(\d+)/);
              const seasonMatch = notif.message.match(/temporada (\d+)/i);
              const dateMatch = notif.message.match(/%%(\d{4}-\d{2}-\d{2})%%/);
              const availability = ['streaming_change', 'rental_arrival', 'purchase_arrival'].includes(notif.type);
              const offers = (providers: WatchProviders | null) => ({ subscription: (providers?.flatrate || []).map(p => p.provider_id).sort(), rent: (providers?.rent || []).map(p => p.provider_id).sort(), buy: (providers?.buy || []).map(p => p.provider_id).sort() });
              const identity = availability ? { before: offers(oldProviders), after: offers(newProviders), day: brToday() }
                : { season: episodeMatch ? Number(episodeMatch[1]) : seasonMatch ? Number(seasonMatch[1]) : null, episode: episodeMatch ? Number(episodeMatch[2]) : null, date: dateMatch?.[1] || (mediaType === 'movie' ? details.release_date : (details.last_episode_to_air as Record<string, unknown> | null)?.air_date) || brToday(), phase: notif.message.includes('%%') ? 'upcoming' : 'available' };
              const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(identity)));
              const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2,'0')).join('');
              const context = { production_id: prod.productionId, production_title: title, poster_path: details.poster_path, ...identity };
              const { error: insertError } = await supabase.from('notifications').insert({ ...notif, event_key: `${notif.type}:${prod.productionId}:${hash}`, context });
              if (insertError && insertError.code !== "23505") throw insertError;
              if (!insertError) notificationsCreated++;
            }

            const snapshot = {
              ...prod.oldData, watch_providers: newProviders, number_of_seasons: details.number_of_seasons,
              number_of_episodes: details.number_of_episodes, last_episode_to_air: details.last_episode_to_air,
              status: details.status, next_episode_to_air: details.next_episode_to_air, _last_update_check: new Date().toISOString(),
            };
            const { error: progressError } = await supabase.from('content_update_progress').update({ snapshot, last_success: new Date().toISOString(), next_attempt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(), lease_until: null, last_error: null }).eq('production_id', prod.productionId).eq('production_type', prod.productionType);
            if (progressError) throw progressError;

          } catch (error) {
            const message = error instanceof Error ? error.message : 'Update failed';
            failures.push(prod.productionId);
            await supabase.from('content_update_progress').update({ lease_until: null, next_attempt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), last_error: message.slice(0,500) }).eq('production_id', prod.productionId).eq('production_type', prod.productionType);
            console.error(`Error checking ${prod.productionId}:`, message);
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
      failed_productions: failures,
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

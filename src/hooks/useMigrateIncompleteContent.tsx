import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  getMovieDetails, 
  getMovieCredits, 
  getMovieWatchProviders,
  getTVDetails,
  getTVCredits,
  getTVWatchProviders,
  extractStreamingNames,
  extractStreamingLogos
} from '@/lib/tmdb';
import { Content } from '@/lib/mockData';
import { Json } from '@/integrations/supabase/types';
import { extractTmdbInfoFromId } from '@/lib/contentNormalizer';

export function useMigrateIncompleteContent() {
  const { user } = useAuth();
  const hasMigrated = useRef(false);

  useEffect(() => {
    if (!user || hasMigrated.current) return;

    const migrateIncompleteContent = async () => {
      hasMigrated.current = true;
      
      try {
        // Fetch all user assignments
        const { data: assignments, error } = await supabase
          .from('user_drawer_assignments')
          .select('*')
          .eq('user_id', user.id);

        if (error || !assignments) {
          console.error('Error fetching assignments for migration:', error);
          return;
        }

        // Filter assignments that need enrichment
        const needsEnrichment = assignments.filter(assignment => {
          const data = assignment.production_data as Record<string, unknown>;
          const hasGenres = Array.isArray(data.genres) && data.genres.length > 0;
          const hasDirector = !!data.director;
          const hasAvailableOn = Array.isArray(data.availableOn);
          
          return !hasGenres || !hasDirector || !hasAvailableOn;
        });

        if (needsEnrichment.length === 0) {
          console.log('No content needs enrichment');
          return;
        }

        console.log(`Migrating ${needsEnrichment.length} items with incomplete data...`);

        // Process in batches of 3 to avoid rate limiting
        const batchSize = 3;
        for (let i = 0; i < needsEnrichment.length; i += batchSize) {
          const batch = needsEnrichment.slice(i, i + batchSize);
          
          await Promise.all(batch.map(async (assignment) => {
            try {
              const content = assignment.production_data as unknown as Content;
              const enrichedContent = await enrichContentData(content, assignment.production_id, assignment.production_type);
              
              if (enrichedContent) {
                await supabase
                  .from('user_drawer_assignments')
                  .update({ production_data: enrichedContent as unknown as Json })
                  .eq('id', assignment.id);
                
                console.log(`Migrated: ${enrichedContent.title}`);
              }
            } catch (err) {
              console.error(`Error migrating assignment ${assignment.id}:`, err);
            }
          }));

          // Small delay between batches to respect rate limits
          if (i + batchSize < needsEnrichment.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }

        console.log('Migration complete!');
      } catch (err) {
        console.error('Migration error:', err);
      }
    };

    migrateIncompleteContent();
  }, [user]);
}

async function resolveRealTmdbId(productionId: string, productionType: string, title: string): Promise<{ mediaType: string; tmdbId: number } | null> {
  // 1. Try extracting from prefixed ID format (e.g. "movie-157336", "tv-76331")
  const parsed = extractTmdbInfoFromId(productionId);
  if (parsed) {
    return { mediaType: parsed.mediaType, tmdbId: parsed.tmdbId };
  }

  // 2. For bare numeric IDs, they might be legacy sequential IDs (not real TMDB IDs).
  //    Try searching TMDB by title to find the real ID.
  const mediaType = productionType === 'tv' ? 'tv' : 'movie';

  if (title) {
    try {
      const { searchMovies, searchTVShows } = await import('@/lib/tmdb');
      if (mediaType === 'movie') {
        const results = await searchMovies(title);
        if (results.length > 0) {
          console.log(`Resolved "${title}" to TMDB movie ID ${results[0].id}`);
          return { mediaType: 'movie', tmdbId: results[0].id };
        }
      } else {
        const results = await searchTVShows(title);
        if (results.length > 0) {
          console.log(`Resolved "${title}" to TMDB tv ID ${results[0].id}`);
          return { mediaType: 'tv', tmdbId: results[0].id };
        }
      }
    } catch (err) {
      console.warn(`Search fallback failed for "${title}":`, err);
    }
  }

  // 3. Last resort: try the numeric ID directly (it might actually be a valid TMDB ID)
  if (/^\d+$/.test(productionId)) {
    return { mediaType, tmdbId: parseInt(productionId, 10) };
  }

  return null;
}

async function enrichContentData(content: Content, productionId: string, productionType: string): Promise<Content | null> {
  const resolved = await resolveRealTmdbId(productionId, productionType, content.title);

  if (!resolved) {
    console.warn(`Cannot enrich: unrecognized production_id format "${productionId}"`);
    return null;
  }

  const { mediaType, tmdbId } = resolved;

  try {
    if (mediaType === 'movie') {
      const [details, credits, providers] = await Promise.all([
        getMovieDetails(tmdbId),
        getMovieCredits(tmdbId),
        getMovieWatchProviders(tmdbId)
      ]);

      const director = credits.crew.find(c => c.job === 'Director');

      return {
        ...content,
        genres: details.genres?.map(g => g.name) || [],
        director: director?.name || content.director,
        cast: credits.cast?.slice(0, 10).map(c => c.name) || content.cast,
        availableOn: extractStreamingNames(providers),
        watchProviderLogos: extractStreamingLogos(providers),
        isInTheaters: details.isInTheaters,
      };
    } else {
      const [details, credits, providers] = await Promise.all([
        getTVDetails(tmdbId),
        getTVCredits(tmdbId),
        getTVWatchProviders(tmdbId)
      ]);

      return {
        ...content,
        genres: details.genres?.map(g => g.name) || [],
        director: details.created_by?.[0]?.name || content.director,
        cast: credits.cast?.slice(0, 10).map(c => c.name) || content.cast,
        availableOn: extractStreamingNames(providers),
        watchProviderLogos: extractStreamingLogos(providers),
      };
    }
  } catch (err) {
    console.error(`Failed to enrich ${content.title}:`, err);
    return null;
  }
}

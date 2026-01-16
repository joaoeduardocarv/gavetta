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
  extractStreamingNames
} from '@/lib/tmdb';
import { Content } from '@/lib/mockData';
import { Json } from '@/integrations/supabase/types';

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
              const enrichedContent = await enrichContentData(content, assignment.production_id);
              
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

async function enrichContentData(content: Content, productionId: string): Promise<Content | null> {
  // Parse the production ID to get type and TMDB ID
  const idMatch = productionId.match(/^tmdb-(movie|tv)-(\d+)$/);
  if (!idMatch) return null;

  const [, mediaType, tmdbIdStr] = idMatch;
  const tmdbId = parseInt(tmdbIdStr, 10);

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
      };
    }
  } catch (err) {
    console.error(`Failed to enrich ${content.title}:`, err);
    return null;
  }
}

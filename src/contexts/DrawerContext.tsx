import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from "react";
import { Content } from "@/lib/mockData";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  getMovieDetails,
  getMovieCredits,
  getMovieWatchProviders,
  getTVDetails,
  getTVCredits,
  getTVWatchProviders,
  extractStreamingNames,
  extractStreamingLogos
} from "@/lib/tmdb";
import { extractTmdbInfoFromId, normalizeStoredContent } from "@/lib/contentNormalizer";

// IDs das gavetas padrão mutuamente exclusivas
export const DEFAULT_DRAWER_IDS = ['to-watch', 'watching', 'watched'] as const;
export type DefaultDrawerId = typeof DEFAULT_DRAWER_IDS[number];

export interface CustomDrawer {
  id: string;
  name: string;
  icon: string;
  color: string;
  shared_permission?: string;
}

export interface ContentDrawerAssignment {
  contentId: string;
  /** The original production_id as stored in the DB — used for all DB queries */
  productionId: string;
  productionType: string;
  content: Content;
  defaultDrawer: DefaultDrawerId | null;
  customDrawers: string[];
  rating: number | null;
  comment: string | null;
  rewatchCount: number;
}

interface PendingWatchedAssignment {
  content: Content;
  resolve: (result: { confirmed: boolean; rating?: number; comment?: string }) => void;
}

interface DrawerContextType {
  customDrawers: CustomDrawer[];
  addCustomDrawer: (drawer: Omit<CustomDrawer, 'id'>) => Promise<CustomDrawer>;
  removeCustomDrawer: (drawerId: string) => Promise<void>;
  
  assignments: ContentDrawerAssignment[];
  
  setDefaultDrawer: (content: Content, drawerId: DefaultDrawerId | null) => Promise<void>;
  getDefaultDrawer: (contentId: string) => DefaultDrawerId | null;
  
  addToCustomDrawer: (content: Content, drawerId: string) => Promise<void>;
  removeFromCustomDrawer: (contentId: string, drawerId: string) => Promise<void>;
  isInCustomDrawer: (contentId: string, drawerId: string) => boolean;
  
  setContentRating: (contentId: string, rating: number) => Promise<void>;
  getContentRating: (contentId: string) => number | null;
  setContentComment: (contentId: string, comment: string) => Promise<void>;
  getContentComment: (contentId: string) => string | null;
  
  getContentDrawers: (contentId: string) => { defaultDrawer: DefaultDrawerId | null; customDrawers: string[]; rating: number | null; comment: string | null; rewatchCount: number };
  getDrawerContents: (drawerId: string) => Content[];
  isDefaultDrawer: (drawerId: string) => boolean;
  isLoading: boolean;

  pendingWatchedAssignment: PendingWatchedAssignment | null;
  confirmWatchedRating: (rating: number, comment: string) => void;
  cancelWatchedRating: () => void;

  incrementRewatch: (contentId: string) => Promise<void>;
  decrementRewatch: (contentId: string) => Promise<void>;
  getRewatchCount: (contentId: string) => number;
}

const DrawerContext = createContext<DrawerContextType | null>(null);

export function DrawerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [customDrawers, setCustomDrawers] = useState<CustomDrawer[]>([]);
  const [assignments, setAssignments] = useState<ContentDrawerAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingWatchedAssignment, setPendingWatchedAssignment] = useState<PendingWatchedAssignment | null>(null);
  const writeLock = useRef(false);

  // Re-fetch from DB to ensure state is in sync
  const refetchAssignments = useCallback(async () => {
    if (!user) return;
    try {
      const { data: assignmentsData, error } = await supabase
        .from('user_drawer_assignments')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error refetching assignments:', error);
        return;
      }

      const assignmentMap = new Map<string, ContentDrawerAssignment>();
      
      (assignmentsData || []).forEach(a => {
        const content = normalizeStoredContent(a.production_data, {
          productionId: String(a.production_id),
          productionType: String(a.production_type),
        });
        const contentKey = content.id;

        const rating = a.rating as number | null;
        const comment = a.comment as string | null;
        const rewatchCount = ((a as any).rewatch_count as number | null) ?? 0;
        
        const existing = assignmentMap.get(contentKey);
        if (existing) {
          if (DEFAULT_DRAWER_IDS.includes(a.drawer_id as DefaultDrawerId)) {
            existing.defaultDrawer = a.drawer_id as DefaultDrawerId;
            if (a.drawer_id === 'watched') {
              existing.rating = rating;
              existing.comment = comment;
              existing.rewatchCount = rewatchCount;
            }
          } else {
            existing.customDrawers.push(a.drawer_id);
          }
        } else {
          assignmentMap.set(contentKey, {
            contentId: content.id,
            productionId: String(a.production_id),
            productionType: String(a.production_type),
            content,
            defaultDrawer: DEFAULT_DRAWER_IDS.includes(a.drawer_id as DefaultDrawerId) 
              ? a.drawer_id as DefaultDrawerId 
              : null,
            customDrawers: DEFAULT_DRAWER_IDS.includes(a.drawer_id as DefaultDrawerId) 
              ? [] 
              : [a.drawer_id],
            rating: a.drawer_id === 'watched' ? rating : null,
            comment: a.drawer_id === 'watched' ? comment : null,
            rewatchCount: a.drawer_id === 'watched' ? rewatchCount : 0,
          });
        }
      });

      setAssignments(Array.from(assignmentMap.values()));
    } catch (error) {
      console.error('Error refetching assignments:', error);
    }
  }, [user]);

  // Fetch initial data when user is authenticated
  useEffect(() => {
    if (!user) {
      setCustomDrawers([]);
      setAssignments([]);
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch custom drawers
        const { data: drawersData, error: drawersError } = await supabase
          .from('user_custom_drawers')
          .select('*')
          .eq('user_id', user.id);

        if (drawersError) throw drawersError;

        const fetchedDrawers: CustomDrawer[] = (drawersData || []).map(d => ({
          id: d.id,
          name: d.name,
          icon: d.icon,
          color: '#6366f1',
          shared_permission: (d as any).shared_permission || 'open',
        }));
        setCustomDrawers(fetchedDrawers);

        await refetchAssignments();
      } catch (error) {
        console.error('Error fetching drawer data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user, refetchAssignments]);

  const isDefaultDrawer = (drawerId: string): boolean => {
    return DEFAULT_DRAWER_IDS.includes(drawerId as DefaultDrawerId);
  };

  // Helper function to enrich content with full TMDB data
  const enrichContent = async (content: Content): Promise<Content> => {
    const needsEnrichment = !content.genres?.length || !content.director || !content.availableOn?.length || !content.originalTitle;
    if (!needsEnrichment) return content;

    const parsedId = extractTmdbInfoFromId(content.id);
    if (!parsedId) return content;

    const { mediaType, tmdbId: numericId } = parsedId;

    try {
      if (mediaType === 'movie') {
        const [details, credits, providers] = await Promise.all([
          getMovieDetails(numericId),
          getMovieCredits(numericId),
          getMovieWatchProviders(numericId)
        ]);

        const director = credits.crew.find(c => c.job === 'Director');

        return {
          ...content,
          id: `movie-${numericId}`,
          originalTitle: (details as unknown as { original_title?: string }).original_title || content.originalTitle,
          genres: details.genres.map(g => g.name),
          director: director?.name || content.director,
          cast: credits.cast.slice(0, 10).map(c => c.name),
          availableOn: extractStreamingNames(providers),
          watchProviderLogos: extractStreamingLogos(providers),
          watchProvidersLink: providers?.link || undefined,
          isInTheaters: details.isInTheaters,
        };
      } else {
        const [details, credits, providers] = await Promise.all([
          getTVDetails(numericId),
          getTVCredits(numericId),
          getTVWatchProviders(numericId)
        ]);

        return {
          ...content,
          id: `tv-${numericId}`,
          originalTitle: (details as unknown as { original_name?: string }).original_name || content.originalTitle,
          genres: details.genres.map(g => g.name),
          director: details.created_by?.[0]?.name || content.director,
          cast: credits.cast.slice(0, 10).map(c => c.name),
          availableOn: extractStreamingNames(providers),
          watchProviderLogos: extractStreamingLogos(providers),
          watchProvidersLink: providers?.link || undefined,
        };
      }
    } catch (error) {
      console.error('Error enriching content:', error);
      return content;
    }
  };

  const getCanonicalContentKey = (content: Content) => {
    const parsed = extractTmdbInfoFromId(content.id);
    if (parsed) {
      return {
        productionId: `${parsed.mediaType}-${parsed.tmdbId}`,
        productionType: parsed.mediaType,
        legacyProductionIds: [
          `${parsed.tmdbId}`,
          `${parsed.mediaType}-${parsed.tmdbId}`,
          `tmdb-${parsed.mediaType}-${parsed.tmdbId}`,
        ],
      };
    }

    const productionType = content.type === 'movie' ? 'movie' : 'tv';
    return {
      productionId: content.id,
      productionType,
      legacyProductionIds: [content.id],
    };
  };

  const getAssignmentByContentId = (contentId: string) => assignments.find(a => a.contentId === contentId);

  const deleteDefaultDrawerAssignments = useCallback(async (userId: string, content: Content) => {
    const { productionId, productionType, legacyProductionIds } = getCanonicalContentKey(content);
    const assignment = getAssignmentByContentId(content.id);
    const candidateIds = Array.from(new Set([
      ...legacyProductionIds,
      assignment?.productionId,
      content.id,
    ].filter(Boolean) as string[]));

    for (const candidateId of candidateIds) {
      for (const defaultId of DEFAULT_DRAWER_IDS) {
        const { error } = await supabase
          .from('user_drawer_assignments')
          .delete()
          .eq('user_id', userId)
          .eq('production_id', candidateId)
          .eq('drawer_id', defaultId);

        if (error) {
          console.error(`Error deleting default assignment ${defaultId} for production_id=${candidateId}:`, error);
        }
      }
    }

    return { productionId, productionType };
  }, [assignments]);

  // Internal function to actually save to watched drawer with rating
  const saveToWatchedDrawer = useCallback(async (content: Content, rating: number, comment: string) => {
    if (!user) return;

    const enrichedContent = await enrichContent(content);

    writeLock.current = true;
    try {
      const { productionId, productionType } = await deleteDefaultDrawerAssignments(user.id, enrichedContent);

      const { error } = await supabase
        .from('user_drawer_assignments')
        .insert({
          user_id: user.id,
          drawer_id: 'watched',
          production_id: productionId,
          production_type: productionType,
          production_data: enrichedContent as unknown as Record<string, unknown>,
          rating,
          comment: comment || null
        } as any);

      if (error) {
        console.error('Error inserting watched assignment:', error);
        throw error;
      }

      console.log(`✅ Saved to watched: ${content.title} (production_id=${productionId}, rating=${rating})`);
      await refetchAssignments();
    } catch (error) {
      console.error('Error saving to watched drawer:', error);
    } finally {
      writeLock.current = false;
    }
  }, [user, deleteDefaultDrawerAssignments, refetchAssignments]);

  const setDefaultDrawer = useCallback(async (content: Content, drawerId: DefaultDrawerId | null) => {
    if (!user) return;

    if (drawerId === 'watched') {
      return new Promise<void>((resolve) => {
        setPendingWatchedAssignment({
          content,
          resolve: async (result) => {
            setPendingWatchedAssignment(null);
            if (result.confirmed && result.rating !== undefined) {
              await saveToWatchedDrawer(content, result.rating, result.comment || '');
            }
            resolve();
          }
        });
      });
    }

    const enrichedContent = drawerId ? await enrichContent(content) : content;

    writeLock.current = true;
    try {
      const { productionId, productionType } = await deleteDefaultDrawerAssignments(user.id, enrichedContent);

      if (drawerId) {
        const { error } = await supabase
          .from('user_drawer_assignments')
          .insert({
            user_id: user.id,
            drawer_id: drawerId,
            production_id: productionId,
            production_type: productionType,
            production_data: enrichedContent as unknown as Record<string, unknown>
          } as any);

        if (error) {
          console.error('Error inserting default drawer assignment:', error);
          throw error;
        }
      }

      console.log(`✅ Set default drawer: ${content.title} → ${drawerId || 'removed'} (production_id=${productionId})`);
      await refetchAssignments();
    } catch (error) {
      console.error('Error setting default drawer:', error);
    } finally {
      writeLock.current = false;
    }
  }, [user, saveToWatchedDrawer, refetchAssignments, deleteDefaultDrawerAssignments]);

  const confirmWatchedRating = useCallback((rating: number, comment: string) => {
    if (pendingWatchedAssignment) {
      pendingWatchedAssignment.resolve({ confirmed: true, rating, comment });
    }
  }, [pendingWatchedAssignment]);

  const cancelWatchedRating = useCallback(() => {
    if (pendingWatchedAssignment) {
      pendingWatchedAssignment.resolve({ confirmed: false });
    }
  }, [pendingWatchedAssignment]);

  const getDefaultDrawer = (contentId: string): DefaultDrawerId | null => {
    return assignments.find(a => a.contentId === contentId)?.defaultDrawer || null;
  };

  const addToCustomDrawer = useCallback(async (content: Content, drawerId: string) => {
    if (!user) return;

    const enrichedContent = await enrichContent(content);
    const { productionId, productionType } = getCanonicalContentKey(enrichedContent);

    writeLock.current = true;
    try {
      const { error } = await supabase
        .from('user_drawer_assignments')
        .insert({
          user_id: user.id,
          drawer_id: drawerId,
          production_id: productionId,
          production_type: productionType,
          production_data: enrichedContent as unknown as Record<string, unknown>
        } as any);

      if (error) {
        console.error('Error adding to custom drawer:', error);
        throw error;
      }

      console.log(`✅ Added to custom drawer ${drawerId}: ${content.title} (production_id=${productionId})`);
      await refetchAssignments();
    } catch (error) {
      console.error('Error adding to custom drawer:', error);
    } finally {
      writeLock.current = false;
    }
  }, [user, refetchAssignments]);

  const removeFromCustomDrawer = useCallback(async (contentId: string, drawerId: string) => {
    if (!user) return;

    const assignment = assignments.find(a => a.contentId === contentId);
    if (!assignment) return;

    writeLock.current = true;
    try {
      const { error } = await supabase
        .from('user_drawer_assignments')
        .delete()
        .eq('user_id', user.id)
        .eq('production_id', assignment.productionId)
        .eq('production_type', assignment.productionType)
        .eq('drawer_id', drawerId);

      if (error) {
        console.error('Error removing from custom drawer:', error);
        throw error;
      }

      console.log(`✅ Removed from custom drawer ${drawerId}: ${contentId} (production_id=${assignment.productionId})`);
      await refetchAssignments();
    } catch (error) {
      console.error('Error removing from custom drawer:', error);
    } finally {
      writeLock.current = false;
    }
  }, [user, assignments, refetchAssignments]);

  const isInCustomDrawer = (contentId: string, drawerId: string): boolean => {
    return assignments.find(a => a.contentId === contentId)?.customDrawers.includes(drawerId) || false;
  };

  const getContentDrawers = (contentId: string) => {
    const assignment = assignments.find(a => a.contentId === contentId);
    return {
      defaultDrawer: assignment?.defaultDrawer || null,
      customDrawers: assignment?.customDrawers || [],
      rating: assignment?.rating || null,
      comment: assignment?.comment || null,
      rewatchCount: assignment?.rewatchCount || 0,
    };
  };

  const getContentRating = (contentId: string): number | null => {
    return assignments.find(a => a.contentId === contentId)?.rating || null;
  };

  const getContentComment = (contentId: string): string | null => {
    return assignments.find(a => a.contentId === contentId)?.comment || null;
  };

  const setContentRating = useCallback(async (contentId: string, rating: number) => {
    if (!user) return;

    const assignment = assignments.find(a => a.contentId === contentId);
    if (!assignment) {
      console.warn(`setContentRating: no assignment found for ${contentId}`);
      return;
    }
    
    if (assignment.defaultDrawer !== 'watched') {
      console.warn(`setContentRating: content ${contentId} is not in 'watched' drawer (currently in '${assignment.defaultDrawer}')`);
      return;
    }

    writeLock.current = true;
    try {
      const { error } = await supabase
        .from('user_drawer_assignments')
        .update({ rating } as any)
        .eq('user_id', user.id)
        .eq('production_id', assignment.productionId)
        .eq('production_type', assignment.productionType)
        .eq('drawer_id', 'watched');

      if (error) {
        console.error('Error setting rating:', error);
        throw error;
      }

      console.log(`✅ Rating set: ${contentId} = ${rating} (production_id=${assignment.productionId})`);
      await refetchAssignments();
    } catch (error) {
      console.error('Error setting rating:', error);
    } finally {
      writeLock.current = false;
    }
  }, [user, assignments, refetchAssignments]);

  const setContentComment = useCallback(async (contentId: string, comment: string) => {
    if (!user) return;

    const assignment = assignments.find(a => a.contentId === contentId);
    if (!assignment) {
      console.warn(`setContentComment: no assignment found for ${contentId}`);
      return;
    }

    const drawerId = assignment.defaultDrawer === 'watched'
      ? 'watched'
      : assignment.defaultDrawer || assignment.customDrawers[0];

    if (!drawerId) {
      console.warn(`setContentComment: no drawer found for ${contentId}`);
      return;
    }

    writeLock.current = true;
    try {
      const { error } = await supabase
        .from('user_drawer_assignments')
        .update({ comment } as any)
        .eq('user_id', user.id)
        .eq('production_id', assignment.productionId)
        .eq('production_type', assignment.productionType)
        .eq('drawer_id', drawerId);

      if (error) {
        console.error('Error setting comment:', error);
        throw error;
      }

      console.log(`✅ Comment set for ${contentId} in drawer ${drawerId} (production_id=${assignment.productionId})`);
      await refetchAssignments();
    } catch (error) {
      console.error('Error setting comment:', error);
    } finally {
      writeLock.current = false;
    }
  }, [user, assignments, refetchAssignments]);

  const getDrawerContents = (drawerId: string): Content[] => {
    if (isDefaultDrawer(drawerId)) {
      return assignments
        .filter(a => a.defaultDrawer === drawerId)
        .map(a => a.content);
    }
    return assignments
      .filter(a => a.customDrawers.includes(drawerId))
      .map(a => a.content);
  };

  const addCustomDrawer = useCallback(async (drawer: Omit<CustomDrawer, 'id'>): Promise<CustomDrawer> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('user_custom_drawers')
      .insert({
        user_id: user.id,
        name: drawer.name,
        icon: drawer.icon
      })
      .select()
      .single();

    if (error) throw error;

    const newDrawer: CustomDrawer = {
      id: data.id,
      name: data.name,
      icon: data.icon,
      color: drawer.color
    };

    setCustomDrawers(prev => [...prev, newDrawer]);
    return newDrawer;
  }, [user]);

  const removeCustomDrawer = useCallback(async (drawerId: string) => {
    if (!user) return;

    try {
      const { error: drawerError } = await supabase
        .from('user_custom_drawers')
        .delete()
        .eq('id', drawerId)
        .eq('user_id', user.id);

      if (drawerError) throw drawerError;

      await supabase
        .from('user_drawer_assignments')
        .delete()
        .eq('user_id', user.id)
        .eq('drawer_id', drawerId);

      setCustomDrawers(prev => prev.filter(d => d.id !== drawerId));
      await refetchAssignments();
    } catch (error) {
      console.error('Error removing custom drawer:', error);
    }
  }, [user, refetchAssignments]);

  return (
    <DrawerContext.Provider value={{
      customDrawers,
      addCustomDrawer,
      removeCustomDrawer,
      assignments,
      setDefaultDrawer,
      getDefaultDrawer,
      addToCustomDrawer,
      removeFromCustomDrawer,
      isInCustomDrawer,
      getContentDrawers,
      getDrawerContents,
      isDefaultDrawer,
      isLoading,
      setContentRating,
      getContentRating,
      setContentComment,
      getContentComment,
      pendingWatchedAssignment,
      confirmWatchedRating,
      cancelWatchedRating
    }}>
      {children}
    </DrawerContext.Provider>
  );
}

export function useDrawers() {
  const context = useContext(DrawerContext);
  if (!context) {
    throw new Error('useDrawers must be used within a DrawerProvider');
  }
  return context;
}

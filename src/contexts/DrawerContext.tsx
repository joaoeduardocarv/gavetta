import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { Content } from "@/lib/mockData";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// IDs das gavetas padrão mutuamente exclusivas
export const DEFAULT_DRAWER_IDS = ['to-watch', 'watching', 'watched'] as const;
export type DefaultDrawerId = typeof DEFAULT_DRAWER_IDS[number];

export interface CustomDrawer {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface ContentDrawerAssignment {
  contentId: string;
  content: Content;
  defaultDrawer: DefaultDrawerId | null;
  customDrawers: string[];
  rating: number | null;
  comment: string | null;
}

interface DrawerContextType {
  // Gavetas personalizadas
  customDrawers: CustomDrawer[];
  addCustomDrawer: (drawer: Omit<CustomDrawer, 'id'>) => Promise<CustomDrawer>;
  removeCustomDrawer: (drawerId: string) => Promise<void>;
  
  // Atribuições de conteúdo
  assignments: ContentDrawerAssignment[];
  
  // Adicionar/remover de gaveta padrão (exclusivo)
  setDefaultDrawer: (content: Content, drawerId: DefaultDrawerId | null) => Promise<void>;
  getDefaultDrawer: (contentId: string) => DefaultDrawerId | null;
  
  // Adicionar/remover de gavetas personalizadas (múltiplas)
  addToCustomDrawer: (content: Content, drawerId: string) => Promise<void>;
  removeFromCustomDrawer: (contentId: string, drawerId: string) => Promise<void>;
  isInCustomDrawer: (contentId: string, drawerId: string) => boolean;
  
  // Avaliação e comentário por item
  setContentRating: (contentId: string, rating: number) => Promise<void>;
  getContentRating: (contentId: string) => number | null;
  setContentComment: (contentId: string, comment: string) => Promise<void>;
  getContentComment: (contentId: string) => string | null;
  
  // Utilitários
  getContentDrawers: (contentId: string) => { defaultDrawer: DefaultDrawerId | null; customDrawers: string[]; rating: number | null; comment: string | null };
  getDrawerContents: (drawerId: string) => Content[];
  isDefaultDrawer: (drawerId: string) => boolean;
  isLoading: boolean;
}

const DrawerContext = createContext<DrawerContextType | null>(null);

export function DrawerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [customDrawers, setCustomDrawers] = useState<CustomDrawer[]>([]);
  const [assignments, setAssignments] = useState<ContentDrawerAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
          color: '#6366f1' // default color
        }));
        setCustomDrawers(fetchedDrawers);

        // Fetch assignments
        const { data: assignmentsData, error: assignmentsError } = await supabase
          .from('user_drawer_assignments')
          .select('*')
          .eq('user_id', user.id);

        if (assignmentsError) throw assignmentsError;

        // Group assignments by content
        const assignmentMap = new Map<string, ContentDrawerAssignment>();
        
        (assignmentsData || []).forEach(a => {
          const contentKey = `${a.production_id}-${a.production_type}`;
          const content = a.production_data as unknown as Content;
          const rating = (a as any).rating as number | null;
          const comment = (a as any).comment as string | null;
          
          const existing = assignmentMap.get(contentKey);
          if (existing) {
            if (DEFAULT_DRAWER_IDS.includes(a.drawer_id as DefaultDrawerId)) {
              existing.defaultDrawer = a.drawer_id as DefaultDrawerId;
              // Rating e comment são vinculados à gaveta padrão "watched"
              if (a.drawer_id === 'watched') {
                existing.rating = rating;
                existing.comment = comment;
              }
            } else {
              existing.customDrawers.push(a.drawer_id);
            }
          } else {
            assignmentMap.set(contentKey, {
              contentId: content.id,
              content,
              defaultDrawer: DEFAULT_DRAWER_IDS.includes(a.drawer_id as DefaultDrawerId) 
                ? a.drawer_id as DefaultDrawerId 
                : null,
              customDrawers: DEFAULT_DRAWER_IDS.includes(a.drawer_id as DefaultDrawerId) 
                ? [] 
                : [a.drawer_id],
              rating: a.drawer_id === 'watched' ? rating : null,
              comment: a.drawer_id === 'watched' ? comment : null
            });
          }
        });

        setAssignments(Array.from(assignmentMap.values()));
      } catch (error) {
        console.error('Error fetching drawer data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const isDefaultDrawer = (drawerId: string): boolean => {
    return DEFAULT_DRAWER_IDS.includes(drawerId as DefaultDrawerId);
  };

  const setDefaultDrawer = useCallback(async (content: Content, drawerId: DefaultDrawerId | null) => {
    if (!user) return;

    const productionType = content.type === 'movie' ? 'movie' : 'tv';
    const productionId = content.id;

    try {
      // First, remove any existing default drawer assignment for this content
      for (const defaultId of DEFAULT_DRAWER_IDS) {
        await supabase
          .from('user_drawer_assignments')
          .delete()
          .eq('user_id', user.id)
          .eq('production_id', productionId)
          .eq('production_type', productionType)
          .eq('drawer_id', defaultId);
      }

      // If a new drawer is specified, insert it
      if (drawerId) {
        const { error } = await supabase
          .from('user_drawer_assignments')
          .insert({
            user_id: user.id,
            drawer_id: drawerId,
            production_id: productionId,
            production_type: productionType,
            production_data: content as unknown as Record<string, unknown>
          } as any);

        if (error) throw error;
      }

      // Update local state
      setAssignments(prev => {
        const existing = prev.find(a => a.contentId === content.id);
        if (existing) {
          if (drawerId === null) {
            if (existing.customDrawers.length === 0) {
              return prev.filter(a => a.contentId !== content.id);
            }
          }
          return prev.map(a => 
            a.contentId === content.id 
              ? { ...a, defaultDrawer: drawerId, content, rating: drawerId === 'watched' ? a.rating : null }
              : a
          );
        }
        if (drawerId === null) return prev;
        return [...prev, { contentId: content.id, content, defaultDrawer: drawerId, customDrawers: [], rating: null, comment: null }];
      });
    } catch (error) {
      console.error('Error setting default drawer:', error);
    }
  }, [user]);

  const getDefaultDrawer = (contentId: string): DefaultDrawerId | null => {
    return assignments.find(a => a.contentId === contentId)?.defaultDrawer || null;
  };

  const addToCustomDrawer = useCallback(async (content: Content, drawerId: string) => {
    if (!user) return;

    const productionType = content.type === 'movie' ? 'movie' : 'tv';
    const productionId = content.id;

    try {
      const { error } = await supabase
        .from('user_drawer_assignments')
        .insert({
          user_id: user.id,
          drawer_id: drawerId,
          production_id: productionId,
          production_type: productionType,
          production_data: content as unknown as Record<string, unknown>
        } as any);

      if (error) throw error;

      // Update local state
      setAssignments(prev => {
        const existing = prev.find(a => a.contentId === content.id);
        if (existing) {
          if (existing.customDrawers.includes(drawerId)) return prev;
          return prev.map(a => 
            a.contentId === content.id 
              ? { ...a, customDrawers: [...a.customDrawers, drawerId], content }
              : a
          );
        }
        return [...prev, { contentId: content.id, content, defaultDrawer: null, customDrawers: [drawerId], rating: null, comment: null }];
      });
    } catch (error) {
      console.error('Error adding to custom drawer:', error);
    }
  }, [user]);

  const removeFromCustomDrawer = useCallback(async (contentId: string, drawerId: string) => {
    if (!user) return;

    const assignment = assignments.find(a => a.contentId === contentId);
    if (!assignment) return;

    const productionType = assignment.content.type === 'movie' ? 'movie' : 'tv';

    try {
      const { error } = await supabase
        .from('user_drawer_assignments')
        .delete()
        .eq('user_id', user.id)
        .eq('production_id', contentId)
        .eq('production_type', productionType)
        .eq('drawer_id', drawerId);

      if (error) throw error;

      // Update local state
      setAssignments(prev => 
        prev.map(a => 
          a.contentId === contentId 
            ? { ...a, customDrawers: a.customDrawers.filter(id => id !== drawerId) }
            : a
        ).filter(a => a.defaultDrawer !== null || a.customDrawers.length > 0)
      );
    } catch (error) {
      console.error('Error removing from custom drawer:', error);
    }
  }, [user, assignments]);

  const isInCustomDrawer = (contentId: string, drawerId: string): boolean => {
    return assignments.find(a => a.contentId === contentId)?.customDrawers.includes(drawerId) || false;
  };

  const getContentDrawers = (contentId: string) => {
    const assignment = assignments.find(a => a.contentId === contentId);
    return {
      defaultDrawer: assignment?.defaultDrawer || null,
      customDrawers: assignment?.customDrawers || [],
      rating: assignment?.rating || null,
      comment: assignment?.comment || null
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
    if (!assignment || assignment.defaultDrawer !== 'watched') return;

    const productionType = assignment.content.type === 'movie' ? 'movie' : 'tv';

    try {
      const { error } = await supabase
        .from('user_drawer_assignments')
        .update({ rating } as any)
        .eq('user_id', user.id)
        .eq('production_id', contentId)
        .eq('production_type', productionType)
        .eq('drawer_id', 'watched');

      if (error) throw error;

      // Update local state
      setAssignments(prev => 
        prev.map(a => 
          a.contentId === contentId 
            ? { ...a, rating }
            : a
        )
      );
    } catch (error) {
      console.error('Error setting rating:', error);
    }
  }, [user, assignments]);

  const setContentComment = useCallback(async (contentId: string, comment: string) => {
    if (!user) return;

    const assignment = assignments.find(a => a.contentId === contentId);
    if (!assignment) return;

    // Encontrar qual gaveta usar para salvar o comentário
    const drawerId = assignment.defaultDrawer || assignment.customDrawers[0];
    if (!drawerId) return;

    const productionType = assignment.content.type === 'movie' ? 'movie' : 'tv';

    try {
      const { error } = await supabase
        .from('user_drawer_assignments')
        .update({ comment } as any)
        .eq('user_id', user.id)
        .eq('production_id', contentId)
        .eq('production_type', productionType)
        .eq('drawer_id', drawerId);

      if (error) throw error;

      // Update local state
      setAssignments(prev => 
        prev.map(a => 
          a.contentId === contentId 
            ? { ...a, comment }
            : a
        )
      );
    } catch (error) {
      console.error('Error setting comment:', error);
    }
  }, [user, assignments]);

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
      // Delete drawer
      const { error: drawerError } = await supabase
        .from('user_custom_drawers')
        .delete()
        .eq('id', drawerId)
        .eq('user_id', user.id);

      if (drawerError) throw drawerError;

      // Delete all assignments to this drawer
      await supabase
        .from('user_drawer_assignments')
        .delete()
        .eq('user_id', user.id)
        .eq('drawer_id', drawerId);

      // Update local state
      setCustomDrawers(prev => prev.filter(d => d.id !== drawerId));
      setAssignments(prev => 
        prev.map(a => ({
          ...a,
          customDrawers: a.customDrawers.filter(id => id !== drawerId)
        })).filter(a => a.defaultDrawer !== null || a.customDrawers.length > 0)
      );
    } catch (error) {
      console.error('Error removing custom drawer:', error);
    }
  }, [user]);

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
      getContentComment
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

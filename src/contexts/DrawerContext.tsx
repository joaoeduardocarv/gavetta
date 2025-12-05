import { createContext, useContext, useState, ReactNode } from "react";
import { Content } from "@/lib/mockData";

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
  content: Content; // Armazenar o conteúdo completo
  defaultDrawer: DefaultDrawerId | null;
  customDrawers: string[];
}

interface DrawerContextType {
  // Gavetas personalizadas
  customDrawers: CustomDrawer[];
  addCustomDrawer: (drawer: Omit<CustomDrawer, 'id'>) => CustomDrawer;
  removeCustomDrawer: (drawerId: string) => void;
  
  // Atribuições de conteúdo
  assignments: ContentDrawerAssignment[];
  
  // Adicionar/remover de gaveta padrão (exclusivo)
  setDefaultDrawer: (content: Content, drawerId: DefaultDrawerId | null) => void;
  getDefaultDrawer: (contentId: string) => DefaultDrawerId | null;
  
  // Adicionar/remover de gavetas personalizadas (múltiplas)
  addToCustomDrawer: (content: Content, drawerId: string) => void;
  removeFromCustomDrawer: (contentId: string, drawerId: string) => void;
  isInCustomDrawer: (contentId: string, drawerId: string) => boolean;
  
  // Utilitários
  getContentDrawers: (contentId: string) => { defaultDrawer: DefaultDrawerId | null; customDrawers: string[] };
  getDrawerContents: (drawerId: string) => Content[];
  isDefaultDrawer: (drawerId: string) => boolean;
}

const DrawerContext = createContext<DrawerContextType | null>(null);

export function DrawerProvider({ children }: { children: ReactNode }) {
  const [customDrawers, setCustomDrawers] = useState<CustomDrawer[]>([]);
  const [assignments, setAssignments] = useState<ContentDrawerAssignment[]>([]);

  const isDefaultDrawer = (drawerId: string): boolean => {
    return DEFAULT_DRAWER_IDS.includes(drawerId as DefaultDrawerId);
  };

  const setDefaultDrawer = (content: Content, drawerId: DefaultDrawerId | null) => {
    setAssignments(prev => {
      const existing = prev.find(a => a.contentId === content.id);
      if (existing) {
        if (drawerId === null) {
          // Se não tem mais gavetas personalizadas, remover a atribuição
          if (existing.customDrawers.length === 0) {
            return prev.filter(a => a.contentId !== content.id);
          }
        }
        return prev.map(a => 
          a.contentId === content.id 
            ? { ...a, defaultDrawer: drawerId, content }
            : a
        );
      }
      if (drawerId === null) return prev;
      return [...prev, { contentId: content.id, content, defaultDrawer: drawerId, customDrawers: [] }];
    });
  };

  const getDefaultDrawer = (contentId: string): DefaultDrawerId | null => {
    return assignments.find(a => a.contentId === contentId)?.defaultDrawer || null;
  };

  const addToCustomDrawer = (content: Content, drawerId: string) => {
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
      return [...prev, { contentId: content.id, content, defaultDrawer: null, customDrawers: [drawerId] }];
    });
  };

  const removeFromCustomDrawer = (contentId: string, drawerId: string) => {
    setAssignments(prev => 
      prev.map(a => 
        a.contentId === contentId 
          ? { ...a, customDrawers: a.customDrawers.filter(id => id !== drawerId) }
          : a
      ).filter(a => a.defaultDrawer !== null || a.customDrawers.length > 0)
    );
  };

  const isInCustomDrawer = (contentId: string, drawerId: string): boolean => {
    return assignments.find(a => a.contentId === contentId)?.customDrawers.includes(drawerId) || false;
  };

  const getContentDrawers = (contentId: string) => {
    const assignment = assignments.find(a => a.contentId === contentId);
    return {
      defaultDrawer: assignment?.defaultDrawer || null,
      customDrawers: assignment?.customDrawers || []
    };
  };

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

  const addCustomDrawer = (drawer: Omit<CustomDrawer, 'id'>): CustomDrawer => {
    const newDrawer: CustomDrawer = {
      ...drawer,
      id: `custom-${Date.now()}`
    };
    setCustomDrawers(prev => [...prev, newDrawer]);
    return newDrawer;
  };

  const removeCustomDrawer = (drawerId: string) => {
    setCustomDrawers(prev => prev.filter(d => d.id !== drawerId));
    setAssignments(prev => 
      prev.map(a => ({
        ...a,
        customDrawers: a.customDrawers.filter(id => id !== drawerId)
      })).filter(a => a.defaultDrawer !== null || a.customDrawers.length > 0)
    );
  };

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
      isDefaultDrawer
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

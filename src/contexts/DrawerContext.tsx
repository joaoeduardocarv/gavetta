import { createContext, useContext, useState, ReactNode } from "react";

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
  defaultDrawer: DefaultDrawerId | null; // Só pode estar em UMA gaveta padrão
  customDrawers: string[]; // Pode estar em MÚLTIPLAS gavetas personalizadas
}

interface DrawerContextType {
  // Gavetas personalizadas
  customDrawers: CustomDrawer[];
  addCustomDrawer: (drawer: Omit<CustomDrawer, 'id'>) => CustomDrawer;
  removeCustomDrawer: (drawerId: string) => void;
  
  // Atribuições de conteúdo
  assignments: ContentDrawerAssignment[];
  
  // Adicionar/remover de gaveta padrão (exclusivo)
  setDefaultDrawer: (contentId: string, drawerId: DefaultDrawerId | null) => void;
  getDefaultDrawer: (contentId: string) => DefaultDrawerId | null;
  
  // Adicionar/remover de gavetas personalizadas (múltiplas)
  addToCustomDrawer: (contentId: string, drawerId: string) => void;
  removeFromCustomDrawer: (contentId: string, drawerId: string) => void;
  isInCustomDrawer: (contentId: string, drawerId: string) => boolean;
  
  // Utilitários
  getContentDrawers: (contentId: string) => { defaultDrawer: DefaultDrawerId | null; customDrawers: string[] };
  getDrawerContents: (drawerId: string) => string[];
  isDefaultDrawer: (drawerId: string) => boolean;
}

const DrawerContext = createContext<DrawerContextType | null>(null);

export function DrawerProvider({ children }: { children: ReactNode }) {
  const [customDrawers, setCustomDrawers] = useState<CustomDrawer[]>([]);
  const [assignments, setAssignments] = useState<ContentDrawerAssignment[]>([]);

  const isDefaultDrawer = (drawerId: string): boolean => {
    return DEFAULT_DRAWER_IDS.includes(drawerId as DefaultDrawerId);
  };

  const findOrCreateAssignment = (contentId: string): ContentDrawerAssignment => {
    const existing = assignments.find(a => a.contentId === contentId);
    if (existing) return existing;
    return { contentId, defaultDrawer: null, customDrawers: [] };
  };

  const setDefaultDrawer = (contentId: string, drawerId: DefaultDrawerId | null) => {
    setAssignments(prev => {
      const existing = prev.find(a => a.contentId === contentId);
      if (existing) {
        return prev.map(a => 
          a.contentId === contentId 
            ? { ...a, defaultDrawer: drawerId }
            : a
        );
      }
      return [...prev, { contentId, defaultDrawer: drawerId, customDrawers: [] }];
    });
  };

  const getDefaultDrawer = (contentId: string): DefaultDrawerId | null => {
    return assignments.find(a => a.contentId === contentId)?.defaultDrawer || null;
  };

  const addToCustomDrawer = (contentId: string, drawerId: string) => {
    setAssignments(prev => {
      const existing = prev.find(a => a.contentId === contentId);
      if (existing) {
        if (existing.customDrawers.includes(drawerId)) return prev;
        return prev.map(a => 
          a.contentId === contentId 
            ? { ...a, customDrawers: [...a.customDrawers, drawerId] }
            : a
        );
      }
      return [...prev, { contentId, defaultDrawer: null, customDrawers: [drawerId] }];
    });
  };

  const removeFromCustomDrawer = (contentId: string, drawerId: string) => {
    setAssignments(prev => 
      prev.map(a => 
        a.contentId === contentId 
          ? { ...a, customDrawers: a.customDrawers.filter(id => id !== drawerId) }
          : a
      )
    );
  };

  const isInCustomDrawer = (contentId: string, drawerId: string): boolean => {
    return assignments.find(a => a.contentId === contentId)?.customDrawers.includes(drawerId) || false;
  };

  const getContentDrawers = (contentId: string) => {
    const assignment = findOrCreateAssignment(contentId);
    return {
      defaultDrawer: assignment.defaultDrawer,
      customDrawers: assignment.customDrawers
    };
  };

  const getDrawerContents = (drawerId: string): string[] => {
    if (isDefaultDrawer(drawerId)) {
      return assignments
        .filter(a => a.defaultDrawer === drawerId)
        .map(a => a.contentId);
    }
    return assignments
      .filter(a => a.customDrawers.includes(drawerId))
      .map(a => a.contentId);
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
    // Remover atribuições dessa gaveta
    setAssignments(prev => 
      prev.map(a => ({
        ...a,
        customDrawers: a.customDrawers.filter(id => id !== drawerId)
      }))
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

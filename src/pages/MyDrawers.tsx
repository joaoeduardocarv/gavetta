import { useState } from "react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { ContentCard } from "@/components/ContentCard";
import { ContentDetailDialog } from "@/components/ContentDetailDialog";
import { CreateDrawerDialog } from "@/components/CreateDrawerDialog";
import { Content } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Play, Eye, CheckCircle, Star, Heart, Bookmark, Clock, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDrawers } from "@/contexts/DrawerContext";

interface Drawer {
  id: string;
  name: string;
  icon: any;
  color: string;
}

const defaultDrawers: Drawer[] = [
  {
    id: "to-watch",
    name: "Para Assistir",
    icon: Play,
    color: "text-blue-500",
  },
  {
    id: "watching",
    name: "Assistindo",
    icon: Eye,
    color: "text-yellow-500",
  },
  {
    id: "watched",
    name: "Assistidos",
    icon: CheckCircle,
    color: "text-green-500",
  },
];

const iconMap: Record<string, any> = {
  Play,
  Eye,
  CheckCircle,
  Star,
  Heart,
  Bookmark,
  Clock,
  Sparkles,
};

export default function MyDrawers() {
  const { toast } = useToast();
  const { customDrawers, addCustomDrawer, getDrawerContents } = useDrawers();
  
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedDrawer, setSelectedDrawer] = useState<string | null>(null);

  const handleCardClick = (content: Content) => {
    setSelectedContent(content);
    setIsDialogOpen(true);
  };

  const handleContentChange = (newContent: Content) => {
    setSelectedContent(newContent);
    setIsDialogOpen(true);
  };

  const handleSelectDrawer = (drawerId: string) => {
    setSelectedDrawer(drawerId);
  };

  const handleCreateDrawer = (drawer: { name: string; icon: string; color: string; contentIds: string[] }) => {
    const newDrawer = addCustomDrawer({
      name: drawer.name,
      icon: drawer.icon,
      color: drawer.color,
    });
    
    toast({
      title: "Gavetta criada!",
      description: `"${drawer.name}" foi criada.`,
    });
  };

  // Obter contagem de cada gaveta
  const getDrawerCount = (drawerId: string): number => {
    return getDrawerContents(drawerId).length;
  };

  // Obter conteúdo da gaveta selecionada diretamente do contexto
  const getSelectedDrawerContent = (): Content[] => {
    if (!selectedDrawer) return [];
    return getDrawerContents(selectedDrawer);
  };

  const allDrawers = [
    ...defaultDrawers,
    ...customDrawers.map(d => ({
      id: d.id,
      name: d.name,
      icon: iconMap[d.icon] || Star,
      color: d.color,
    }))
  ];

  const drawerContent = getSelectedDrawerContent();

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      
      <main className="container mx-auto px-4 py-6 max-w-lg">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-heading text-3xl font-bold text-foreground">
            Minhas Gavettas
          </h2>
          <Button size="sm" variant="outline" onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova
          </Button>
        </div>

        {!selectedDrawer ? (
          <div className="space-y-3">
            <h3 className="font-heading text-lg font-semibold text-foreground mb-4">
              Gavettas Padrão
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Um conteúdo só pode estar em uma destas gavettas por vez.
            </p>
            
            {defaultDrawers.map((drawer) => {
              const Icon = drawer.icon;
              const count = getDrawerCount(drawer.id);
              return (
                <button
                  key={drawer.id}
                  onClick={() => handleSelectDrawer(drawer.id)}
                  className="w-full flex items-center justify-between p-4 bg-card rounded-lg border border-border hover:bg-accent/5 hover:border-accent/50 transition-all duration-200"
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`h-6 w-6 ${drawer.color}`} />
                    <div className="text-left">
                      <h4 className="font-heading font-bold text-foreground">
                        {drawer.name}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {count} {count === 1 ? 'item' : 'itens'}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary">{count}</Badge>
                </button>
              );
            })}

            {customDrawers.length > 0 && (
              <div className="pt-6">
                <h3 className="font-heading text-lg font-semibold text-foreground mb-4">
                  Gavettas Personalizadas
                </h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Um conteúdo pode estar em várias destas gavettas.
                </p>
                
                {customDrawers.map((drawer) => {
                  const Icon = iconMap[drawer.icon] || Star;
                  const count = getDrawerCount(drawer.id);
                  return (
                    <button
                      key={drawer.id}
                      onClick={() => handleSelectDrawer(drawer.id)}
                      className="w-full flex items-center justify-between p-4 bg-card rounded-lg border border-border hover:bg-accent/5 hover:border-accent/50 transition-all duration-200 mb-3"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`h-6 w-6 ${drawer.color}`} />
                        <div className="text-left">
                          <h4 className="font-heading font-bold text-foreground">
                            {drawer.name}
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            {count} {count === 1 ? 'item' : 'itens'}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary">{count}</Badge>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <Button 
              variant="ghost" 
              onClick={() => setSelectedDrawer(null)}
              className="mb-2"
            >
              ← Voltar
            </Button>
            
            <h3 className="font-heading text-xl font-bold text-foreground mb-4">
              {allDrawers.find(d => d.id === selectedDrawer)?.name}
            </h3>

            <div className="space-y-3">
              {drawerContent.map((content) => (
                <ContentCard
                  key={content.id}
                  content={content}
                  onClick={() => handleCardClick(content)}
                />
              ))}
            </div>

            {drawerContent.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Nenhum conteúdo nesta gavetta</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Adicione conteúdo clicando no botão "Adicionar à Gavetta" nos detalhes do filme/série
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      <BottomNav />

      {selectedContent && (
        <ContentDetailDialog
          content={selectedContent}
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          onContentChange={handleContentChange}
        />
      )}

      <CreateDrawerDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreateDrawer={handleCreateDrawer}
      />
    </div>
  );
}

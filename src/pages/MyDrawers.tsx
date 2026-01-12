import { useState } from "react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { ContentCard } from "@/components/ContentCard";
import { ContentDetailDialog } from "@/components/ContentDetailDialog";
import { CreateDrawerDialog } from "@/components/CreateDrawerDialog";
import { Content } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Play, Eye, CheckCircle, Star, Heart, Bookmark, Clock, Sparkles, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDrawers } from "@/contexts/DrawerContext";
import { 
  getMovieDetails, 
  getTVDetails, 
  getMovieCredits, 
  getTVCredits,
  getMovieWatchProviders, 
  getTVWatchProviders, 
  extractStreamingNames, 
  getTMDBImageUrl 
} from "@/lib/tmdb";

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
  const { customDrawers, addCustomDrawer, getDrawerContents, isLoading } = useDrawers();
  
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedDrawer, setSelectedDrawer] = useState<string | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const handleCardClick = async (content: Content) => {
    setIsLoadingDetails(true);
    
    try {
      // Extrair o ID numérico do TMDB do content.id (formato: "tmdb-movie-123" ou "tmdb-tv-123")
      const idMatch = content.id.match(/tmdb-(movie|tv)-(\d+)/);
      
      if (idMatch) {
        const [, mediaType, tmdbId] = idMatch;
        const numericId = parseInt(tmdbId, 10);
        
        if (mediaType === 'movie') {
          const [details, creditsData, providers] = await Promise.all([
            getMovieDetails(numericId),
            getMovieCredits(numericId),
            getMovieWatchProviders(numericId)
          ]);
          
          const director = creditsData.crew.find(c => c.job === 'Director');
          const enrichedContent: Content = {
            id: content.id,
            type: 'movie',
            title: details.title,
            originalTitle: details.title,
            releaseDate: details.release_date,
            synopsis: details.overview,
            posterUrl: getTMDBImageUrl(details.poster_path),
            backdropUrl: details.backdrop_path ? getTMDBImageUrl(details.backdrop_path, 'original') : undefined,
            genres: details.genres.map(g => g.name),
            director: director?.name,
            cast: creditsData.cast.slice(0, 10).map(c => c.name),
            availableOn: extractStreamingNames(providers),
            rating: Math.round(details.vote_average * 10) / 10,
          };
          
          setSelectedContent(enrichedContent);
        } else {
          const [details, creditsData, providers] = await Promise.all([
            getTVDetails(numericId),
            getTVCredits(numericId),
            getTVWatchProviders(numericId)
          ]);
          
          const enrichedContent: Content = {
            id: content.id,
            type: 'series',
            title: details.name,
            originalTitle: details.name,
            releaseDate: details.first_air_date,
            synopsis: details.overview,
            posterUrl: getTMDBImageUrl(details.poster_path),
            backdropUrl: details.backdrop_path ? getTMDBImageUrl(details.backdrop_path, 'original') : undefined,
            genres: details.genres.map(g => g.name),
            director: details.created_by?.[0]?.name,
            cast: creditsData.cast.slice(0, 10).map(c => c.name),
            availableOn: extractStreamingNames(providers),
            rating: Math.round(details.vote_average * 10) / 10,
          };
          
          setSelectedContent(enrichedContent);
        }
      } else {
        // Fallback para conteúdo sem ID do TMDB
        setSelectedContent(content);
      }
      
      setIsDialogOpen(true);
    } catch (error) {
      console.error('Error fetching content details:', error);
      // Em caso de erro, usar o conteúdo armazenado
      setSelectedContent(content);
      setIsDialogOpen(true);
      toast({
        title: "Aviso",
        description: "Algumas informações podem estar incompletas.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleContentChange = (newContent: Content) => {
    setSelectedContent(newContent);
    setIsDialogOpen(true);
  };

  const handleSelectDrawer = (drawerId: string) => {
    setSelectedDrawer(drawerId);
  };

  const handleCreateDrawer = async (drawer: { name: string; icon: string; color: string; contentIds: string[] }) => {
    try {
      await addCustomDrawer({
        name: drawer.name,
        icon: drawer.icon,
        color: drawer.color,
      });
      
      toast({
        title: "Gavetta criada!",
        description: `"${drawer.name}" foi criada.`,
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível criar a gavetta.",
        variant: "destructive",
      });
    }
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

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !selectedDrawer ? (
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
              {isLoadingDetails && (
                <div className="fixed inset-0 bg-background/50 flex items-center justify-center z-50">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
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

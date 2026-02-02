import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Film, Tv, Calendar, Star, Share2, MessageCircle, FolderOpen, Check, Play, Eye, CheckCircle, Loader2 } from "lucide-react";
import { useStoryShare } from "@/hooks/useStoryShare";
import { RecommendDialog } from "./RecommendDialog";
import { PersonDetailDialog } from "./PersonDetailDialog";
import { Content } from "@/lib/mockData";
import { cn } from "@/lib/utils";
import { useDrawers, DEFAULT_DRAWER_IDS, DefaultDrawerId } from "@/contexts/DrawerContext";
import { useToast } from "@/hooks/use-toast";
import { searchPerson, getTMDBProfileUrl, TMDBPersonCredit, getMovieDetails, getTVDetails, getMovieCredits, getMovieWatchProviders, getTVWatchProviders, extractStreamingNames, getTMDBImageUrl } from "@/lib/tmdb";

interface ContentDetailDialogProps {
  content: Content | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContentChange?: (content: Content) => void;
}

const typeLabels = {
  movie: 'Filme',
  series: 'Série',
};

const typeIcons = {
  movie: <Film className="h-3.5 w-3.5" />,
  series: <Tv className="h-3.5 w-3.5" />,
};

const defaultDrawerInfo = [
  { id: 'to-watch' as DefaultDrawerId, name: 'Para Assistir', icon: Play, emoji: '📌' },
  { id: 'watching' as DefaultDrawerId, name: 'Assistindo', icon: Eye, emoji: '👀' },
  { id: 'watched' as DefaultDrawerId, name: 'Assistido', icon: CheckCircle, emoji: '✓' },
];

interface PersonInfo {
  id: number;
  name: string;
  profile_path: string | null;
}

export function ContentDetailDialog({ content, open, onOpenChange, onContentChange }: ContentDetailDialogProps) {
  const { toast } = useToast();
  const { shareToStory, isGenerating: isGeneratingStory } = useStoryShare();
  const { 
    customDrawers, 
    getContentDrawers, 
    setDefaultDrawer, 
    addToCustomDrawer, 
    removeFromCustomDrawer,
    isInCustomDrawer,
    setContentRating,
    setContentComment
  } = useDrawers();
  
  const [comment, setComment] = useState("");
  const [isRecommendDialogOpen, setIsRecommendDialogOpen] = useState(false);
  const [isDrawerMenuOpen, setIsDrawerMenuOpen] = useState(false);
  
  // Estado para pessoa selecionada
  const [selectedPerson, setSelectedPerson] = useState<{ id: number; name: string } | null>(null);
  const [isPersonDialogOpen, setIsPersonDialogOpen] = useState(false);
  
  // Estado para fotos de diretor e elenco
  const [directorInfo, setDirectorInfo] = useState<PersonInfo | null>(null);
  const [castInfo, setCastInfo] = useState<PersonInfo[]>([]);
  const [isLoadingCredit, setIsLoadingCredit] = useState(false);
  
  // Obter gavetas e rating atuais do conteúdo
  const contentDrawers = content ? getContentDrawers(content.id) : { defaultDrawer: null, customDrawers: [], rating: null, comment: null };
  
  // Sincronizar comentário local com o do contexto quando o conteúdo mudar
  useEffect(() => {
    if (content && open) {
      setComment(contentDrawers.comment || "");
    }
  }, [content?.id, open]);

  // Buscar informações de diretor e elenco quando o conteúdo mudar
  useEffect(() => {
    if (content && open) {
      // Buscar diretor
      if (content.director) {
        searchPerson(content.director)
          .then(results => {
            if (results.length > 0) {
              setDirectorInfo(results[0]);
            }
          })
          .catch(console.error);
      }
      
      // Buscar elenco (primeiros 10)
      if (content.cast && content.cast.length > 0) {
        Promise.all(
          content.cast.slice(0, 10).map(name => 
            searchPerson(name).then(results => results[0] || { id: 0, name, profile_path: null })
          )
        )
          .then(results => setCastInfo(results.filter(r => r)))
          .catch(console.error);
      }
    } else {
      setDirectorInfo(null);
      setCastInfo([]);
    }
  }, [content, open]);

  if (!content) return null;

  const handlePersonClick = (person: PersonInfo) => {
    if (person.id) {
      setSelectedPerson({ id: person.id, name: person.name });
      setIsPersonDialogOpen(true);
    }
  };

  // Handler para quando um crédito da filmografia for selecionado
  const handleSelectCredit = async (credit: TMDBPersonCredit) => {
    setIsLoadingCredit(true);
    try {
      if (credit.media_type === 'movie') {
        const [details, creditsData, providers] = await Promise.all([
          getMovieDetails(credit.id),
          getMovieCredits(credit.id),
          getMovieWatchProviders(credit.id)
        ]);
        
        const director = creditsData.crew.find(c => c.job === 'Director');
        const newContent: Content = {
          id: `tmdb-movie-${details.id}`,
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
        
        // Atualizar o conteúdo atual com os novos dados
        setDirectorInfo(null);
        setCastInfo([]);
        onOpenChange(false);
        setTimeout(() => {
          setSelectedPerson(null);
          // Reabrir com novo conteúdo via callback
          if (onContentChange) {
            onContentChange(newContent);
          }
        }, 100);
      } else {
        const [details, providers] = await Promise.all([
          getTVDetails(credit.id),
          getTVWatchProviders(credit.id)
        ]);
        
        const newContent: Content = {
          id: `tmdb-tv-${details.id}`,
          type: 'series',
          title: details.name,
          originalTitle: details.name,
          releaseDate: details.first_air_date,
          synopsis: details.overview,
          posterUrl: getTMDBImageUrl(details.poster_path),
          backdropUrl: details.backdrop_path ? getTMDBImageUrl(details.backdrop_path, 'original') : undefined,
          genres: details.genres.map(g => g.name),
          director: details.created_by?.[0]?.name,
          cast: [], // TV shows need separate credits call
          availableOn: extractStreamingNames(providers),
          rating: Math.round(details.vote_average * 10) / 10,
        };
        
        setDirectorInfo(null);
        setCastInfo([]);
        onOpenChange(false);
        setTimeout(() => {
          setSelectedPerson(null);
          if (onContentChange) {
            onContentChange(newContent);
          }
        }, 100);
      }
    } catch (error) {
      console.error('Error fetching credit details:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os detalhes.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingCredit(false);
    }
  };

  const handleSelectDefaultDrawer = async (drawerId: DefaultDrawerId) => {
    if (!content) return;
    
    const previousDrawer = contentDrawers.defaultDrawer;
    const drawerName = defaultDrawerInfo.find(d => d.id === drawerId)?.name;
    
    if (previousDrawer === drawerId) {
      // Remover da gaveta padrão - não fecha o dialog
      await setDefaultDrawer(content, null);
      toast({
        title: "Removido da gaveta",
        description: `"${content.title}" foi removido de "${drawerName}".`,
      });
      setIsDrawerMenuOpen(false);
    } else {
      // Mover para nova gaveta padrão (remove automaticamente da anterior)
      await setDefaultDrawer(content, drawerId);
      
      if (previousDrawer) {
        const previousName = defaultDrawerInfo.find(d => d.id === previousDrawer)?.name;
        toast({
          title: "Gaveta alterada",
          description: `"${content.title}" foi movido de "${previousName}" para "${drawerName}".`,
        });
      } else {
        toast({
          title: "Adicionado à gaveta",
          description: `"${content.title}" foi adicionado a "${drawerName}".`,
        });
      }

      // Importante: fechar o dropdown antes de fechar o Dialog para evitar overlay preso
      setIsDrawerMenuOpen(false);
      window.requestAnimationFrame(() => onOpenChange(false));
    }
  };

  const handleToggleCustomDrawer = async (drawerId: string) => {
    const drawer = customDrawers.find(d => d.id === drawerId);
    if (!drawer || !content) return;

    if (isInCustomDrawer(content.id, drawerId)) {
      await removeFromCustomDrawer(content.id, drawerId);
      toast({
        title: "Removido da gaveta",
        description: `"${content.title}" foi removido de "${drawer.name}".`,
      });
      setIsDrawerMenuOpen(false);
    } else {
      await addToCustomDrawer(content, drawerId);
      toast({
        title: "Adicionado à gaveta",
        description: `"${content.title}" foi adicionado a "${drawer.name}".`,
      });
      // Importante: fechar o dropdown antes de fechar o Dialog para evitar overlay preso
      setIsDrawerMenuOpen(false);
      window.requestAnimationFrame(() => onOpenChange(false));
    }
  };

  const getButtonLabel = () => {
    const parts: string[] = [];
    
    if (contentDrawers.defaultDrawer) {
      const drawer = defaultDrawerInfo.find(d => d.id === contentDrawers.defaultDrawer);
      if (drawer) parts.push(drawer.name);
    }
    
    const customCount = contentDrawers.customDrawers.length;
    if (customCount > 0) {
      parts.push(`+${customCount} personalizada${customCount > 1 ? 's' : ''}`);
    }
    
    return parts.length > 0 ? parts.join(' • ') : 'Adicionar à Gavetta';
  };

  const hasAnyDrawer = contentDrawers.defaultDrawer || contentDrawers.customDrawers.length > 0;

  // Resetar estados quando o dialog principal fecha
  const handleMainDialogChange = (open: boolean) => {
    if (!open) {
      setIsDrawerMenuOpen(false);
      setIsPersonDialogOpen(false);
      setSelectedPerson(null);
      setIsRecommendDialogOpen(false);
    }
    onOpenChange(open);
  };

  return (
  <>
    <Dialog open={open} onOpenChange={handleMainDialogChange}>
      <DialogContent className="max-w-lg sm:max-w-lg max-w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto overflow-x-hidden p-0">
        <DialogTitle className="sr-only">Detalhes do conteúdo</DialogTitle>
        <DialogDescription className="sr-only">
          Veja informações, elenco e opções para adicionar o conteúdo às suas gavettas.
        </DialogDescription>
        
        {/* Botão Adicionar à Gavetta - fixo no topo */}
        <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b p-3 flex justify-end">
          <DropdownMenu open={isDrawerMenuOpen} onOpenChange={setIsDrawerMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant={hasAnyDrawer ? "default" : "outline"}
                size="default"
                className={cn(
                  "shadow-lg gap-2 w-full sm:w-auto",
                  hasAnyDrawer && "bg-gradient-to-r from-primary to-primary/80"
                )}
              >
                <FolderOpen className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{getButtonLabel()}</span>
              </Button>
            </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                {/* Gavetas Padrão - Mutuamente Exclusivas */}
                <div className="px-2 py-1.5">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Gavetas Padrão (escolha uma)
                  </p>
                </div>
                {defaultDrawerInfo.map((drawer) => {
                  const Icon = drawer.icon;
                  const isSelected = contentDrawers.defaultDrawer === drawer.id;
                  return (
                    <DropdownMenuItem
                      key={drawer.id}
                      onClick={() => handleSelectDefaultDrawer(drawer.id)}
                      className="cursor-pointer"
                    >
                      <Icon className={cn(
                        "h-4 w-4 mr-2",
                        isSelected && "text-primary"
                      )} />
                      <span className="flex-1">{drawer.name}</span>
                      {isSelected && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </DropdownMenuItem>
                  );
                })}

                {/* Gavetas Personalizadas - Múltipla Seleção */}
                {customDrawers.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <div className="px-2 py-1.5">
                      <p className="text-xs font-semibold text-muted-foreground">
                        Gavetas Personalizadas (múltiplas)
                      </p>
                    </div>
                    {customDrawers.map((drawer) => {
                      const isSelected = isInCustomDrawer(content.id, drawer.id);
                      return (
                        <DropdownMenuItem
                          key={drawer.id}
                          onClick={() => handleToggleCustomDrawer(drawer.id)}
                          className="cursor-pointer"
                        >
                          <span className="mr-2">{drawer.icon}</span>
                          <span className="flex-1">{drawer.name}</span>
                          {isSelected && (
                            <Check className="h-4 w-4 text-primary" />
                          )}
                        </DropdownMenuItem>
                      );
                    })}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
        </div>
          {/* Backdrop Image */}
          {content.backdropUrl && (
            <div className="relative h-64 w-full overflow-hidden">
              <img
                src={content.backdropUrl}
                alt={content.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
            </div>
          )}

          {/* Content */}
          <div className="p-6 space-y-6 overflow-x-hidden">
            {/* Header com Poster e Info Básica */}
            <div className="flex gap-4">
              <Avatar className="h-32 w-24 rounded-lg flex-shrink-0">
                <AvatarImage src={content.posterUrl} alt={content.title} className="object-cover" />
                <AvatarFallback>{content.title[0]}</AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0 space-y-2">
                <h2 className="font-heading text-xl sm:text-2xl font-bold text-foreground break-words">
                  {content.title}
                </h2>
                {content.originalTitle && (
                  <p className="text-sm text-muted-foreground italic">
                    {content.originalTitle}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="gap-1">
                    {typeIcons[content.type]}
                    {typeLabels[content.type]}
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(content.releaseDate).getFullYear()}
                  </Badge>
                  {content.rating && (
                    <Badge variant="outline" className="gap-1">
                      <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                      {content.rating}/10
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Informações Detalhadas */}
            <div className="space-y-4">
              {content.director && (
                <div>
                  <Label className="text-sm font-semibold">Diretor</Label>
                  <div className="mt-2">
                    <button
                      onClick={() => directorInfo && handlePersonClick(directorInfo)}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors text-left"
                    >
                      <Avatar className="h-12 w-12 rounded-full">
                        <AvatarImage 
                          src={directorInfo?.profile_path ? getTMDBProfileUrl(directorInfo.profile_path) : undefined}
                          alt={content.director}
                          className="object-cover"
                        />
                        <AvatarFallback>{content.director.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{content.director}</span>
                    </button>
                  </div>
                </div>
              )}

              {content.cast && content.cast.length > 0 && (
                <div className="overflow-hidden">
                  <Label className="text-sm font-semibold">Elenco</Label>
                  <div className="mt-2 -mx-6 px-6">
                    <div className="flex gap-3 pb-2 overflow-x-auto scrollbar-thin scrollbar-thumb-muted">
                      {content.cast.slice(0, 10).map((actor, index) => {
                        const actorInfo = castInfo[index];
                        return (
                          <button
                            key={actor}
                            onClick={() => actorInfo && handlePersonClick(actorInfo)}
                            className="flex flex-col items-center gap-2 p-2 rounded-lg hover:bg-accent/50 transition-colors flex-shrink-0"
                            style={{ width: '80px' }}
                          >
                            <Avatar className="h-14 w-14 rounded-full">
                              <AvatarImage 
                                src={actorInfo?.profile_path ? getTMDBProfileUrl(actorInfo.profile_path) : undefined}
                                alt={actor}
                                className="object-cover"
                              />
                              <AvatarFallback>{actor.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-center line-clamp-2 w-full">{actor}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {content.genres && content.genres.length > 0 && (
                <div>
                  <Label className="text-sm font-semibold">Gêneros</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {content.genres.map((genre) => (
                      <Badge key={genre} variant="secondary">
                        {genre}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="overflow-hidden">
                <Label className="text-sm font-semibold">Sinopse</Label>
                <p className="text-sm text-muted-foreground leading-relaxed break-words whitespace-pre-wrap">
                  {content.synopsis}
                </p>
              </div>

              {content.availableOn && content.availableOn.length > 0 && (
                <div>
                  <Label className="text-sm font-semibold">Disponível em</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {content.availableOn.map((platform) => (
                      <Badge key={platform} variant="outline">
                        {platform}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Avaliação (só se na gaveta "Assistido") */}
            {contentDrawers.defaultDrawer === 'watched' && content && (
              <div className="space-y-4">
                <Label className="text-sm font-semibold">Sua Nota (1-10) <span className="text-destructive">*</span></Label>
                <div className="flex gap-1">
                  {[...Array(10)].map((_, i) => {
                    const starValue = i + 1;
                    const currentRating = contentDrawers.rating || 0;
                    return (
                      <button
                        key={i}
                        onClick={() => setContentRating(content.id, starValue)}
                        className={cn(
                          "p-1 transition-colors",
                          i < currentRating ? "text-yellow-500" : "text-muted-foreground"
                        )}
                      >
                        <Star className={cn("h-6 w-6", i < currentRating && "fill-yellow-500")} />
                      </button>
                    );
                  })}
                </div>
                {!contentDrawers.rating && (
                  <p className="text-xs text-destructive">
                    Selecione uma nota para este conteúdo
                  </p>
                )}
              </div>
            )}

            {/* Comentário (quando em alguma gaveta) */}
            {hasAnyDrawer && content && (
              <div className="space-y-4">
                <Label className="text-sm font-semibold">Comentário (opcional)</Label>
                <Textarea
                  placeholder="Adicione um comentário sobre este conteúdo..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onBlur={() => {
                    if (content && comment !== contentDrawers.comment) {
                      setContentComment(content.id, comment);
                    }
                  }}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Este comentário será visível apenas no seu perfil
                </p>
              </div>
            )}

            <Separator />

            {/* Ações */}
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1 gap-2"
                onClick={() => setIsRecommendDialogOpen(true)}
              >
                <MessageCircle className="h-4 w-4" />
                Indicar para Amigo
              </Button>
              <Button 
                variant="outline" 
                className="flex-1 gap-2"
                onClick={() => shareToStory({
                  title: content.title,
                  posterUrl: content.posterUrl,
                  backdropUrl: content.backdropUrl,
                  type: content.type,
                })}
                disabled={isGeneratingStory}
              >
                {isGeneratingStory ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Share2 className="h-4 w-4" />
                )}
                Compartilhar
              </Button>
            </div>
          </div>
        {/* Dialog de Indicação */}
        <RecommendDialog
          content={content}
          open={isRecommendDialogOpen}
          onOpenChange={setIsRecommendDialogOpen}
        />
      </DialogContent>
    </Dialog>

    {/* Dialog de Pessoa - totalmente fora do Dialog principal para evitar conflitos */}
    <PersonDetailDialog
      personId={selectedPerson?.id || null}
      personName={selectedPerson?.name || ''}
      open={isPersonDialogOpen}
      onOpenChange={(open) => {
        setIsPersonDialogOpen(open);
        if (!open) {
          setSelectedPerson(null);
        }
      }}
      onSelectContent={handleSelectCredit}
    />
  </>
  );
}

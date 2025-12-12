import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Film, Tv, Calendar, Star, Share2, MessageCircle, FolderOpen, Check, Play, Eye, CheckCircle } from "lucide-react";
import { RecommendDialog } from "./RecommendDialog";
import { Content } from "@/lib/mockData";
import { cn } from "@/lib/utils";
import { useDrawers, DEFAULT_DRAWER_IDS, DefaultDrawerId } from "@/contexts/DrawerContext";
import { useToast } from "@/hooks/use-toast";

interface ContentDetailDialogProps {
  content: Content | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export function ContentDetailDialog({ content, open, onOpenChange }: ContentDetailDialogProps) {
  const { toast } = useToast();
  const { 
    customDrawers, 
    getContentDrawers, 
    setDefaultDrawer, 
    addToCustomDrawer, 
    removeFromCustomDrawer,
    isInCustomDrawer 
  } = useDrawers();
  
  const [userRating, setUserRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isRecommendDialogOpen, setIsRecommendDialogOpen] = useState(false);

  // Obter gavetas atuais do conteúdo
  const contentDrawers = content ? getContentDrawers(content.id) : { defaultDrawer: null, customDrawers: [] };

  if (!content) return null;

  const handleSelectDefaultDrawer = (drawerId: DefaultDrawerId) => {
    const previousDrawer = contentDrawers.defaultDrawer;
    const drawerName = defaultDrawerInfo.find(d => d.id === drawerId)?.name;
    
    if (previousDrawer === drawerId) {
      // Remover da gaveta padrão
      setDefaultDrawer(content, null);
      toast({
        title: "Removido da gaveta",
        description: `"${content.title}" foi removido de "${drawerName}".`,
      });
    } else {
      // Mover para nova gaveta padrão (remove automaticamente da anterior)
      setDefaultDrawer(content, drawerId);
      
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
    }
  };

  const handleToggleCustomDrawer = (drawerId: string) => {
    const drawer = customDrawers.find(d => d.id === drawerId);
    if (!drawer) return;

    if (isInCustomDrawer(content.id, drawerId)) {
      removeFromCustomDrawer(content.id, drawerId);
      toast({
        title: "Removido da gaveta",
        description: `"${content.title}" foi removido de "${drawer.name}".`,
      });
    } else {
      addToCustomDrawer(content, drawerId);
      toast({
        title: "Adicionado à gaveta",
        description: `"${content.title}" foi adicionado a "${drawer.name}".`,
      });
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <div className="relative">
          {/* Botão Adicionar à Gavetta */}
          <div className="absolute top-4 right-4 z-50">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={hasAnyDrawer ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "shadow-lg gap-2 max-w-[200px]",
                    hasAnyDrawer && "bg-gradient-to-r from-primary to-primary/80"
                  )}
                >
                  <FolderOpen className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate text-xs">{getButtonLabel()}</span>
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
          <div className="p-6 space-y-6">
            {/* Header com Poster e Info Básica */}
            <div className="flex gap-4">
              <Avatar className="h-32 w-24 rounded-lg flex-shrink-0">
                <AvatarImage src={content.posterUrl} alt={content.title} className="object-cover" />
                <AvatarFallback>{content.title[0]}</AvatarFallback>
              </Avatar>

              <div className="flex-1 space-y-2">
                <h2 className="font-heading text-2xl font-bold text-foreground">
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
                  <p className="text-sm text-muted-foreground">{content.director}</p>
                </div>
              )}

              {content.cast && content.cast.length > 0 && (
                <div>
                  <Label className="text-sm font-semibold">Elenco</Label>
                  <p className="text-sm text-muted-foreground">{content.cast.join(", ")}</p>
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

              <div>
                <Label className="text-sm font-semibold">Sinopse</Label>
                <p className="text-sm text-muted-foreground leading-relaxed">
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
            {contentDrawers.defaultDrawer === 'watched' && (
              <div className="space-y-4">
                <Label className="text-sm font-semibold">Sua Nota (0-10) <span className="text-destructive">*</span></Label>
                <div className="flex gap-1">
                  {[...Array(10)].map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setUserRating(i + 1)}
                      className={cn(
                        "p-1 transition-colors",
                        i < userRating ? "text-yellow-500" : "text-muted-foreground"
                      )}
                    >
                      <Star className={cn("h-6 w-6", i < userRating && "fill-yellow-500")} />
                    </button>
                  ))}
                </div>
                {userRating === 0 && (
                  <p className="text-xs text-destructive">
                    Selecione uma nota para este conteúdo
                  </p>
                )}
              </div>
            )}

            {/* Comentário (quando em alguma gaveta) */}
            {hasAnyDrawer && (
              <div className="space-y-4">
                <Label className="text-sm font-semibold">Comentário (opcional)</Label>
                <Textarea
                  placeholder="Adicione um comentário sobre este conteúdo..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
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
              <Button variant="outline" className="flex-1 gap-2">
                <Share2 className="h-4 w-4" />
                Compartilhar
              </Button>
            </div>
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
  );
}

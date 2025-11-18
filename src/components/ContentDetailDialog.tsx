import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Badge } from "./ui/badge";
import { Star, Calendar, Film, Tv } from "lucide-react";
import { Button } from "./ui/button";
import type { Content } from "@/lib/mockData";
import { cn } from "@/lib/utils";
import { useState } from "react";
import gavetaIcon from "@/assets/gaveta-icon.png";

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
  movie: Film,
  series: Tv,
};

export function ContentDetailDialog({ content, open, onOpenChange }: ContentDetailDialogProps) {
  const [isInDrawer, setIsInDrawer] = useState(content?.isInDrawer || false);
  
  if (!content) return null;

  const Icon = typeIcons[content.type];
  const year = new Date(content.releaseDate).getFullYear();

  const toggleDrawer = () => {
    setIsInDrawer(!isInDrawer);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Botão da Gaveta - Fixo no canto superior direito */}
        <Button
          onClick={toggleDrawer}
          variant="ghost"
          size="icon"
          className={cn(
            "absolute right-14 top-4 rounded-lg h-12 w-12 z-50",
            isInDrawer ? "bg-primary/10 hover:bg-primary/20" : "bg-muted/50 hover:bg-muted"
          )}
          title={isInDrawer ? "Remover da gaveta" : "Adicionar à gaveta"}
        >
          <img 
            src={gavetaIcon} 
            alt="Gaveta" 
            className={cn("h-7 w-7 transition-opacity", isInDrawer ? "opacity-100" : "opacity-40")}
          />
        </Button>

        <DialogHeader>
          <DialogTitle className="flex items-start gap-3 pr-16">
            <div className="flex-shrink-0 mt-1">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="font-heading text-xl font-bold text-foreground leading-tight">
                {content.title}
              </h2>
              {content.originalTitle && (
                <p className="text-sm text-muted-foreground mt-1">
                  {content.originalTitle}
                </p>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Poster/Backdrop */}
          {content.backdropUrl && (
            <div className="rounded-lg overflow-hidden">
              <img 
                src={content.backdropUrl} 
                alt={content.title}
                className="w-full h-48 object-cover"
              />
            </div>
          )}

          {/* Basic Info */}
          <div className="flex flex-wrap gap-2 items-center">
            <Badge variant="secondary">{typeLabels[content.type]}</Badge>
            <div className="flex items-center gap-1 text-muted-foreground text-sm">
              <Calendar className="h-3.5 w-3.5" />
              <span>{year}</span>
            </div>
            {content.rating && (
              <div className="flex items-center gap-1 text-accent">
                <Star className="h-3.5 w-3.5 fill-accent" />
                <span className="text-sm font-semibold">{content.rating.toFixed(1)}</span>
              </div>
            )}
          </div>

          {/* Status */}
          {content.status && (
            <div>
              <h3 className="font-semibold text-foreground mb-2">Status</h3>
              <Badge variant="outline">
                {content.status === 'watched' && 'Assistido'}
                {content.status === 'watching' && 'Assistindo'}
                {content.status === 'to_watch' && 'Para Assistir'}
              </Badge>
            </div>
          )}

          {/* Genres */}
          <div>
            <h3 className="font-semibold text-foreground mb-2">Gêneros</h3>
            <div className="flex flex-wrap gap-2">
              {content.genres.map((genre) => (
                <Badge key={genre} variant="outline" className="text-xs">
                  {genre}
                </Badge>
              ))}
            </div>
          </div>

          {/* Synopsis */}
          <div>
            <h3 className="font-semibold text-foreground mb-2">Sinopse</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {content.synopsis}
            </p>
          </div>

          {/* Director */}
          {content.director && (
            <div>
              <h3 className="font-semibold text-foreground mb-2">
                {content.type === 'series' ? 'Criador' : 'Diretor'}
              </h3>
              <p className="text-sm text-muted-foreground">{content.director}</p>
            </div>
          )}

          {/* Cast */}
          {content.cast && content.cast.length > 0 && (
            <div>
              <h3 className="font-semibold text-foreground mb-2">Elenco</h3>
              <p className="text-sm text-muted-foreground">
                {content.cast.join(', ')}
              </p>
            </div>
          )}

          {/* Available On */}
          {content.availableOn && content.availableOn.length > 0 && (
            <div>
              <h3 className="font-semibold text-foreground mb-2">Disponível em</h3>
              <div className="flex flex-wrap gap-2">
                {content.availableOn.map((platform) => (
                  <Badge key={platform} variant="secondary" className="text-xs">
                    {platform}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Drawer Comment */}
          {isInDrawer && content.drawerComment && (
            <div className="bg-muted/50 rounded-lg p-4 border border-border">
              <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                <img src={gavetaIcon} alt="Gaveta" className="h-4 w-4" />
                Sua Nota da Gaveta
              </h3>
              <p className="text-sm text-muted-foreground italic">
                "{content.drawerComment}"
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

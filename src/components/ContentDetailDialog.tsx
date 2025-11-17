import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Badge } from "./ui/badge";
import { Star, Calendar, Film, Tv, Book, Mic, Theater } from "lucide-react";
import type { Content } from "@/lib/mockData";
import { cn } from "@/lib/utils";

interface ContentDetailDialogProps {
  content: Content | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const typeLabels = {
  movie: 'Filme',
  series: 'Série',
  book: 'Livro',
  podcast: 'Podcast',
  play: 'Peça',
  short: 'Curta',
};

const typeIcons = {
  movie: Film,
  series: Tv,
  book: Book,
  podcast: Mic,
  play: Theater,
  short: Film,
};

export function ContentDetailDialog({ content, open, onOpenChange }: ContentDetailDialogProps) {
  if (!content) return null;

  const Icon = typeIcons[content.type];
  const year = new Date(content.releaseDate).getFullYear();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-start gap-3">
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
                  <Badge key={platform} className="bg-primary/10 text-primary hover:bg-primary/20">
                    {platform}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

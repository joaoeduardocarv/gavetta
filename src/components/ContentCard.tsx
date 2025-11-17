import { Heart, Star, Film, Tv, Book, Mic, Theater } from "lucide-react";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { cn } from "@/lib/utils";
import type { Content } from "@/lib/mockData";

interface ContentCardProps {
  content: Content;
  onClick?: () => void;
}

const statusLabels = {
  watched: 'Assistido',
  watching: 'Assistindo',
  to_watch: 'Para Assistir',
};

const typeIcons = {
  movie: Film,
  series: Tv,
  book: Book,
  podcast: Mic,
  play: Theater,
  short: Film,
};


export function ContentCard({ content, onClick }: ContentCardProps) {
  const Icon = typeIcons[content.type];
  
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-4 p-4 bg-card rounded-lg border border-border transition-all duration-200 hover:bg-accent/5 hover:border-accent/50 active:scale-[0.98]"
    >
      <Avatar className="h-14 w-14 flex-shrink-0 rounded-lg">
        {content.posterUrl && (
          <AvatarImage 
            src={content.posterUrl} 
            alt={content.title}
            className="object-cover"
          />
        )}
        <AvatarFallback className="rounded-lg bg-muted">
          <Icon className="h-7 w-7 text-muted-foreground" />
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-heading font-bold text-foreground line-clamp-1">
            {content.title}
          </h3>
          {content.isFavorite && (
            <Heart className="h-4 w-4 fill-accent text-accent flex-shrink-0" />
          )}
        </div>
        
        <div className="flex flex-wrap items-center gap-2 mt-1">
          {content.status && (
            <Badge variant="secondary" className="text-xs">
              {statusLabels[content.status]}
            </Badge>
          )}
          {content.rating && (
            <div className="flex items-center gap-1 text-accent">
              <Star className="h-3 w-3 fill-accent" />
              <span className="text-xs font-semibold">{content.rating.toFixed(1)}</span>
            </div>
          )}
        </div>
        
        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
          {content.genres.join(" • ")}
        </p>
      </div>
    </div>
  );
}

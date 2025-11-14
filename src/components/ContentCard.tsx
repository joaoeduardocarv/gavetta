import { Heart, Star } from "lucide-react";
import { Badge } from "./ui/badge";
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

export function ContentCard({ content, onClick }: ContentCardProps) {
  return (
    <div
      onClick={onClick}
      className="group relative cursor-pointer overflow-hidden rounded-lg bg-gradient-card transition-all duration-300 hover:scale-105 hover:shadow-glow"
    >
      <div className="aspect-[2/3] overflow-hidden">
        <img
          src={content.posterUrl}
          alt={content.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
        />
      </div>
      
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      
      <div className="absolute bottom-0 left-0 right-0 translate-y-full p-4 transition-transform duration-300 group-hover:translate-y-0">
        <h3 className="font-heading text-lg font-bold text-foreground line-clamp-2">
          {content.title}
        </h3>
        
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {content.status && (
            <Badge variant="secondary" className="text-xs">
              {statusLabels[content.status]}
            </Badge>
          )}
          {content.rating && (
            <div className="flex items-center gap-1 text-accent">
              <Star className="h-4 w-4 fill-accent" />
              <span className="text-sm font-semibold">{content.rating.toFixed(1)}</span>
            </div>
          )}
        </div>
        
        <div className="mt-1 flex flex-wrap gap-1">
          {content.genres.slice(0, 2).map((genre) => (
            <span key={genre} className="text-xs text-muted-foreground">
              {genre}
            </span>
          ))}
        </div>
      </div>
      
      {content.isFavorite && (
        <div className="absolute right-2 top-2">
          <Heart className="h-5 w-5 fill-accent text-accent drop-shadow-glow" />
        </div>
      )}
    </div>
  );
}

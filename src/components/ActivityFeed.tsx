import { useFriendActivities, FriendActivity } from "@/hooks/useFriendActivities";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Star, Film, Tv, Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { ContentDetailDialog } from "@/components/ContentDetailDialog";
import { Content } from "@/lib/mockData";

export function ActivityFeed() {
  const { activities, isLoading } = useFriendActivities();
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleActivityClick = (activity: FriendActivity) => {
    const content: Content = {
      id: String(activity.production_data.id),
      title: activity.production_data.title || activity.production_data.name || "",
      type: activity.production_type === "movie" ? "movie" : "series",
      posterUrl: activity.production_data.poster_path
        ? `https://image.tmdb.org/t/p/w500${activity.production_data.poster_path}`
        : "/placeholder.svg",
      releaseDate: activity.production_data.release_date || 
                   activity.production_data.first_air_date || "",
      synopsis: "",
      genres: [],
      rating: activity.production_data.vote_average || 0,
    };
    setSelectedContent(content);
    setIsDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Activity className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h4 className="font-medium mb-2">Nenhuma atividade ainda</h4>
          <p className="text-sm text-muted-foreground">
            Quando seus amigos marcarem filmes e séries como assistidos, eles aparecerão aqui.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {activities.map((activity) => (
          <ActivityCard
            key={activity.id}
            activity={activity}
            onClick={() => handleActivityClick(activity)}
          />
        ))}
      </div>

      {selectedContent && (
        <ContentDetailDialog
          content={selectedContent}
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          onContentChange={(newContent) => {
            setSelectedContent(newContent);
            setIsDialogOpen(true);
          }}
        />
      )}
    </>
  );
}

function ActivityCard({
  activity,
  onClick,
}: {
  activity: FriendActivity;
  onClick: () => void;
}) {
  const title = activity.production_data.title || activity.production_data.name || "Sem título";
  const posterUrl = activity.production_data.poster_path
    ? `https://image.tmdb.org/t/p/w92${activity.production_data.poster_path}`
    : "/placeholder.svg";
  const isMovie = activity.production_type === "movie";
  const timeAgo = formatDistanceToNow(new Date(activity.created_at), {
    addSuffix: true,
    locale: ptBR,
  });

  return (
    <div
      className="flex gap-3 p-3 bg-card rounded-lg border border-border hover:bg-accent/5 hover:border-accent/50 transition-all duration-200 cursor-pointer"
      onClick={onClick}
    >
      {/* User Avatar */}
      <Avatar className="h-10 w-10 flex-shrink-0">
        <AvatarImage src={activity.avatar_url || ""} alt={activity.username || ""} />
        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
          {activity.username?.slice(0, 2).toUpperCase() || "??"}
        </AvatarFallback>
      </Avatar>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm">
              <span className="font-semibold text-foreground">
                {activity.username || "Usuário"}
              </span>{" "}
              <span className="text-muted-foreground">assistiu</span>
            </p>
            <p className="font-medium text-foreground text-sm mt-0.5 truncate">
              {title}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs px-1.5 py-0">
                {isMovie ? (
                  <>
                    <Film className="h-3 w-3 mr-1" />
                    Filme
                  </>
                ) : (
                  <>
                    <Tv className="h-3 w-3 mr-1" />
                    Série
                  </>
                )}
              </Badge>
              {activity.rating && (
                <div className="flex items-center gap-0.5 text-xs text-amber-500">
                  <Star className="h-3 w-3 fill-current" />
                  <span>{activity.rating}/10</span>
                </div>
              )}
              <span className="text-xs text-muted-foreground">{timeAgo}</span>
            </div>
            {activity.comment && (
              <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 italic">
                "{activity.comment}"
              </p>
            )}
          </div>

          {/* Poster */}
          <img
            src={posterUrl}
            alt={title}
            className="w-12 h-18 rounded object-cover flex-shrink-0"
          />
        </div>
      </div>
    </div>
  );
}

import { useFriendActivities, FriendActivity } from "@/hooks/useFriendActivities";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Star, Film, Tv, Activity, Repeat, Heart, MessageCircle, Send, Trash2 } from "lucide-react";
import { resolveAvatarSrc } from "@/components/AvatarPickerDialog";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FormEvent, useState } from "react";
import { ContentDetailDialog } from "@/components/ContentDetailDialog";
import { Content } from "@/lib/mockData";
import { normalizeStoredContent } from "@/lib/contentNormalizer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ACTIVITY_COMMENT_LIMIT, ActivityComment, useActivityInteractions } from "@/hooks/useActivityInteractions";

const getActivityContent = (activity: FriendActivity): Content =>
  normalizeStoredContent(activity.production_data, {
    productionId: activity.production_id,
    productionType: activity.production_type,
  });

export function ActivityFeed() {
  const { activities, isLoading } = useFriendActivities();
  const interactions = useActivityInteractions(activities.map((activity) => activity.id));
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleActivityClick = (activity: FriendActivity) => {
    setSelectedContent(getActivityContent(activity));
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
            interactions={interactions}
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
  interactions,
}: {
  activity: FriendActivity;
  onClick: () => void;
  interactions: ReturnType<typeof useActivityInteractions>;
}) {
  const content = getActivityContent(activity);
  const title = content.title;
  const posterUrl = content.posterUrl;

  const isMovie = content.type === "movie";
  const timeAgo = formatDistanceToNow(new Date(activity.created_at), {
    addSuffix: true,
    locale: ptBR,
  });
  const { toast } = useToast();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comment, setComment] = useState("");
  const likes = interactions.likes.filter((like) => like.activity_id === activity.id);
  const comments = interactions.comments.filter((item) => item.activity_id === activity.id);
  const isLiked = likes.some((like) => like.user_id === interactions.userId);

  const handleLike = async () => {
    try {
      await interactions.toggleLike.mutateAsync(activity.id);
    } catch {
      toast({ title: "Não foi possível curtir", description: "Tente novamente em instantes.", variant: "destructive" });
    }
  };

  const handleComment = async (event: FormEvent) => {
    event.preventDefault();
    if (!comment.trim()) return;
    try {
      await interactions.addComment.mutateAsync({ activityId: activity.id, body: comment });
      setComment("");
    } catch {
      toast({ title: "Não foi possível comentar", description: "Confira o texto e tente novamente.", variant: "destructive" });
    }
  };

  return (
    <div className="p-3 bg-card rounded-lg border border-border hover:border-accent/50 transition-colors">
      <div className="flex gap-3 cursor-pointer" onClick={onClick}>
      {/* User Avatar */}
      <Avatar className="h-10 w-10 flex-shrink-0">
        <AvatarImage src={resolveAvatarSrc(activity.avatar_url)} alt={activity.username || ""} />
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
              <span className="text-muted-foreground">
                {activity.drawer_id === "watched" && activity.rewatch_count > 0
                  ? `reviu (${activity.rewatch_count + 1}ª vez) — adicionou na gavetta ${activity.drawer_label}`
                  : `adicionou na gavetta ${activity.drawer_label}`}
              </span>
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
              {activity.drawer_id === "watched" && activity.rewatch_count > 0 && (
                <Badge variant="outline" className="gap-1 text-xs px-1.5 py-0 border-accent/40 text-accent">
                  <Repeat className="h-3 w-3" />
                  {activity.rewatch_count + 1}x
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">{timeAgo}</span>
            </div>
            {activity.comment && (
              <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 italic">
                "{activity.comment}"
              </p>
            )}
          </div>

          {/* Poster (same size as ContentCard mini poster) */}
          <Avatar className="h-14 w-14 rounded-lg flex-shrink-0 bg-muted">
            <AvatarImage
              src={posterUrl}
              alt={title}
              className="object-cover"
              loading="lazy"
            />
            <AvatarFallback className="rounded-lg bg-muted">
              {isMovie ? <Film className="h-7 w-7 text-muted-foreground" /> : <Tv className="h-7 w-7 text-muted-foreground" />}
            </AvatarFallback>
          </Avatar>




        </div>
      </div>
      </div>

      <div className="ml-12 mt-2 flex items-center gap-1 border-t border-border/70 pt-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={isLiked ? "h-8 gap-1.5 text-destructive" : "h-8 gap-1.5 text-muted-foreground"}
          onClick={handleLike}
          disabled={interactions.toggleLike.isPending}
          aria-pressed={isLiked}
          aria-label={isLiked ? "Descurtir atividade" : "Curtir atividade"}
        >
          <Heart className={isLiked ? "h-4 w-4 fill-current" : "h-4 w-4"} />
          {likes.length > 0 && <span>{likes.length}</span>}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-muted-foreground"
          onClick={() => setCommentsOpen((open) => !open)}
          aria-expanded={commentsOpen}
        >
          <MessageCircle className="h-4 w-4" />
          <span>{comments.length || "Comentar"}</span>
        </Button>
      </div>

      {commentsOpen && (
        <div className="ml-12 mt-2 space-y-3 border-t border-border/70 pt-3">
          {comments.map((item) => (
            <CommentRow
              key={item.id}
              comment={item}
              canDelete={item.user_id === interactions.userId}
              onDelete={() => interactions.deleteComment.mutate(item.id)}
            />
          ))}
          <form onSubmit={handleComment} className="space-y-2">
            <Textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={ACTIVITY_COMMENT_LIMIT}
              placeholder="Escreva um comentário…"
              className="min-h-[72px] resize-none"
              aria-label="Comentário"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground" aria-live="polite">
                {comment.length}/{ACTIVITY_COMMENT_LIMIT}
              </span>
              <Button
                type="submit"
                size="sm"
                className="h-8 gap-1.5"
                disabled={!comment.trim() || interactions.addComment.isPending}
              >
                {interactions.addComment.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Enviar
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function CommentRow({
  comment,
  canDelete,
  onDelete,
}: {
  comment: ActivityComment;
  canDelete: boolean;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-start gap-2">
      <Avatar className="h-7 w-7 flex-shrink-0">
        <AvatarImage src={resolveAvatarSrc(comment.avatar_url)} alt={comment.username || ""} />
        <AvatarFallback className="bg-primary/10 text-[10px] text-primary">
          {comment.username?.slice(0, 2).toUpperCase() || "??"}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 rounded-md bg-muted/60 px-2.5 py-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold">{comment.username || "Usuário"}</p>
          {canDelete && (
            <Button type="button" variant="ghost" size="icon" className="-mr-1 -mt-1 h-6 w-6" onClick={onDelete} aria-label="Excluir comentário">
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
        <p className="whitespace-pre-wrap break-words text-xs text-foreground">{comment.body}</p>
      </div>
    </div>
  );
}

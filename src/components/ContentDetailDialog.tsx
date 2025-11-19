import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Film, Tv, Calendar, Star, Share2, MessageCircle } from "lucide-react";
import { Content } from "@/lib/mockData";
import { cn } from "@/lib/utils";
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
  movie: <Film className="h-3.5 w-3.5" />,
  series: <Tv className="h-3.5 w-3.5" />,
};

export function ContentDetailDialog({ content, open, onOpenChange }: ContentDetailDialogProps) {
  const [isInDrawer, setIsInDrawer] = useState(content?.isInDrawer || false);
  const [userRating, setUserRating] = useState(0);
  const [userStatus, setUserStatus] = useState("");
  const [comment, setComment] = useState("");

  if (!content) return null;

  const handleAddToDrawer = () => {
    setIsInDrawer(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <div className="relative">
          {/* Botão Gaveta - FIXADO no Canto Superior Direito */}
          <div className="absolute top-4 right-4 z-50">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "rounded-full shadow-lg",
                isInDrawer 
                  ? "bg-gradient-to-br from-[#4ADE80] via-[#3B82F6] to-[#FBBF24]" 
                  : "bg-card/90 backdrop-blur-sm border-2 border-border"
              )}
              onClick={handleAddToDrawer}
            >
              <img
                src={gavetaIcon}
                alt="Gaveta"
                className={cn(
                  "h-5 w-5",
                  isInDrawer ? "brightness-0 invert" : "opacity-40"
                )}
              />
            </Button>
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

            {/* Status do Usuário */}
            <div className="space-y-4">
              <Label className="text-sm font-semibold">Status</Label>
              <Select value={userStatus} onValueChange={setUserStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="to-watch">Para Assistir</SelectItem>
                  <SelectItem value="watching">Assistindo</SelectItem>
                  <SelectItem value="watched">Assistido</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Avaliação (só se assistido) */}
            {userStatus === "watched" && (
              <div className="space-y-4">
                <Label className="text-sm font-semibold">Sua Nota (0-10)</Label>
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
              </div>
            )}

            {/* Comentário (quando na gaveta) */}
            {isInDrawer && (
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
              <Button variant="outline" className="flex-1 gap-2">
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
      </DialogContent>
    </Dialog>
  );
}

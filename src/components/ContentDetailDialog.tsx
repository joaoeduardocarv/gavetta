import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Film, Tv, Calendar, Star, Share2, MessageCircle, FolderOpen, Check } from "lucide-react";
import { Content } from "@/lib/mockData";
import { cn } from "@/lib/utils";

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
  const [selectedDrawer, setSelectedDrawer] = useState<string | null>(null);
  const [userRating, setUserRating] = useState(0);
  const [userStatus, setUserStatus] = useState("");
  const [comment, setComment] = useState("");

  if (!content) return null;

  // Gavetas disponíveis (podem vir de props ou contexto no futuro)
  const availableDrawers = [
    { id: 'assistindo', name: 'Assistindo', icon: '👀' },
    { id: 'para-assistir', name: 'Para Assistir', icon: '📌' },
    { id: 'assistido', name: 'Assistido', icon: '✓' },
  ];

  const handleSelectDrawer = (drawerId: string) => {
    setSelectedDrawer(drawerId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <div className="relative">
          {/* Botão Adicionar à Gavetta - FIXADO no Canto Superior Direito */}
          <div className="absolute top-4 right-4 z-50">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={selectedDrawer ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "shadow-lg gap-2",
                    selectedDrawer && "bg-gradient-to-r from-primary to-primary/80"
                  )}
                >
                  <FolderOpen className="h-4 w-4" />
                  {selectedDrawer ? availableDrawers.find(d => d.id === selectedDrawer)?.name : 'Adicionar à Gavetta'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {availableDrawers.map((drawer) => (
                  <DropdownMenuItem
                    key={drawer.id}
                    onClick={() => handleSelectDrawer(drawer.id)}
                    className="cursor-pointer"
                  >
                    <span className="mr-2">{drawer.icon}</span>
                    <span className="flex-1">{drawer.name}</span>
                    {selectedDrawer === drawer.id && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </DropdownMenuItem>
                ))}
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
            {selectedDrawer && (
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

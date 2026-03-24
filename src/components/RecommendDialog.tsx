import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, Send, Check, Loader2 } from "lucide-react";
import { Content } from "@/lib/mockData";
import { useToast } from "@/hooks/use-toast";
import { useFriendships, FriendProfile } from "@/hooks/useFriendships";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface RecommendDialogProps {
  content: Content | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RecommendDialog({ content, open, onOpenChange }: RecommendDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { friends, friendsLoading } = useFriendships();
  const [selectedFriend, setSelectedFriend] = useState<FriendProfile | null>(null);
  const [comment, setComment] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sending, setSending] = useState(false);

  const filteredFriends = friends.filter(
    (friend) =>
      (friend.username || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleBack = () => {
    setSelectedFriend(null);
    setComment("");
  };

  const handleSendRecommendation = async () => {
    if (!selectedFriend || !content || !user?.id) return;

    setSending(true);
    try {
      // Build production_data from content
      const productionData = {
        id: content.id,
        title: content.title,
        poster_path: content.posterUrl?.includes("image.tmdb.org")
          ? content.posterUrl.replace("https://image.tmdb.org/t/p/w500", "")
          : content.posterUrl,
        media_type: content.type === "movie" ? "movie" : "tv",
        release_date: content.releaseDate,
      };

      // Insert recommendation
      const { error: recError } = await supabase.from("recommendations").insert({
        sender_id: user.id,
        receiver_id: selectedFriend.id,
        production_id: content.id,
        production_type: content.type === "movie" ? "movie" : "tv",
        production_data: productionData,
        comment: comment.trim() || null,
      });

      if (recError) throw recError;

      // Get sender profile for notification message
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .maybeSingle();

      // Send notification
      await supabase.from("notifications").insert({
        user_id: selectedFriend.id,
        type: "recommendation",
        title: "Nova indicação!",
        message: `${profile?.username || "Alguém"} indicou "${content.title}" para você${comment.trim() ? `: "${comment.trim()}"` : ""}`,
        related_user_id: user.id,
        related_content_id: String(content.tmdbId || content.id),
      });

      toast({
        title: "Indicação enviada!",
        description: `Você indicou "${content.title}" para ${selectedFriend.username || "seu amigo"}.`,
      });

      // Reset and close
      setSelectedFriend(null);
      setComment("");
      setSearchQuery("");
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro ao enviar indicação",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setSelectedFriend(null);
      setComment("");
      setSearchQuery("");
    }
    onOpenChange(isOpen);
  };

  if (!content) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {selectedFriend && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 -ml-2"
                onClick={handleBack}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {selectedFriend ? `Indicar para ${selectedFriend.username || "amigo"}` : "Indicar para um amigo"}
          </DialogTitle>
        </DialogHeader>

        {/* Conteúdo sendo indicado */}
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
          <Avatar className="h-12 w-16 rounded-md">
            <AvatarImage src={content.posterUrl} alt={content.title} className="object-cover" />
            <AvatarFallback className="rounded-md">{content.title[0]}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm line-clamp-1">{content.title}</p>
            <p className="text-xs text-muted-foreground">
              {content.type === "movie" ? "Filme" : "Série"} • {new Date(content.releaseDate).getFullYear()}
            </p>
          </div>
        </div>

        {!selectedFriend ? (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar amigo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {friendsLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredFriends.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {friends.length === 0
                    ? "Você ainda não tem amigos adicionados"
                    : "Nenhum amigo encontrado"}
                </p>
              ) : (
                filteredFriends.map((friend) => (
                  <button
                    key={friend.id}
                    onClick={() => setSelectedFriend(friend)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent/10 transition-colors text-left"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={friend.avatar_url || ""} alt={friend.username || ""} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {(friend.username || "?").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{friend.username || "Usuário"}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
              <Avatar className="h-10 w-10">
                <AvatarImage src={selectedFriend.avatar_url || ""} alt={selectedFriend.username || ""} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {(selectedFriend.username || "?").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-medium text-sm">{selectedFriend.username || "Usuário"}</p>
              </div>
              <Check className="h-5 w-5 text-primary" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Comentário (opcional)</label>
              <Textarea
                placeholder="Escreva um comentário sobre por que está indicando..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Seu amigo verá este comentário junto com a indicação
              </p>
            </div>

            <Button className="w-full gap-2" onClick={handleSendRecommendation} disabled={sending}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar Indicação
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

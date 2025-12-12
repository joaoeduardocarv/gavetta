import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, Send, Check } from "lucide-react";
import { Content } from "@/lib/mockData";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Friend {
  id: number;
  name: string;
  username: string;
  avatar: string;
}

interface RecommendDialogProps {
  content: Content | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Mock friends - em produção viria do backend
const mockFriends: Friend[] = [
  { id: 1, name: "Ana Silva", username: "@anasilva", avatar: "" },
  { id: 2, name: "João Santos", username: "@joaosantos", avatar: "" },
  { id: 3, name: "Maria Costa", username: "@mariacosta", avatar: "" },
  { id: 4, name: "Pedro Lima", username: "@pedrolima", avatar: "" },
  { id: 5, name: "Carla Souza", username: "@carlasouza", avatar: "" },
];

export function RecommendDialog({ content, open, onOpenChange }: RecommendDialogProps) {
  const { toast } = useToast();
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [comment, setComment] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredFriends = mockFriends.filter(
    (friend) =>
      friend.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      friend.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectFriend = (friend: Friend) => {
    setSelectedFriend(friend);
  };

  const handleBack = () => {
    setSelectedFriend(null);
    setComment("");
  };

  const handleSendRecommendation = () => {
    if (!selectedFriend || !content) return;

    // Aqui seria a lógica para enviar a indicação ao backend
    toast({
      title: "Indicação enviada!",
      description: `Você indicou "${content.title}" para ${selectedFriend.name}.`,
    });

    // Reset e fechar
    setSelectedFriend(null);
    setComment("");
    setSearchQuery("");
    onOpenChange(false);
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
            {selectedFriend ? `Indicar para ${selectedFriend.name}` : "Indicar para um amigo"}
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
          /* Lista de amigos */
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
              {filteredFriends.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum amigo encontrado
                </p>
              ) : (
                filteredFriends.map((friend) => (
                  <button
                    key={friend.id}
                    onClick={() => handleSelectFriend(friend)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent/10 transition-colors text-left"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={friend.avatar} alt={friend.name} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {friend.name.split(" ").map((n) => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{friend.name}</p>
                      <p className="text-xs text-muted-foreground">{friend.username}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          /* Tela de comentário */
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
              <Avatar className="h-10 w-10">
                <AvatarImage src={selectedFriend.avatar} alt={selectedFriend.name} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {selectedFriend.name.split(" ").map((n) => n[0]).join("")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-medium text-sm">{selectedFriend.name}</p>
                <p className="text-xs text-muted-foreground">{selectedFriend.username}</p>
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

            <Button className="w-full gap-2" onClick={handleSendRecommendation}>
              <Send className="h-4 w-4" />
              Enviar Indicação
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

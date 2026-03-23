import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Play, Eye, CheckCircle, Star, Heart, Bookmark, Clock, Sparkles, Users, Send, Loader2, Check } from "lucide-react";
import { useDrawers } from "@/contexts/DrawerContext";
import { useFriendships, FriendProfile } from "@/hooks/useFriendships";

interface CreateDrawerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateDrawer: (drawer: { name: string; icon: string; color: string; contentIds: string[]; sharedWithFriends?: string[] }) => void;
}

const iconOptions = [
  { value: "Play", icon: Play, label: "Play" },
  { value: "Eye", icon: Eye, label: "Olho" },
  { value: "CheckCircle", icon: CheckCircle, label: "Check" },
  { value: "Star", icon: Star, label: "Estrela" },
  { value: "Heart", icon: Heart, label: "Coração" },
  { value: "Bookmark", icon: Bookmark, label: "Bookmark" },
  { value: "Clock", icon: Clock, label: "Relógio" },
  { value: "Sparkles", icon: Sparkles, label: "Brilho" },
];

const colorOptions = [
  { value: "text-blue-500", label: "Azul" },
  { value: "text-yellow-500", label: "Amarelo" },
  { value: "text-green-500", label: "Verde" },
  { value: "text-purple-500", label: "Roxo" },
  { value: "text-red-500", label: "Vermelho" },
  { value: "text-pink-500", label: "Rosa" },
  { value: "text-orange-500", label: "Laranja" },
  { value: "text-cyan-500", label: "Ciano" },
];

export function CreateDrawerDialog({ open, onOpenChange, onCreateDrawer }: CreateDrawerDialogProps) {
  const { addToCustomDrawer } = useDrawers();
  const { friends, friendsLoading } = useFriendships();
  const [drawerName, setDrawerName] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("Star");
  const [selectedColor, setSelectedColor] = useState("text-purple-500");
  const [isShared, setIsShared] = useState(false);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);

  const toggleFriend = (friendId: string) => {
    setSelectedFriends((prev) =>
      prev.includes(friendId)
        ? prev.filter((id) => id !== friendId)
        : [...prev, friendId]
    );
  };

  const handleCreate = () => {
    if (drawerName.trim()) {
      onCreateDrawer({
        name: drawerName,
        icon: selectedIcon,
        color: selectedColor,
        contentIds: [],
        sharedWithFriends: isShared ? selectedFriends : undefined,
      });
      
      setDrawerName("");
      setSelectedIcon("Star");
      setSelectedColor("text-purple-500");
      setIsShared(false);
      setSelectedFriends([]);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">Criar Nova Gavetta</DialogTitle>
          <DialogDescription>
            Configure sua gaveta personalizada com nome e ícone
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 flex-1 overflow-y-auto px-1">
          {/* Nome da Gaveta */}
          <div className="space-y-2">
            <Label htmlFor="drawer-name" className="text-sm font-semibold">
              Nome da Gavetta
            </Label>
            <Input
              id="drawer-name"
              placeholder="Ex: Meus Favoritos"
              value={drawerName}
              onChange={(e) => setDrawerName(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Seleção de Ícone */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Escolha um Ícone</Label>
            <div className="grid grid-cols-4 gap-2">
              {iconOptions.map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  onClick={() => setSelectedIcon(value)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                    selectedIcon === value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <Icon className="h-6 w-6" />
                  <span className="text-xs">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Seleção de Cor */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Escolha uma Cor</Label>
            <div className="grid grid-cols-4 gap-2">
              {colorOptions.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setSelectedColor(value)}
                  className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                    selectedColor === value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className={`h-4 w-4 rounded-full ${value.replace('text-', 'bg-')}`} />
                  <span className="text-xs">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Compartilhar */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-primary" />
                <div>
                  <Label className="text-sm font-medium">Gaveta Compartilhada</Label>
                  <p className="text-xs text-muted-foreground">
                    Convide amigos para colaborar nesta gaveta
                  </p>
                </div>
              </div>
              <Switch
                checked={isShared}
                onCheckedChange={(checked) => {
                  setIsShared(checked);
                  if (!checked) setSelectedFriends([]);
                }}
              />
            </div>

            {isShared && (
              <div className="space-y-2">
                {friendsLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : friends.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Você ainda não tem amigos adicionados.
                  </p>
                ) : (
                  <ScrollArea className="max-h-[180px]">
                    <div className="space-y-2">
                      {friends.map((friend) => {
                        const isSelected = selectedFriends.includes(friend.id);
                        return (
                          <button
                            key={friend.id}
                            onClick={() => toggleFriend(friend.id)}
                            className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                              isSelected
                                ? "border-primary bg-primary/5"
                                : "border-border hover:bg-accent/5"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={friend.avatar_url || undefined} />
                                <AvatarFallback>{friend.username?.[0]?.toUpperCase() || "?"}</AvatarFallback>
                              </Avatar>
                              <span className="font-medium text-sm">{friend.username || "Usuário"}</span>
                            </div>
                            {isSelected && <Check className="h-4 w-4 text-primary" />}
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={!drawerName.trim()} className="flex-1">
            Criar Gavetta
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

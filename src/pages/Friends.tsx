import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, UserPlus, Film } from "lucide-react";

// Mock de amigos
const mockFriends = [
  {
    id: 1,
    name: "Ana Silva",
    username: "@anasilva",
    avatar: "",
    recentActivity: "Assistiu Duna: Parte Dois",
    mutualDrawers: 12,
  },
  {
    id: 2,
    name: "João Santos",
    username: "@joaosantos",
    avatar: "",
    recentActivity: "Adicionou Breaking Bad à gaveta",
    mutualDrawers: 8,
  },
  {
    id: 3,
    name: "Maria Costa",
    username: "@mariacosta",
    avatar: "",
    recentActivity: "Avaliou Parasita com 10 estrelas",
    mutualDrawers: 15,
  },
];

export default function Friends() {
  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      
      <main className="container mx-auto px-4 py-6 max-w-lg">
        <div className="mb-6">
          <h2 className="font-heading text-3xl font-bold text-foreground mb-1">
            Meus Amigos
          </h2>
          <p className="text-sm text-muted-foreground">
            Conecte-se e descubra novas indicações
          </p>
        </div>

        {/* Busca de amigos */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar amigos..." 
              className="pl-10"
            />
          </div>
        </div>

        {/* Botão adicionar amigos */}
        <Button className="w-full mb-6" variant="outline">
          <UserPlus className="h-4 w-4 mr-2" />
          Adicionar Amigos
        </Button>

        {/* Lista de amigos */}
        <div className="space-y-3">
          <h3 className="font-heading text-lg font-semibold text-foreground mb-3">
            Seus Amigos ({mockFriends.length})
          </h3>
          
          {mockFriends.map((friend) => (
            <div
              key={friend.id}
              className="flex items-center gap-3 p-4 bg-card rounded-lg border border-border hover:bg-accent/5 hover:border-accent/50 transition-all duration-200 cursor-pointer"
            >
              <Avatar className="h-12 w-12 flex-shrink-0">
                <AvatarImage src={friend.avatar} alt={friend.name} />
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {friend.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-heading font-bold text-foreground text-sm">
                    {friend.name}
                  </h4>
                  <span className="text-xs text-muted-foreground">
                    {friend.username}
                  </span>
                </div>
                
                <p className="text-xs text-muted-foreground line-clamp-1 mb-1.5">
                  {friend.recentActivity}
                </p>
                
                <Badge variant="secondary" className="text-xs">
                  <Film className="h-3 w-3 mr-1" />
                  {friend.mutualDrawers} gavettas em comum
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

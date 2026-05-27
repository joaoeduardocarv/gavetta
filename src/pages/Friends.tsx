import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Search, UserPlus, Users, Loader2, UserX, Activity, Gift, Clock, X } from "lucide-react";
import { ContentDetailDialog } from "@/components/ContentDetailDialog";
import { Content } from "@/lib/mockData";
import { useFriendships, FriendProfile } from "@/hooks/useFriendships";
import { AddFriendDialog } from "@/components/AddFriendDialog";
import { FriendRequestsCard } from "@/components/FriendRequestsCard";
import { ActivityFeed } from "@/components/ActivityFeed";
import { resolveAvatarSrc } from "@/components/AvatarPickerDialog";

export default function Friends() {
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
  const [addFriendInitialQuery, setAddFriendInitialQuery] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const { friends, friendsLoading, removeFriend, sentRequests, cancelSentRequest } = useFriendships();

  // Pré-aquece o cache do navegador com os avatares dos amigos assim que
  // a lista é resolvida, para que apareçam instantâneos nos cards.
  useEffect(() => {
    friends.forEach((f) => {
      const src = resolveAvatarSrc(f.avatar_url);
      if (src) {
        const img = new Image();
        img.decoding = "async";
        img.src = src;
      }
    });
  }, [friends]);

  const handleContentChange = (newContent: Content) => {
    setSelectedContent(newContent);
    setIsDialogOpen(true);
  };

  const filteredFriends = friends.filter((friend) =>
    friend.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      <Helmet>
        <title>Meus Amigos · Gavetta</title>
        <meta name="description" content="Conecte-se com amigos cinéfilos, veja o que estão assistindo e troque indicações de filmes e séries." />
        <link rel="canonical" href="https://gavetta.com.br/friends" />
        <meta property="og:title" content="Meus Amigos · Gavetta" />
        <meta property="og:description" content="Sua tribo cinéfila no Gavetta." />
        <meta property="og:url" content="https://gavetta.com.br/friends" />
        <meta name="robots" content="noindex" />
      </Helmet>
      <Header />
      
      <main className="container mx-auto px-4 py-6 max-w-lg">
        <div className="mb-6">
          <h1 className="font-heading text-3xl font-bold text-foreground mb-1">
            Meus Amigos
          </h1>
          <p className="text-sm text-muted-foreground">
            Conecte-se e descubra novas indicações
          </p>
        </div>

        <Tabs defaultValue="activities" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="activities" className="text-xs sm:text-sm">
              <Activity className="h-4 w-4 mr-1 hidden sm:inline" />
              Atividades
            </TabsTrigger>
            <TabsTrigger value="recommendations" className="text-xs sm:text-sm">
              <Gift className="h-4 w-4 mr-1 hidden sm:inline" />
              Indicações
            </TabsTrigger>
            <TabsTrigger value="friends" className="text-xs sm:text-sm">
              <Users className="h-4 w-4 mr-1 hidden sm:inline" />
              Amigos
            </TabsTrigger>
          </TabsList>

          {/* Feed de Atividades */}
          <TabsContent value="activities" className="space-y-4">
            <ActivityFeed />
          </TabsContent>

          {/* Lista de Amigos */}
          <TabsContent value="friends" className="space-y-4">
            {/* Pedidos pendentes */}
            <FriendRequestsCard />

            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar amigos..." 
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              
              <Button 
                className="w-full" 
                variant="outline"
                onClick={() => setIsAddFriendOpen(true)}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Adicionar Amigos
              </Button>
            </div>

            {sentRequests.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-heading text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Aguardando resposta ({sentRequests.length})
                </h3>
                {sentRequests.map((req) => (
                  <div
                    key={req.friendship_id}
                    className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border/50"
                  >
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <AvatarImage src={resolveAvatarSrc(req.avatar_url)} alt={req.username || ""} />
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                        {req.username?.slice(0, 2).toUpperCase() || "??"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {req.username || "Usuário"}
                      </p>
                      <p className="text-xs text-muted-foreground">Pedido pendente</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => cancelSentRequest.mutate(req.friendship_id)}
                      disabled={cancelSentRequest.isPending}
                      title="Cancelar pedido"
                      aria-label={`Cancelar pedido para ${req.username || "usuário"}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <h3 className="font-heading text-lg font-semibold text-foreground">
              Seus Amigos ({friends.length})
            </h3>


            {friendsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : friends.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h4 className="font-medium mb-2">Nenhum amigo ainda</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Adicione amigos para compartilhar suas gavettas!
                  </p>
                  <Button onClick={() => setIsAddFriendOpen(true)}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Buscar Amigos
                  </Button>
                </CardContent>
              </Card>
            ) : filteredFriends.length === 0 ? (
              <div className="flex flex-col items-center text-center py-8 gap-3">
                <p className="text-sm text-muted-foreground">
                  Nenhum amigo encontrado com "{searchQuery}"
                </p>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    setAddFriendInitialQuery(searchQuery);
                    setIsAddFriendOpen(true);
                  }}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Buscar "{searchQuery}" em todos os usuários
                </Button>
              </div>
            ) : (
              filteredFriends.map((friend) => (
                <FriendCard
                  key={friend.id}
                  friend={friend}
                  onRemove={() => removeFriend.mutate(friend.friendship_id)}
                  isRemoving={removeFriend.isPending}
                />
              ))
            )}
          </TabsContent>

          {/* Indicações - será implementado com dados reais futuramente */}
          <TabsContent value="recommendations" className="space-y-4">
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h4 className="font-medium mb-2">Nenhuma indicação ainda</h4>
                <p className="text-sm text-muted-foreground">
                  Quando seus amigos indicarem filmes e séries, eles aparecerão aqui.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <BottomNav />
      
      {selectedContent && (
        <ContentDetailDialog
          content={selectedContent}
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          onContentChange={handleContentChange}
        />
      )}

      <AddFriendDialog
        open={isAddFriendOpen}
        onOpenChange={setIsAddFriendOpen}
      />
    </div>
  );
}

function FriendCard({
  friend,
  onRemove,
  isRemoving,
}: {
  friend: FriendProfile;
  onRemove: () => void;
  isRemoving: boolean;
}) {
  return (
    <div className="flex items-center gap-3 p-4 bg-card rounded-lg border border-border hover:bg-accent/5 hover:border-accent/50 transition-all duration-200">
      <Avatar className="h-12 w-12 flex-shrink-0">
        <AvatarImage src={resolveAvatarSrc(friend.avatar_url)} alt={friend.username || ""} />
        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
          {friend.username?.slice(0, 2).toUpperCase() || "??"}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <h4 className="font-heading font-bold text-foreground text-sm">
          {friend.username || "Usuário sem nome"}
        </h4>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-destructive"
        onClick={onRemove}
        disabled={isRemoving}
        title="Remover amigo"
        aria-label={`Remover ${friend.username || "amigo"} da lista`}
      >
        {isRemoving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <UserX className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}

import { useState } from "react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Search, UserPlus, Users, Loader2, UserX, Activity, Gift } from "lucide-react";
import { ContentDetailDialog } from "@/components/ContentDetailDialog";
import { Content } from "@/lib/mockData";
import { useFriendships, FriendProfile } from "@/hooks/useFriendships";
import { AddFriendDialog } from "@/components/AddFriendDialog";
import { FriendRequestsCard } from "@/components/FriendRequestsCard";
import { ActivityFeed } from "@/components/ActivityFeed";

export default function Friends() {
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { friends, friendsLoading, removeFriend } = useFriendships();

  const handleContentChange = (newContent: Content) => {
    setSelectedContent(newContent);
    setIsDialogOpen(true);
  };

  const filteredFriends = friends.filter((friend) =>
    friend.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum amigo encontrado com "{searchQuery}"
              </p>
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
        <AvatarImage src={friend.avatar_url || ""} alt={friend.username || ""} />
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

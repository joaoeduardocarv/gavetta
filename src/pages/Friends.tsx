import { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Search, UserPlus, Users, Loader2, UserX, Activity, Gift, X, Check } from "lucide-react";
import { ContentDetailDialog } from "@/components/ContentDetailDialog";
import { Content } from "@/lib/mockData";
import { useFriendships, FriendProfile } from "@/hooks/useFriendships";
import { FriendRequestsCard } from "@/components/FriendRequestsCard";
import { SentRequestsCard } from "@/components/SentRequestsCard";
import { ActivityFeed } from "@/components/ActivityFeed";
import { resolveAvatarSrc } from "@/components/AvatarPickerDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface UserResult {
  id: string;
  username: string | null;
  avatar_url: string | null;
  handle: string | null;
}

export default function Friends() {
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { friends, friendsLoading, removeFriend, sentRequests, sendRequest, pendingRequests } = useFriendships();
  const { user } = useAuth();
  const { toast } = useToast();

  const [globalResults, setGlobalResults] = useState<UserResult[]>([]);
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);
  const [hasSearchedGlobal, setHasSearchedGlobal] = useState(false);
  const [sentNow, setSentNow] = useState<Set<string>>(new Set());
  const requestId = useRef(0);

  const friendIds = useMemo(() => new Set(friends.map((f) => f.id)), [friends]);
  const pendingIds = useMemo(
    () => new Set((sentRequests || []).map((f) => f.id)),
    [sentRequests]
  );

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

  const trimmed = searchQuery.trim().replace(/^@/, "");
  const isSearching = trimmed.length >= 2;

  const filteredFriends = useMemo(
    () =>
      friends.filter((friend) => {
        if (!trimmed) return true;
        const q = trimmed.toLowerCase();
        return friend.username?.toLowerCase().includes(q);
      }),
    [friends, trimmed]
  );

  // Debounced global search
  useEffect(() => {
    if (!isSearching) {
      setGlobalResults([]);
      setHasSearchedGlobal(false);
      setIsSearchingGlobal(false);
      return;
    }

    setIsSearchingGlobal(true);
    const reqId = ++requestId.current;
    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase.rpc("search_profiles_by_handle", {
          _query: trimmed.toLowerCase(),
        });
        if (reqId !== requestId.current) return;
        if (error) throw error;
        const filtered = (data || []).filter((u: UserResult) => u.id !== user?.id);
        setGlobalResults(filtered);
        setHasSearchedGlobal(true);
      } catch (error: any) {
        if (reqId !== requestId.current) return;
        toast({ title: "Erro na busca", description: error.message, variant: "destructive" });
      } finally {
        if (reqId === requestId.current) setIsSearchingGlobal(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [trimmed, isSearching, user?.id, toast]);

  // Non-friend results from global search
  const newUserResults = useMemo(
    () => globalResults.filter((u) => !friendIds.has(u.id)),
    [globalResults, friendIds]
  );

  const handleContentChange = (newContent: Content) => {
    setSelectedContent(newContent);
    setIsDialogOpen(true);
  };

  const handleSendRequest = async (userId: string) => {
    setSentNow((prev) => new Set(prev).add(userId));
    try {
      await sendRequest.mutateAsync(userId);
    } catch {
      setSentNow((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

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
            <TabsTrigger value="friends" className="text-xs sm:text-sm relative">
              <Users className="h-4 w-4 mr-1 hidden sm:inline" />
              Amigos
              {pendingRequests.length > 0 && (
                <span
                  className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground animate-pulse"
                  aria-label={`${pendingRequests.length} pedido(s) de amizade pendente(s)`}
                >
                  {pendingRequests.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="activities" className="space-y-4">
            {pendingRequests.length > 0 && <FriendRequestsCard />}
            <ActivityFeed />
          </TabsContent>

          <TabsContent value="friends" className="space-y-4">
            <FriendRequestsCard />

            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar amigos ou @usuário para adicionar"
                className="pl-10 pr-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoComplete="off"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  aria-label="Limpar busca"
                >
                  {isSearchingGlobal ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                </button>
              )}
            </div>

            <SentRequestsCard />

            {/* Resultados globais (não-amigos) ao buscar */}
            {isSearching && (
              <div className="space-y-2">
                <h3 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Adicionar novos amigos
                </h3>

                {isSearchingGlobal && newUserResults.length === 0 && (
                  <div className="space-y-2">
                    {[0, 1].map((i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-lg border bg-card animate-pulse">
                        <div className="h-10 w-10 rounded-full bg-muted" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 w-24 bg-muted rounded" />
                          <div className="h-2.5 w-16 bg-muted rounded" />
                        </div>
                        <div className="h-8 w-8 bg-muted rounded-md" />
                      </div>
                    ))}
                  </div>
                )}

                {!isSearchingGlobal && hasSearchedGlobal && newUserResults.length === 0 && filteredFriends.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum usuário encontrado para "{trimmed}"
                  </p>
                )}

                {newUserResults.map((resultUser) => {
                  const isPending = pendingIds.has(resultUser.id) || sentNow.has(resultUser.id);
                  return (
                    <div
                      key={resultUser.id}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={resolveAvatarSrc(resultUser.avatar_url)} alt={resultUser.username || ""} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                          {resultUser.username?.slice(0, 2).toUpperCase() || "??"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {resultUser.username || "Usuário sem nome"}
                        </p>
                        {resultUser.handle && (
                          <p className="text-xs text-muted-foreground truncate">@{resultUser.handle}</p>
                        )}
                      </div>
                      {isPending ? (
                        <Badge variant="secondary" className="gap-1">
                          <Check className="h-3 w-3" />
                          Enviado
                        </Badge>
                      ) : (
                        <Button
                          size="icon"
                          variant="default"
                          className="h-9 w-9"
                          disabled={sendRequest.isPending}
                          onClick={() => handleSendRequest(resultUser.id)}
                          aria-label={`Adicionar ${resultUser.username || "usuário"}`}
                          title="Adicionar amigo"
                        >
                          <UserPlus className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  );
                })}
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
                  <p className="text-sm text-muted-foreground">
                    Use a busca acima para encontrar e adicionar amigos.
                  </p>
                </CardContent>
              </Card>
            ) : filteredFriends.length === 0 && isSearching ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum amigo seu corresponde a "{trimmed}"
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

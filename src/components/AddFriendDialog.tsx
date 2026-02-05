import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, UserPlus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFriendships } from "@/hooks/useFriendships";
import { useToast } from "@/hooks/use-toast";

interface UserResult {
  id: string;
  username: string | null;
  avatar_url: string | null;
}

interface AddFriendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddFriendDialog({ open, onOpenChange }: AddFriendDialogProps) {
  const { user } = useAuth();
  const { friends, sendRequest } = useFriendships();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());

  const handleSearch = async () => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      toast({
        title: "Busca inválida",
        description: "Digite pelo menos 2 caracteres para buscar.",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .ilike("username", `%${searchQuery}%`)
        .neq("id", user?.id)
        .limit(10);

      if (error) throw error;

      // Filter out existing friends
      const friendIds = new Set(friends.map((f) => f.id));
      const filteredResults = (data || []).filter((u) => !friendIds.has(u.id));
      
      setResults(filteredResults);

      if (filteredResults.length === 0) {
        toast({
          title: "Nenhum usuário encontrado",
          description: "Tente buscar com outro nome de usuário.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro na busca",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendRequest = async (userId: string) => {
    await sendRequest.mutateAsync(userId);
    setSentRequests((prev) => new Set(prev).add(userId));
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setSearchQuery("");
      setResults([]);
      setSentRequests(new Set());
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Amigo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch} disabled={isSearching}>
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Buscar"
              )}
            </Button>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {results.length === 0 && !isSearching && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Busque por username para encontrar amigos
              </p>
            )}

            {results.map((resultUser) => {
              const alreadySent = sentRequests.has(resultUser.id);
              
              return (
                <div
                  key={resultUser.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={resultUser.avatar_url || ""} alt={resultUser.username || ""} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {resultUser.username?.slice(0, 2).toUpperCase() || "??"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">
                      {resultUser.username || "Usuário sem nome"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={alreadySent ? "secondary" : "default"}
                    disabled={alreadySent || sendRequest.isPending}
                    onClick={() => handleSendRequest(resultUser.id)}
                  >
                    {alreadySent ? (
                      "Enviado"
                    ) : sendRequest.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4 mr-1" />
                        Adicionar
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

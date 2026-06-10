import { useState, useEffect, useRef, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, UserPlus, Loader2, X, Check, Users, AtSign } from "lucide-react";
import { resolveAvatarSrc } from "@/components/AvatarPickerDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFriendships } from "@/hooks/useFriendships";
import { useToast } from "@/hooks/use-toast";

interface UserResult {
  id: string;
  username: string | null;
  avatar_url: string | null;
  handle: string | null;
}

interface AddFriendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialQuery?: string;
}

export function AddFriendDialog({ open, onOpenChange, initialQuery }: AddFriendDialogProps) {
  const { user } = useAuth();
  const { friends, sentRequests, sendRequest } = useFriendships();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [sentNow, setSentNow] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);

  const friendIds = useMemo(() => new Set(friends.map((f) => f.id)), [friends]);
  const pendingIds = useMemo(
    () => new Set((sentRequests || []).map((f) => f.id)),
    [sentRequests]
  );

  // Initial query injection
  useEffect(() => {
    if (open && initialQuery) {
      setSearchQuery(initialQuery.replace(/^@/, "").trim());
    }
  }, [open, initialQuery]);

  // Autofocus input on open
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Debounced auto-search
  useEffect(() => {
    const q = searchQuery.replace(/^@/, "").trim().toLowerCase();
    if (!open) return;
    if (q.length < 2) {
      setResults([]);
      setHasSearched(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const reqId = ++requestId.current;
    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase.rpc("search_profiles_by_handle", {
          _query: q,
        });
        if (reqId !== requestId.current) return; // stale
        if (error) throw error;
        const filtered = (data || []).filter((u: UserResult) => u.id !== user?.id);
        setResults(filtered);
        setHasSearched(true);
      } catch (error: any) {
        if (reqId !== requestId.current) return;
        toast({ title: "Erro na busca", description: error.message, variant: "destructive" });
      } finally {
        if (reqId === requestId.current) setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, open, user?.id, toast]);

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

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setSearchQuery("");
      setResults([]);
      setSentNow(new Set());
      setHasSearched(false);
    }
    onOpenChange(isOpen);
  };

  const trimmed = searchQuery.replace(/^@/, "").trim();
  const showHint = trimmed.length > 0 && trimmed.length < 2;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar amigo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search input */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              placeholder="Buscar por @usuário ou nome"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10"
              autoComplete="off"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  inputRef.current?.focus();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                aria-label="Limpar busca"
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4" />
                )}
              </button>
            )}
          </div>

          {showHint && (
            <p className="text-xs text-muted-foreground -mt-2 px-1">
              Digite pelo menos 2 caracteres
            </p>
          )}

          {/* Results / states */}
          <div className="space-y-2 max-h-72 overflow-y-auto -mx-1 px-1">
            {/* Initial state */}
            {!trimmed && (
              <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <AtSign className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Encontre seus amigos</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Busque pelo @usuário ou nome de quem você quer adicionar
                  </p>
                </div>
              </div>
            )}

            {/* Loading skeleton */}
            {isSearching && trimmed.length >= 2 && results.length === 0 && (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg border bg-card animate-pulse">
                    <div className="h-10 w-10 rounded-full bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-24 bg-muted rounded" />
                      <div className="h-2.5 w-16 bg-muted rounded" />
                    </div>
                    <div className="h-8 w-20 bg-muted rounded-md" />
                  </div>
                ))}
              </div>
            )}

            {/* No results */}
            {!isSearching && hasSearched && results.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <Users className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Nenhum usuário encontrado</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Verifique o @ ou tente outro nome
                  </p>
                </div>
              </div>
            )}

            {/* Results */}
            {results.map((resultUser) => {
              const isFriend = friendIds.has(resultUser.id);
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

                  {isFriend ? (
                    <Badge variant="secondary" className="gap-1">
                      <Check className="h-3 w-3" />
                      Amigo
                    </Badge>
                  ) : isPending ? (
                    <Button size="sm" variant="secondary" disabled className="gap-1">
                      <Check className="h-3.5 w-3.5" />
                      Enviado
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled={sendRequest.isPending}
                      onClick={() => handleSendRequest(resultUser.id)}
                      className="gap-1"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Adicionar
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

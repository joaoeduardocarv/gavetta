import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, Send, Loader2, Check } from "lucide-react";
import { useFriendships, FriendProfile } from "@/hooks/useFriendships";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface ShareDrawerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drawerId: string;
  drawerName: string;
}

export function ShareDrawerDialog({ open, onOpenChange, drawerId, drawerName }: ShareDrawerDialogProps) {
  const { user } = useAuth();
  const { friends, friendsLoading } = useFriendships();
  const { toast } = useToast();
  const [sending, setSending] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string[]>([]);

  const handleShare = async (friend: FriendProfile) => {
    if (!user) return;
    setSending(friend.id);

    try {
      // Create shared drawer membership (pending)
      const { error: memberError } = await supabase
        .from("shared_drawer_members" as any)
        .insert({
          drawer_id: drawerId,
          user_id: friend.id,
          invited_by: user.id,
          status: "pending",
        });

      if (memberError) {
        if (memberError.code === "23505") {
          toast({ title: "Já compartilhado", description: `Essa gaveta já foi compartilhada com ${friend.username}.`, variant: "destructive" });
        } else {
          throw memberError;
        }
        setSending(null);
        return;
      }

      // Send notification
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .maybeSingle();

      await supabase.from("notifications").insert({
        user_id: friend.id,
        type: "shared_drawer_invite",
        title: "Convite de gaveta compartilhada",
        message: `${profile?.username || "Alguém"} quer compartilhar a gaveta "${drawerName}" com você!`,
        related_user_id: user.id,
        related_content_id: drawerId,
      });

      setSentTo(prev => [...prev, friend.id]);
      toast({ title: "Convite enviado!", description: `${friend.username} receberá o convite.` });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setSending(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setSentTo([]); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl flex items-center gap-2">
            <Users className="h-5 w-5" />
            Compartilhar "{drawerName}"
          </DialogTitle>
          <DialogDescription>
            Escolha um amigo para compartilhar essa gaveta. Ambos poderão adicionar e remover conteúdo.
          </DialogDescription>
        </DialogHeader>

        {friendsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : friends.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground text-sm">Você ainda não tem amigos adicionados.</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-2">
              {friends.map((friend) => {
                const alreadySent = sentTo.includes(friend.id);
                return (
                  <div
                    key={friend.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={friend.avatar_url || undefined} />
                        <AvatarFallback>{friend.username?.[0]?.toUpperCase() || "?"}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-sm">{friend.username}</span>
                    </div>
                    <Button
                      size="sm"
                      variant={alreadySent ? "secondary" : "default"}
                      disabled={sending === friend.id || alreadySent}
                      onClick={() => handleShare(friend)}
                    >
                      {sending === friend.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : alreadySent ? (
                        <><Check className="h-4 w-4 mr-1" /> Enviado</>
                      ) : (
                        <><Send className="h-4 w-4 mr-1" /> Enviar</>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Users, Send, Loader2, Check, Lock, Unlock } from "lucide-react";
import { useFriendships, FriendProfile } from "@/hooks/useFriendships";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface ShareDrawerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drawerId: string;
  drawerName: string;
  currentPermission?: string;
  onPermissionChange?: (permission: string) => void;
}

export function ShareDrawerDialog({ open, onOpenChange, drawerId, drawerName, currentPermission = "open", onPermissionChange }: ShareDrawerDialogProps) {
  const { user } = useAuth();
  const { friends, friendsLoading } = useFriendships();
  const { toast } = useToast();
  const [sending, setSending] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string[]>([]);
  const [isLocked, setIsLocked] = useState(currentPermission === "locked");
  const [updatingPermission, setUpdatingPermission] = useState(false);

  const handlePermissionToggle = async (locked: boolean) => {
    setUpdatingPermission(true);
    try {
      const newPermission = locked ? "locked" : "open";
      const { error } = await supabase
        .from("user_custom_drawers")
        .update({ shared_permission: newPermission } as any)
        .eq("id", drawerId);

      if (error) throw error;

      setIsLocked(locked);
      onPermissionChange?.(newPermission);
      toast({
        title: locked ? "Gaveta trancada 🔒" : "Gaveta aberta 🔓",
        description: locked
          ? "Apenas você pode adicionar ou remover conteúdo."
          : "Todos os membros podem adicionar e remover conteúdo.",
      });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setUpdatingPermission(false);
    }
  };

  const handleShare = async (friend: FriendProfile) => {
    if (!user) return;
    setSending(friend.id);

    try {
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
            Escolha um amigo para compartilhar essa gaveta e defina as permissões.
          </DialogDescription>
        </DialogHeader>

        {/* Permission Toggle */}
        <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
          <div className="flex items-center gap-3">
            {isLocked ? (
              <Lock className="h-5 w-5 text-amber-500" />
            ) : (
              <Unlock className="h-5 w-5 text-green-500" />
            )}
            <div>
              <Label className="text-sm font-medium">
                {isLocked ? "Somente dono edita" : "Todos podem editar"}
              </Label>
              <p className="text-xs text-muted-foreground">
                {isLocked
                  ? "Apenas você pode adicionar ou remover conteúdo."
                  : "Membros podem adicionar e remover conteúdo."}
              </p>
            </div>
          </div>
          <Switch
            checked={isLocked}
            onCheckedChange={handlePermissionToggle}
            disabled={updatingPermission}
          />
        </div>

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

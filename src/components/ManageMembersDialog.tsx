import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, Trash2, Loader2, UserX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface Member {
  id: string;
  userId: string;
  username: string;
  avatarUrl: string | null;
  status: string;
}

interface ManageMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drawerId: string;
  drawerName: string;
}

export function ManageMembersDialog({ open, onOpenChange, drawerId, drawerName }: ManageMembersDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const { data: memberships, error } = await supabase
        .from("shared_drawer_members" as any)
        .select("*")
        .eq("drawer_id", drawerId);

      if (error) throw error;

      const userIds = (memberships as any[] || []).map((m: any) => m.user_id);
      if (userIds.length === 0) {
        setMembers([]);
        setLoading(false);
        return;
      }

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", userIds);

      const result: Member[] = (memberships as any[] || []).map((m: any) => {
        const profile = profiles?.find((p: any) => p.id === m.user_id);
        return {
          id: m.id,
          userId: m.user_id,
          username: profile?.username || "Desconhecido",
          avatarUrl: profile?.avatar_url || null,
          status: m.status,
        };
      });

      setMembers(result);
    } catch (error) {
      console.error("Error fetching members:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) fetchMembers();
  }, [open, drawerId]);

  const handleRemove = async (member: Member) => {
    setRemoving(member.id);
    try {
      const { error } = await supabase
        .from("shared_drawer_members" as any)
        .delete()
        .eq("id", member.id);

      if (error) throw error;

      setMembers(prev => prev.filter(m => m.id !== member.id));
      toast({ title: "Membro removido", description: `${member.username} foi removido da gaveta.` });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setRemoving(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl flex items-center gap-2">
            <Users className="h-5 w-5" />
            Membros de "{drawerName}"
          </DialogTitle>
          <DialogDescription>
            Gerencie quem tem acesso a essa gaveta compartilhada.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-8">
            <UserX className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">Nenhum membro nesta gaveta.</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-2">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={member.avatarUrl || undefined} />
                      <AvatarFallback>{member.username?.[0]?.toUpperCase() || "?"}</AvatarFallback>
                    </Avatar>
                    <div>
                      <span className="font-medium text-sm">{member.username}</span>
                      <p className="text-xs text-muted-foreground">
                        {member.status === "pending" ? "Pendente" : "Aceito"}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={removing === member.id}
                    onClick={() => handleRemove(member)}
                  >
                    {removing === member.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <><Trash2 className="h-4 w-4 mr-1" /> Remover</>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}

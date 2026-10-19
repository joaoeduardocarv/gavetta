import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface CommentRow { id: string; body: string; created_at: string; user_id: string; username: string | null; handle: string | null; avatar_url: string | null; title: string | null }

export default function AdminModeration() {
  const qc = useQueryClient();
  const { data: comments, isLoading } = useQuery({
    queryKey: ["admin-comments"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_recent_comments", { _limit: 100 });
      if (error) throw error;
      return (data ?? []) as unknown as CommentRow[];
    },
  });
  const { data: blocks } = useQuery({
    queryKey: ["admin-blocks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("account_blocks").select("user_id, reason, created_at, profiles(username, handle)").order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as { user_id: string; reason: string | null; created_at: string; profiles: { username: string | null; handle: string | null } | null }[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("admin_delete_comment", { _comment_id: id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Comentário removido"); qc.invalidateQueries({ queryKey: ["admin-comments"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <section className="lg:col-span-2 space-y-2">
        <h2 className="font-heading font-bold">Comentários recentes</h2>
        {isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
        {(comments ?? []).length === 0 && !isLoading && <p className="text-sm text-muted-foreground">Nenhum comentário.</p>}
        {(comments ?? []).map((c) => (
          <div key={c.id} className="bg-card border border-border rounded-lg p-3 flex gap-3">
            <Avatar className="h-8 w-8"><AvatarImage src={c.avatar_url ?? undefined} /><AvatarFallback>{(c.username ?? "?")[0]}</AvatarFallback></Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">
                <Link to={`/admin/usuarios/${c.user_id}`} className="font-medium text-foreground hover:underline">{c.handle ? `@${c.handle}` : c.username}</Link>
                {c.title ? ` em ${c.title}` : ""} · {new Date(c.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
              </p>
              <p className="text-sm break-words">{c.body}</p>
            </div>
            <Button size="icon" variant="ghost" aria-label="Remover comentário" onClick={() => del.mutate(c.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </section>
      <section className="space-y-2">
        <h2 className="font-heading font-bold">Contas bloqueadas</h2>
        {(blocks ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nenhuma conta bloqueada.</p>}
        {(blocks ?? []).map((b) => (
          <Link key={b.user_id} to={`/admin/usuarios/${b.user_id}`} className="block bg-card border border-border rounded-lg p-3 hover:bg-muted/50">
            <p className="text-sm font-medium">{b.profiles?.handle ? `@${b.profiles.handle}` : b.profiles?.username ?? "Usuário"}</p>
            <p className="text-xs text-muted-foreground">{b.reason ?? "Sem motivo"} · {new Date(b.created_at).toLocaleDateString("pt-BR")}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}

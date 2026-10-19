import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Ban, CheckCircle2, Megaphone, Activity, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { UserActivityDialog } from "@/components/admin/UserActivityDialog";
import { DRAWER_LABELS } from "@/components/admin/featureLabels";

interface Detail {
  profile: { id: string; username: string | null; handle: string | null; avatar_url: string | null; created_at: string; is_public: boolean; onboarded_at: string | null } | null;
  account: { email: string | null; last_sign_in_at: string | null; email_confirmed_at: string | null; providers: string[] } | null;
  block: { reason: string | null; at: string } | null;
  is_admin: boolean;
  counts: Record<string, number | null>;
  drawers: { drawer_id: string; name: string; total: number }[];
  top_rated: { title: string | null; rating: number; type: string; at: string }[];
  friends_list: { id: string; username: string | null; handle: string | null; avatar_url: string | null }[];
  comments_list: { id: string; body: string; created_at: string }[];
}

const COUNT_LABELS: [string, string][] = [
  ["titles", "Títulos"], ["ratings", "Notas"], ["avg_rating", "Nota média dada"], ["episodes", "Episódios vistos"],
  ["episode_ratings", "Notas em episódios"], ["custom_drawers", "Gavettas próprias"], ["friends", "Amigos"],
  ["pending_friends", "Amizades pendentes"], ["recs_sent", "Indicações enviadas"], ["recs_received", "Indicações recebidas"],
  ["likes", "Curtidas"], ["comments", "Comentários"], ["imports", "Importações"], ["notifications_unread", "Avisos não lidos"],
];

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—");

export default function AdminUserDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [activityOpen, setActivityOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-user-profile", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_user_profile", { _user_id: id! });
      if (error) throw error;
      return data as unknown as Detail;
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-user-profile", id] });

  const block = useMutation({
    mutationFn: async (blocked: boolean) => {
      const { error } = await supabase.rpc("admin_set_block", { _user_id: id!, _blocked: blocked, _reason: reason });
      if (error) throw error;
    },
    onSuccess: (_, blocked) => { toast.success(blocked ? "Conta bloqueada" : "Conta desbloqueada"); setBlockOpen(false); setReason(""); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const notice = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("admin_send_notice", { _title: title, _message: message, _user_ids: [id!] });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Aviso enviado"); setNoticeOpen(false); setTitle(""); setMessage(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  const delComment = useMutation({
    mutationFn: async (cid: string) => {
      const { error } = await supabase.rpc("admin_delete_comment", { _comment_id: cid });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Comentário removido"); refresh(); },
  });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!data?.profile) return <p className="text-muted-foreground">Usuário não encontrado.</p>;
  const p = data.profile;

  return (
    <div className="space-y-6">
      <Link to="/admin/usuarios" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" />Usuários</Link>

      <div className="bg-card border border-border rounded-lg p-4 flex flex-col md:flex-row gap-4 md:items-center">
        <Avatar className="h-16 w-16"><AvatarImage src={p.avatar_url ?? undefined} /><AvatarFallback>{(p.username ?? "?")[0]?.toUpperCase()}</AvatarFallback></Avatar>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-heading font-bold text-xl">{p.username ?? "Usuário"}</h2>
            {p.handle && <span className="text-muted-foreground">@{p.handle}</span>}
            {data.is_admin && <Badge>Admin</Badge>}
            {data.block && <Badge variant="destructive">Bloqueado</Badge>}
            <Badge variant="outline">{p.is_public ? "Perfil público" : "Perfil privado"}</Badge>
          </div>
          <p className="text-sm text-muted-foreground break-all">{data.account?.email ?? "—"}</p>
          <p className="text-xs text-muted-foreground">
            Cadastro {fmt(p.created_at)} · Último login {fmt(data.account?.last_sign_in_at)} · Onboarding {p.onboarded_at ? "concluído" : "pendente"} · Login via {(data.account?.providers ?? []).join(", ") || "—"}
          </p>
          {data.block && <p className="text-xs text-destructive">Bloqueado em {fmt(data.block.at)}{data.block.reason ? ` — ${data.block.reason}` : ""}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setActivityOpen(true)}><Activity className="h-4 w-4 mr-1" />Linha do tempo</Button>
          <Button size="sm" variant="outline" onClick={() => setNoticeOpen(true)}><Megaphone className="h-4 w-4 mr-1" />Enviar aviso</Button>
          {!data.is_admin && (data.block ? (
            <Button size="sm" variant="secondary" onClick={() => block.mutate(false)} disabled={block.isPending}><CheckCircle2 className="h-4 w-4 mr-1" />Desbloquear</Button>
          ) : (
            <Button size="sm" variant="destructive" onClick={() => setBlockOpen(true)}><Ban className="h-4 w-4 mr-1" />Bloquear</Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {COUNT_LABELS.map(([k, l]) => (
          <div key={k} className="bg-card border border-border rounded-lg p-3">
            <p className="text-xs text-muted-foreground">{l}</p>
            <p className="text-xl font-bold">{data.counts[k] ?? "—"}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <section className="bg-card border border-border rounded-lg p-4 space-y-2">
          <h3 className="font-heading font-bold">Gavettas</h3>
          {data.drawers.length === 0 && <p className="text-sm text-muted-foreground">Nenhum título.</p>}
          {data.drawers.map((d) => (
            <div key={d.drawer_id} className="flex justify-between text-sm"><span>{DRAWER_LABELS[d.drawer_id] ?? d.name}</span><span className="text-muted-foreground">{d.total}</span></div>
          ))}
        </section>
        <section className="bg-card border border-border rounded-lg p-4 space-y-2">
          <h3 className="font-heading font-bold">Últimas notas</h3>
          {data.top_rated.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma nota.</p>}
          {data.top_rated.map((r, i) => (
            <div key={i} className="flex justify-between text-sm gap-2"><span className="truncate">{r.title ?? "—"}</span><Badge variant="secondary">{r.rating}/10</Badge></div>
          ))}
        </section>
        <section className="bg-card border border-border rounded-lg p-4 space-y-2">
          <h3 className="font-heading font-bold">Amigos</h3>
          {data.friends_list.length === 0 && <p className="text-sm text-muted-foreground">Sem amigos.</p>}
          <div className="flex flex-wrap gap-2">
            {data.friends_list.map((f) => (
              <Link key={f.id} to={`/admin/usuarios/${f.id}`} className="flex items-center gap-2 bg-muted/50 rounded-full pl-1 pr-3 py-1 text-sm hover:bg-muted">
                <Avatar className="h-6 w-6"><AvatarImage src={f.avatar_url ?? undefined} /><AvatarFallback>{(f.username ?? "?")[0]}</AvatarFallback></Avatar>
                {f.handle ? `@${f.handle}` : f.username}
              </Link>
            ))}
          </div>
        </section>
        <section className="bg-card border border-border rounded-lg p-4 space-y-2">
          <h3 className="font-heading font-bold">Comentários</h3>
          {data.comments_list.length === 0 && <p className="text-sm text-muted-foreground">Nenhum comentário.</p>}
          {data.comments_list.map((c) => (
            <div key={c.id} className="flex items-start justify-between gap-2 text-sm bg-muted/50 rounded-md p-2">
              <div className="min-w-0"><p className="break-words">{c.body}</p><p className="text-xs text-muted-foreground">{fmt(c.created_at)}</p></div>
              <Button size="icon" variant="ghost" aria-label="Remover comentário" onClick={() => delComment.mutate(c.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </section>
      </div>

      <UserActivityDialog userId={id ?? null} open={activityOpen} onOpenChange={setActivityOpen} />

      <Dialog open={noticeOpen} onOpenChange={setNoticeOpen}>
        <DialogContent className="z-[60]">
          <DialogHeader><DialogTitle>Enviar aviso para {p.handle ? `@${p.handle}` : p.username}</DialogTitle></DialogHeader>
          <Input placeholder="Título" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="Mensagem (opcional)" maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} />
          <DialogFooter><Button disabled={!title.trim() || notice.isPending} onClick={() => notice.mutate()}>Enviar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={blockOpen} onOpenChange={(v) => { setBlockOpen(v); if (!v) setReason(""); }}>
        <DialogContent className="z-[60]">
          <DialogHeader><DialogTitle>Bloquear conta</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">A pessoa verá uma tela de conta suspensa e não poderá usar o app até ser desbloqueada.</p>
          <Textarea placeholder="Motivo (mostrado ao usuário)" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
          <DialogFooter><Button variant="destructive" disabled={block.isPending} onClick={() => block.mutate(true)}>Bloquear</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function AdminNotices() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

  const { data: history, isLoading } = useQuery({
    queryKey: ["admin-notices"],
    queryFn: async () => {
      const { data, error } = await supabase.from("admin_notices").select("*").order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
  });

  const send = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("admin_send_notice", { _title: title, _message: message });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (n) => { toast.success(`Aviso enviado para ${n} usuários`); setTitle(""); setMessage(""); qc.invalidateQueries({ queryKey: ["admin-notices"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <section className="bg-card border border-border rounded-lg p-4 space-y-3">
        <h2 className="font-heading font-bold">Novo aviso para todos os usuários</h2>
        <p className="text-sm text-muted-foreground">Aparece no sino de notificações de cada pessoa. Para avisar alguém específico, use a ficha do usuário.</p>
        <Input placeholder="Título" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea placeholder="Mensagem (opcional)" maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} />
        <Button
          disabled={!title.trim() || send.isPending}
          onClick={() => { if (confirm("Enviar este aviso para todos os usuários?")) send.mutate(); }}
        >
          {send.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Enviar para todos
        </Button>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading font-bold">Histórico</h2>
        {isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
        {(history ?? []).length === 0 && !isLoading && <p className="text-sm text-muted-foreground">Nenhum aviso enviado.</p>}
        {(history ?? []).map((n) => (
          <div key={n.id} className="bg-card border border-border rounded-lg p-3">
            <div className="flex justify-between gap-2">
              <p className="font-medium">{n.title}</p>
              <Badge variant="secondary">{n.audience === "all" ? "Todos" : "Individual"} · {n.recipients}</Badge>
            </div>
            {n.message && <p className="text-sm text-muted-foreground mt-1">{n.message}</p>}
            <p className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

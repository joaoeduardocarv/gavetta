import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Loader2, Search, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface UserRow {
  id: string; username: string | null; handle: string | null; avatar_url: string | null;
  created_at: string; onboarded: boolean; titles: number; ratings: number; episodes: number;
  imports: number; last_activity: string | null;
}

type Segment = "all" | "active" | "risk" | "inactive" | "new" | "no_onboarding";
const SEGMENTS: { id: Segment; label: string }[] = [
  { id: "all", label: "Todos" }, { id: "active", label: "Ativos 7d" }, { id: "risk", label: "Em risco" },
  { id: "inactive", label: "Inativos" }, { id: "new", label: "Novos 7d" }, { id: "no_onboarding", label: "Sem onboarding" },
];

const daysSince = (iso: string | null) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : Infinity);

export function userStatus(last: string | null) {
  const d = daysSince(last);
  if (d <= 0) return { text: "Ativo hoje", variant: "default" as const };
  if (d <= 7) return { text: `Ativo há ${d}d`, variant: "secondary" as const };
  if (d === Infinity) return { text: "Nunca usou", variant: "outline" as const };
  return { text: `Inativo há ${d}d`, variant: "outline" as const };
}

export default function AdminUsers() {
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState<Segment>("all");
  const navigate = useNavigate();

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users", query],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_user_list", { _query: query, _limit: 200 });
      if (error) throw error;
      return (data ?? []) as unknown as UserRow[];
    },
  });

  const filtered = useMemo(() => (users ?? []).filter((u) => {
    const d = daysSince(u.last_activity);
    switch (segment) {
      case "active": return d <= 7;
      case "risk": return d > 7 && d <= 30;
      case "inactive": return d > 30;
      case "new": return daysSince(u.created_at) <= 7;
      case "no_onboarding": return !u.onboarded;
      default: return true;
    }
  }), [users, segment]);

  const exportCsv = () => {
    const head = ["nome", "handle", "cadastro", "onboarding", "titulos", "notas", "episodios", "importacoes", "ultima_atividade"];
    const rows = filtered.map((u) => [u.username ?? "", u.handle ?? "", u.created_at, u.onboarded ? "sim" : "nao", u.titles, u.ratings, u.episodes, u.imports, u.last_activity ?? ""]);
    const csv = [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `usuarios-${segment}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-3 md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por @handle ou nome" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4 mr-1" />Exportar CSV</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {SEGMENTS.map((s) => (
          <Button key={s.id} size="sm" variant={segment === s.id ? "default" : "outline"} onClick={() => setSegment(s.id)}>{s.label}</Button>
        ))}
        <span className="text-sm text-muted-foreground self-center ml-1">{filtered.length} usuários</span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead><TableHead>Cadastro</TableHead><TableHead>Títulos</TableHead>
                <TableHead>Notas</TableHead><TableHead>Episódios</TableHead><TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => {
                const st = userStatus(u.last_activity);
                return (
                  <TableRow key={u.id} className="cursor-pointer" onClick={() => navigate(`/admin/usuarios/${u.id}`)}>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-[180px]">
                        <Avatar className="h-8 w-8"><AvatarImage src={u.avatar_url ?? undefined} /><AvatarFallback>{(u.username ?? "?")[0]?.toUpperCase()}</AvatarFallback></Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{u.username ?? "Usuário"}</p>
                          {u.handle && <p className="text-xs text-muted-foreground">@{u.handle}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{new Date(u.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>{u.titles}</TableCell>
                    <TableCell>{u.ratings}</TableCell>
                    <TableCell>{u.episodes}</TableCell>
                    <TableCell><Badge variant={st.variant}>{st.text}</Badge></TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum usuário encontrado.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

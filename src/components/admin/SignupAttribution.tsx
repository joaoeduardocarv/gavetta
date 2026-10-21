import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function SignupAttribution({ from, to }: { from: string; to: string }) {
  const { data: rows = [], isLoading, isError } = useQuery({
    queryKey: ["admin-attribution", from, to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_attribution_list", { _from: from, _to: to });
      if (error) throw error;
      return data ?? [];
    },
  });
  const groups = useMemo(() => {
    const m = new Map<string, { source: string; campaign: string; count: number }>();
    for (const r of rows) {
      const source = r.utm_source ?? "Sem campanha";
      const campaign = r.utm_campaign ?? "—";
      const k = `${source}|${campaign}`;
      const g = m.get(k) ?? { source, campaign, count: 0 };
      g.count++; m.set(k, g);
    }
    return [...m.values()].sort((a, b) => b.count - a.count);
  }, [rows]);
  const tracked = rows.filter((r) => r.utm_source || r.utm_campaign).length;

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (isError) return <p className="py-8">Não foi possível carregar a origem dos cadastros.</p>;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Use links com UTM, ex.: <code className="text-foreground">gavetta.com.br/?utm_source=instagram&utm_medium=ads&utm_campaign=lancamento</code>. A primeira campanha vista nos últimos 30 dias é gravada no cadastro. Cadastros anteriores a este recurso aparecem como "Sem campanha".
      </p>
      <p className="text-sm">{tracked} de {rows.length} cadastros do período vieram de uma campanha.</p>
      <div className="overflow-x-auto border-y border-border"><Table>
        <TableHeader><TableRow><TableHead>Origem</TableHead><TableHead>Campanha</TableHead><TableHead className="text-right">Cadastros</TableHead></TableRow></TableHeader>
        <TableBody>{groups.map((g) => <TableRow key={g.source + g.campaign}><TableCell className="font-medium">{g.source}</TableCell><TableCell>{g.campaign}</TableCell><TableCell className="text-right tabular-nums">{g.count}</TableCell></TableRow>)}
          {!groups.length && <TableRow><TableCell colSpan={3} className="py-8 text-center text-muted-foreground">Nenhum cadastro no período.</TableCell></TableRow>}</TableBody>
      </Table></div>
      <h3 className="font-semibold">Usuários por campanha</h3>
      <div className="overflow-x-auto border-y border-border"><Table>
        <TableHeader><TableRow><TableHead>Usuário</TableHead><TableHead>Cadastro</TableHead><TableHead>Origem</TableHead><TableHead>Mídia</TableHead><TableHead>Campanha</TableHead><TableHead>Conteúdo</TableHead></TableRow></TableHeader>
        <TableBody>{rows.filter((r) => r.utm_source || r.utm_campaign).map((r) => <TableRow key={r.user_id}>
          <TableCell><Link className="underline-offset-2 hover:underline" to={`/admin/usuarios/${r.user_id}`}>{r.handle ? `@${r.handle}` : r.username ?? "—"}</Link></TableCell>
          <TableCell className="whitespace-nowrap">{new Date(r.signed_up_at).toLocaleDateString("pt-BR")}</TableCell>
          <TableCell><Badge variant="outline">{r.utm_source ?? "—"}</Badge></TableCell>
          <TableCell>{r.utm_medium ?? "—"}</TableCell><TableCell>{r.utm_campaign ?? "—"}</TableCell><TableCell>{r.utm_content ?? "—"}</TableCell>
        </TableRow>)}
          {!tracked && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Nenhum cadastro com campanha ainda.</TableCell></TableRow>}</TableBody>
      </Table></div>
    </div>
  );
}

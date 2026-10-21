import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { BarChart3, Download, Loader2, Pencil, Plus, Trash2, TrendingUp } from "lucide-react";
import { format, subWeeks } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { mondayOf, projectConversions, summarizeMarketing, validMarketingInput, type MarketingObservation } from "@/lib/marketingMix";
import SignupAttribution from "@/components/admin/SignupAttribution";

const currency = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const integer = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const today = () => format(new Date(), "yyyy-MM-dd");
const emptyForm = () => ({ week: today(), channel: "", spend: "", conversions: "", revenue: "" });
const chartConfig = { spend: { label: "Investimento (R$)", color: "hsl(var(--primary))" }, conversions: { label: "Conversões", color: "hsl(var(--accent))" } };

export default function AdminMarketing() {
  const qc = useQueryClient();
  const [period, setPeriod] = useState("12");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [budgets, setBudgets] = useState<Record<string, string>>({});
  const from = mondayOf(format(subWeeks(new Date(), Number(period) - 1), "yyyy-MM-dd"));
  const to = mondayOf(today());
  const { data: rows = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-marketing", from, to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_marketing_list", { _from: from, _to: to });
      if (error) throw error;
      return (data ?? []) as MarketingObservation[];
    },
  });
  const channels = useMemo(() => summarizeMarketing(rows), [rows]);
  const totals = channels.reduce((s, c) => ({ spend: s.spend + c.spend, conversions: s.conversions + c.conversions, revenue: s.revenue + c.revenue }), { spend: 0, conversions: 0, revenue: 0 });
  const weekly = useMemo(() => {
    const data = new Map<string, { week: string; spend: number; conversions: number }>();
    for (let i = Number(period) - 1; i >= 0; i--) {
      const week = mondayOf(format(subWeeks(new Date(), i), "yyyy-MM-dd"));
      data.set(week, { week, spend: 0, conversions: 0 });
    }
    for (const r of rows) {
      const group = data.get(r.week_start);
      if (group) { group.spend += Number(r.spend); group.conversions += Number(r.conversions); }
    }
    return [...data.values()];
  }, [rows, period]);
  const scenario = channels.map((c) => {
    const budget = Number(budgets[c.channel] ?? c.spend.toFixed(2));
    return { ...c, budget, estimate: projectConversions(c.spend, c.conversions, budget) };
  });
  const scenarioValid = scenario.every((c) => Number.isFinite(c.budget) && c.budget >= 0 && c.budget <= 100000000);
  const scenarioTotal = scenario.reduce((n, c) => n + c.budget, 0);
  const scenarioEstimate = scenario.reduce((n, c) => n + (c.estimate ?? 0), 0);
  const incompleteScenario = scenario.some((c) => c.budget > 0 && c.estimate === null);
  const close = () => { setOpen(false); setEditing(false); setForm(emptyForm()); };
  const save = useMutation({
    mutationFn: async () => {
      const spend = Number(form.spend), conversions = Number(form.conversions), revenue = Number(form.revenue);
      if (!form.week || !form.channel.trim() || !validMarketingInput(spend, conversions, revenue)) throw new Error("Revise os valores informados.");
      const { error } = await supabase.rpc("admin_marketing_save", { _week: mondayOf(form.week), _channel: form.channel.trim(), _spend: spend, _conversions: conversions, _revenue: revenue });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-marketing"] }); toast.success("Registro salvo"); close(); },
    onError: () => toast.error("Não foi possível salvar. Revise os valores e tente novamente."),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.rpc("admin_marketing_delete", { _id: id }); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-marketing"] }); toast.success("Registro removido"); },
    onError: () => toast.error("Não foi possível remover o registro."),
  });
  const exportCsv = () => {
    const cell = (value: unknown) => `"${String(value).replace(/^[=+@-]/, "'$&").replace(/"/g, '""')}"`;
    const csv = [["semana", "canal", "investimento_brl", "conversoes", "receita_brl"], ...rows.map((r) => [r.week_start, r.channel, r.spend, r.conversions, r.revenue])].map((r) => r.map(cell).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `marketing-${from}-${to}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  const formValid = form.week && form.channel.trim() && form.spend !== "" && form.conversions !== "" && validMarketingInput(Number(form.spend), Number(form.conversions), Number(form.revenue));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div><h2 className="font-heading text-2xl font-bold flex items-center gap-2"><BarChart3 className="h-6 w-6 text-primary" />Marketing & investimento</h2><p className="text-sm text-muted-foreground mt-1">Canais, resultados e planejamento de orçamento</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={period} onValueChange={setPeriod}><SelectTrigger className="w-44" aria-label="Período de marketing"><SelectValue /></SelectTrigger><SelectContent>{[4, 12, 26, 52].map((w) => <SelectItem key={w} value={String(w)}>{w} semanas</SelectItem>)}</SelectContent></Select>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={!rows.length}><Download className="h-4 w-4 mr-2" />CSV</Button>
          <Button size="sm" onClick={() => { setEditing(false); setForm(emptyForm()); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />Novo registro</Button>
        </div>
      </div>
      <div className="border-l-2 border-accent pl-3 text-sm text-muted-foreground">Dados informados manualmente. Simulações descritivas, sem atribuição causal; não há modelo MMM treinado nem conexão automática com anúncios.</div>
      {isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div> : isError ? <div className="space-y-3 py-8"><p>Não foi possível carregar os dados de marketing.</p><Button variant="outline" onClick={() => refetch()}>Tentar novamente</Button></div> : <>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {[
            { label: "Investimento registrado", value: currency(totals.spend) },
            { label: "Conversões informadas", value: integer(totals.conversions) },
            { label: "Custo por conversão", value: totals.conversions > 0 ? currency(totals.spend / totals.conversions) : "—" },
            { label: "Retorno sobre anúncios (ROAS)", value: totals.spend > 0 ? `${(totals.revenue / totals.spend).toFixed(2)}x` : "—" },
          ].map((s) => <div key={s.label} className="rounded-lg border border-border bg-card p-4 min-w-0"><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-xl font-bold mt-2 break-words tabular-nums">{s.value}</p></div>)}
        </div>
        <Tabs defaultValue="performance" className="space-y-5">
          <TabsList className="max-w-full"><TabsTrigger value="performance">Desempenho</TabsTrigger><TabsTrigger value="scenario">Simulador</TabsTrigger><TabsTrigger value="records">Registros</TabsTrigger><TabsTrigger value="signups">Origem dos cadastros</TabsTrigger></TabsList>
          <TabsContent value="signups"><SignupAttribution from={from} to={format(new Date(), "yyyy-MM-dd")} /></TabsContent>
          <TabsContent value="performance" className="space-y-6">
            {!rows.length ? <div className="py-14 text-center border-y border-border space-y-3"><TrendingUp className="h-8 w-8 text-muted-foreground mx-auto" /><h3 className="font-semibold">Nenhum registro neste período</h3><Button variant="outline" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Adicionar investimento</Button></div> : <>
              <section className="space-y-3"><h3 className="font-semibold">Evolução semanal</h3><ChartContainer config={chartConfig} className="h-64 w-full aspect-auto"><BarChart data={weekly}><CartesianGrid vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="week" tickFormatter={(d: string) => d.slice(5).split("-").reverse().join("/")} tickLine={false} axisLine={false} minTickGap={24} /><YAxis yAxisId="spend" tickLine={false} axisLine={false} width={65} /><YAxis yAxisId="conversions" orientation="right" tickLine={false} axisLine={false} allowDecimals={false} width={45} /><ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => `Semana de ${String(v).split("-").reverse().join("/")}`} />} /><Bar yAxisId="spend" dataKey="spend" fill="var(--color-spend)" radius={[3, 3, 0, 0]} /><Bar yAxisId="conversions" dataKey="conversions" fill="var(--color-conversions)" radius={[3, 3, 0, 0]} /></BarChart></ChartContainer><div className="flex flex-wrap gap-5 text-xs text-muted-foreground"><span className="flex gap-2 items-center"><span className="h-2 w-2 bg-primary" />Investimento (eixo esquerdo, R$)</span><span className="flex gap-2 items-center"><span className="h-2 w-2 bg-accent" />Conversões (eixo direito)</span></div></section>
              <section className="space-y-3"><h3 className="font-semibold">Comparativo de canais</h3><div className="overflow-x-auto border-y border-border"><Table><TableHeader><TableRow><TableHead>Canal</TableHead><TableHead>Investimento</TableHead><TableHead>Participação</TableHead><TableHead>Conversões</TableHead><TableHead>CPA</TableHead><TableHead>ROAS</TableHead><TableHead>Histórico</TableHead></TableRow></TableHeader><TableBody>{channels.map((c) => <TableRow key={c.channel}><TableCell className="font-medium max-w-52 break-words">{c.channel}</TableCell><TableCell className="whitespace-nowrap">{currency(c.spend)}</TableCell><TableCell>{totals.spend > 0 ? `${(100 * c.spend / totals.spend).toFixed(1)}%` : "—"}</TableCell><TableCell>{integer(c.conversions)}</TableCell><TableCell className="whitespace-nowrap">{c.cpa !== null ? currency(c.cpa) : "—"}</TableCell><TableCell>{c.roas !== null ? `${c.roas.toFixed(2)}x` : "—"}</TableCell><TableCell><Badge variant="outline">{c.weeks} semanas</Badge></TableCell></TableRow>)}</TableBody></Table></div></section>
            </>}
          </TabsContent>
          <TabsContent value="scenario" className="space-y-5">
            <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Cenário para um período de {period} semanas</h3><Button size="sm" variant="ghost" onClick={() => setBudgets({})}>Restaurar</Button></div>
            <p className="text-sm text-muted-foreground">Projeção linear pelo custo histórico por conversão. Não considera sazonalidade, saturação, efeitos tardios ou influência entre canais.</p>
            {!channels.length ? <p className="text-muted-foreground py-8">Sem histórico para simular.</p> : <>
              <div className="space-y-4 divide-y divide-border">{scenario.map((c) => <div key={c.channel} className="grid grid-cols-1 md:grid-cols-[1fr_200px_180px] items-center gap-3 pt-4"><div className="min-w-0"><p className="font-medium break-words">{c.channel}</p><p className="text-xs text-muted-foreground">Histórico: {currency(c.spend)} · {integer(c.conversions)} conversões</p></div><div><Label htmlFor={`budget-${c.channel}`} className="text-xs">Orçamento (R$)</Label><Input id={`budget-${c.channel}`} type="number" min="0" max="100000000" step="0.01" value={budgets[c.channel] ?? c.spend.toFixed(2)} onChange={(e) => setBudgets((b) => ({ ...b, [c.channel]: e.target.value }))} /></div><div><p className="text-xs text-muted-foreground">Conversões estimadas</p><p className="text-lg font-semibold">{c.estimate !== null && scenarioValid ? integer(c.estimate) : "Sem estimativa"}</p>{c.budget > c.spend * 1.5 && <p className="text-xs text-muted-foreground">Muito acima do histórico</p>}</div></div>)}</div>
              <div className="border-t border-border pt-5 flex flex-wrap gap-8"><div><p className="text-xs text-muted-foreground">Orçamento simulado</p><p className="text-2xl font-bold">{scenarioValid ? currency(scenarioTotal) : "Valor inválido"}</p></div><div><p className="text-xs text-muted-foreground">{incompleteScenario ? "Estimativa parcial de conversões" : "Conversões estimadas"}</p><p className="text-2xl font-bold">{scenarioValid ? integer(scenarioEstimate) : "—"}</p></div></div>
            </>}
          </TabsContent>
          <TabsContent value="records" className="space-y-3"><h3 className="font-semibold">Histórico de registros · {rows.length}</h3><div className="overflow-x-auto border-y border-border"><Table><TableHeader><TableRow><TableHead>Semana de</TableHead><TableHead>Canal</TableHead><TableHead>Investimento</TableHead><TableHead>Conversões</TableHead><TableHead>Receita</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader><TableBody>{rows.map((r) => <TableRow key={r.id}><TableCell className="whitespace-nowrap">{r.week_start.split("-").reverse().join("/")}</TableCell><TableCell className="max-w-52 break-words">{r.channel}</TableCell><TableCell className="whitespace-nowrap">{currency(Number(r.spend))}</TableCell><TableCell>{integer(r.conversions)}</TableCell><TableCell className="whitespace-nowrap">{currency(Number(r.revenue))}</TableCell><TableCell><div className="flex justify-end"><Button variant="ghost" size="icon" aria-label={`Editar ${r.channel}`} title="Editar registro" onClick={() => { setEditing(true); setForm({ week: r.week_start, channel: r.channel, spend: String(r.spend), conversions: String(r.conversions), revenue: String(r.revenue) }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" aria-label={`Excluir ${r.channel}`} title="Excluir registro" disabled={remove.isPending} onClick={() => { if (confirm(`Excluir o registro de ${r.channel} da semana ${r.week_start}?`)) remove.mutate(r.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></TableCell></TableRow>)}{!rows.length && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Nenhum registro neste período.</TableCell></TableRow>}</TableBody></Table></div></TabsContent>
        </Tabs>
      </>}
      <Dialog open={open} onOpenChange={(value) => { if (!value && !save.isPending) close(); }}><DialogContent className="z-[60]"><DialogHeader><DialogTitle>{editing ? "Editar registro" : "Novo registro de marketing"}</DialogTitle></DialogHeader><form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (formValid) save.mutate(); }}>
        <div><Label htmlFor="marketing-week">Data na semana</Label><Input id="marketing-week" type="date" required max={today()} disabled={editing || save.isPending} value={form.week} onChange={(e) => setForm((f) => ({ ...f, week: e.target.value }))} /><p className="text-xs text-muted-foreground mt-1">Semana de {form.week ? mondayOf(form.week).split("-").reverse().join("/") : "—"}</p></div>
        <div><Label htmlFor="marketing-channel">Canal</Label><Input id="marketing-channel" placeholder="Ex.: Meta Ads, Google Ads, Orgânico" maxLength={80} required disabled={editing || save.isPending} value={form.channel} onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))} /></div>
        <div className="grid grid-cols-2 gap-3"><div><Label htmlFor="marketing-spend">Investimento (R$)</Label><Input id="marketing-spend" type="number" min="0" max="100000000" step="0.01" required disabled={save.isPending} value={form.spend} onChange={(e) => setForm((f) => ({ ...f, spend: e.target.value }))} /></div><div><Label htmlFor="marketing-conversions">Conversões</Label><Input id="marketing-conversions" type="number" min="0" max="100000000" step="1" required disabled={save.isPending} value={form.conversions} onChange={(e) => setForm((f) => ({ ...f, conversions: e.target.value }))} /></div></div>
        <div><Label htmlFor="marketing-revenue">Receita atribuída (R$, opcional)</Label><Input id="marketing-revenue" type="number" min="0" max="100000000" step="0.01" disabled={save.isPending} value={form.revenue} onChange={(e) => setForm((f) => ({ ...f, revenue: e.target.value }))} /></div>
        <p className="text-xs text-muted-foreground">Use a mesma definição de conversão em todos os canais, sem contar a mesma conversão duas vezes. Salvar substitui os valores existentes do mesmo canal e semana.</p>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={save.isPending} onClick={close}>Cancelar</Button><Button type="submit" disabled={!formValid || save.isPending}>{save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar registro</Button></div>
      </form></DialogContent></Dialog>
    </div>
  );
}

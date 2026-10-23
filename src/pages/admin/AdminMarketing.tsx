import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { BarChart3, Download, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { format, subWeeks } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { mondayOf, projectConversions } from '@/lib/marketingMix';
import { summarizeCampaigns, sumKnown, objectiveLabel, costPerResult, clickThroughRate, type MarketingCampaign } from '@/lib/marketingCampaigns';
import CampaignForm, { type CampaignInput } from '@/components/admin/CampaignForm';
import SignupAttribution from '@/components/admin/SignupAttribution';
const money = (n: number) => n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const integer = (n: number) => n.toLocaleString('pt-BR',{maximumFractionDigits:0});
const value = (n: number | null, render = integer) => n === null ? 'Sem dado' : render(n);
const percent = (n: number) => `${n.toLocaleString('pt-BR',{maximumFractionDigits:2})}%`;
const date = (s: string) => s.split('-').reverse().join('/');
const chartConfig = { spend:{label:'Investimento (R$)',color:'hsl(var(--primary))'} };
export default function AdminMarketing() {
  const qc = useQueryClient();
  const [period,setPeriod] = useState('12');
  const [open,setOpen] = useState(false);
  const [editing,setEditing] = useState<MarketingCampaign | null>(null);
  const [tab,setTab] = useState('performance');

  const [budgets,setBudgets] = useState<Record<string,string>>({});
  const from = mondayOf(format(subWeeks(new Date(),Number(period)-1),'yyyy-MM-dd'));
  const to = format(new Date(),'yyyy-MM-dd');
  const { data:rows = [],isLoading,isError,refetch } = useQuery({queryKey:['admin-campaigns',from,to],queryFn:async () => {
    const {data,error} = await supabase.rpc('admin_campaign_list',{_from:from,_to:to});
    if (error) throw error;
    return (data ?? []) as MarketingCampaign[];
  }});
  const groups = useMemo(() => summarizeCampaigns(rows),[rows]);
  const spend = sumKnown(rows.map(r => r.spend));
  const impressionRows = rows.filter(r => r.impressions !== null && r.clicks !== null);
  const ctr = clickThroughRate(sumKnown(impressionRows.map(r => r.impressions)),sumKnown(impressionRows.map(r => r.clicks)));
  const close = () => {setOpen(false);setEditing(null);};
  const save = useMutation({mutationFn:async (f:CampaignInput) => {
    const {error} = await supabase.rpc('admin_campaign_save',{_id:f.id,_name:f.name,_start:f.start,_end:f.end,_channel:f.channel,_objective:f.objective,_metric:f.metric,_spend:f.spend,_results:f.results,_revenue:f.revenue,_impressions:f.impressions,_clicks:f.clicks,_notes:f.notes});
    if (error) throw error;
  },onSuccess:() => {qc.invalidateQueries({queryKey:['admin-campaigns']});toast.success('Campanha salva');close();},onError:() => toast.error('Não foi possível salvar a campanha. Revise os dados e tente novamente.')});
  const remove = useMutation({mutationFn:async (id:string) => {const {error} = await supabase.rpc('admin_campaign_delete',{_id:id});if(error)throw error;},onSuccess:() => {qc.invalidateQueries({queryKey:['admin-campaigns']});toast.success('Campanha removida');},onError:() => toast.error('Não foi possível remover a campanha.')});
  const startNew = () => {setEditing(null);setOpen(true);};
  const exportCsv = () => {
    const cell = (v:unknown) => `"${String(v ?? 'Sem dado').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')}"`;
    const data = [['campanha','inicio','termino','canal','objetivo','resultado_mensurado','resultados','investimento_brl','receita_brl','impressoes','cliques','cpa','ctr_percentual','observacoes'],...rows.map(r => [r.name,r.start_date,r.end_date ?? 'Ongoing',r.channel,objectiveLabel(r.objective),r.result_metric,r.results,r.spend,r.revenue,r.impressions,r.clicks,costPerResult(r.spend,r.results),clickThroughRate(r.impressions,r.clicks),r.notes])];
    const url = URL.createObjectURL(new Blob(['\uFEFF'+data.map(r => r.map(cell).join(';')).join('\n')],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download=`campanhas-${from}-${to}.csv`;a.click();URL.revokeObjectURL(url);
  };
  return <div className="space-y-6">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="font-heading text-2xl font-bold flex items-center gap-2"><BarChart3 className="h-6 w-6 text-primary" />Marketing & campanhas</h2><p className="text-sm text-muted-foreground mt-1">Campanhas em andamento ou com período entre {date(from)} e {date(to)}</p></div><div className="flex flex-wrap gap-2"><Select value={period} onValueChange={setPeriod}><SelectTrigger aria-label="Período de marketing" className="w-44"><SelectValue /></SelectTrigger><SelectContent>{[4,12,26,52].map(w => <SelectItem key={w} value={String(w)}>{w} semanas</SelectItem>)}</SelectContent></Select><Button size="sm" variant="outline" disabled={!rows.length} onClick={exportCsv}><Download className="mr-2 h-4 w-4" />CSV</Button><Button size="sm" onClick={startNew}><Plus className="mr-2 h-4 w-4" />Nova campanha</Button></div></div>
    <p className="border-l-2 border-accent pl-3 text-sm text-muted-foreground">Valores acumulados das campanhas, sem divisão por semana. CPA por resultado mensurado; simulações históricas, sem atribuição causal ou modelo MMM treinado.</p>
    {isLoading ? <Loader2 className="mx-auto my-16 h-7 w-7 animate-spin text-muted-foreground" /> : isError ? <div className="py-8 space-y-3"><p>Não foi possível carregar as campanhas.</p><Button variant="outline" onClick={() => refetch()}>Tentar novamente</Button></div> : <>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">{[{label:'Campanhas no período',value:integer(rows.length)},{label:'Investimento informado',value:value(spend,money)},{label:'Impressões informadas',value:value(sumKnown(rows.map(r => r.impressions)))},{label:'CTR · dados completos',value:value(ctr,percent)}].map(s => <div key={s.label} className="rounded-lg border border-border bg-card p-4 min-w-0"><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-xl font-bold mt-2 break-words tabular-nums">{s.value}</p></div>)}</div>
      {rows.some(r => r.spend === null || r.impressions === null || r.clicks === null) && <p className="text-xs text-muted-foreground">Totais parciais: somente valores informados. CTR utiliza campanhas com impressões e cliques preenchidos.</p>}
      <Tabs value={tab} onValueChange={setTab} className="space-y-5"><TabsList className="flex h-auto w-fit max-w-full flex-wrap justify-start"><TabsTrigger value="performance">Desempenho</TabsTrigger><TabsTrigger value="scenario">Simulador</TabsTrigger><TabsTrigger value="records">Campanhas</TabsTrigger><TabsTrigger value="signups">Origem dos cadastros</TabsTrigger></TabsList>
        <TabsContent value="signups"><SignupAttribution from={from} to={to} /></TabsContent>
        <TabsContent value="performance" className="space-y-6">{!rows.length ? <div className="py-14 text-center border-y border-border space-y-3"><h3 className="font-semibold">Nenhuma campanha neste período</h3><Button variant="outline" onClick={startNew}><Plus className="mr-2 h-4 w-4" />Adicionar campanha</Button></div> : <>
          <section className="space-y-3"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Investimento por campanha</h3><Button size="sm" variant="ghost" onClick={() => setTab('records')}>Ver e editar campanhas</Button></div>{rows.some(r => r.spend !== null) ? <ChartContainer config={chartConfig} className="h-64 w-full aspect-auto"><BarChart data={rows.filter(r => r.spend !== null)}><CartesianGrid vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="name" tickLine={false} axisLine={false} tickFormatter={(s:string) => s.length > 20 ? s.slice(0,20)+'…' : s} /><YAxis tickLine={false} axisLine={false} width={65} /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="spend" fill="var(--color-spend)" radius={[3,3,0,0]} /></BarChart></ChartContainer> : <p className="text-muted-foreground py-6">Investimento: Sem dado</p>}</section>
          <section className="space-y-3"><h3 className="font-semibold">Comparativo por canal e objetivo</h3><div className="overflow-x-auto border-y border-border"><Table><TableHeader><TableRow>{['Canal / objetivo','Resultado mensurado','Investimento','Resultados','CPA por resultado','CTR','ROAS'].map(h => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{groups.map(g => <TableRow key={g.key}><TableCell className="min-w-40"><p className="font-medium">{g.channel}</p><p className="text-xs text-muted-foreground">{objectiveLabel(g.objective)} · {g.rows.length} campanhas</p>{g.partial && <Badge variant="outline">Dados parciais</Badge>}</TableCell><TableCell>{g.metric}</TableCell><TableCell className="whitespace-nowrap">{value(g.spend,money)}</TableCell><TableCell>{value(g.results)}</TableCell><TableCell className="whitespace-nowrap">{value(g.cpa,money)}</TableCell><TableCell>{value(g.ctr,percent)}</TableCell><TableCell>{value(g.roas,n => `${n.toFixed(2)}x`)}</TableCell></TableRow>)}</TableBody></Table></div><p className="text-xs text-muted-foreground">CPA e ROAS utilizam apenas campanhas com os respectivos pares de dados preenchidos. Objetivos e resultados diferentes não são somados.</p></section>
        </>}</TabsContent>
        <TabsContent value="scenario" className="space-y-5"><div className="flex items-center justify-between"><h3 className="font-semibold">Simulação por objetivo</h3><Button size="sm" variant="ghost" onClick={() => setBudgets({})}>Restaurar</Button></div><p className="text-sm text-muted-foreground">Projeção linear pelo histórico completo de investimento e resultado. Não considera sazonalidade, saturação ou efeitos entre canais.</p>{!groups.length ? <p className="text-muted-foreground py-8">Sem histórico para simular.</p> : <div className="divide-y divide-border">{groups.map(g => {
          const raw = budgets[g.key] ?? (g.pairedSpend?.toFixed(2) ?? '');
          const budget = raw === '' ? null : Number(raw);
          const valid = budget !== null && Number.isFinite(budget) && budget >= 0 && budget <= 100000000;
          const estimate = valid && g.pairedSpend !== null && g.pairedResults !== null ? projectConversions(g.pairedSpend,g.pairedResults,budget) : null;
          return <div key={g.key} className="grid grid-cols-1 md:grid-cols-[1fr_180px_180px] items-center gap-4 py-4"><div className="min-w-0"><p className="font-medium">{g.channel} · {objectiveLabel(g.objective)}</p><p className="text-xs text-muted-foreground">{g.metric} · histórico: {value(g.pairedSpend,money)} / {value(g.pairedResults)} resultados</p>{g.partial && <p className="text-xs text-muted-foreground">Base parcial: campanhas sem dados completos excluídas</p>}</div><div><Label htmlFor={`budget-${g.key}`} className="text-xs">Orçamento (R$)</Label><Input id={`budget-${g.key}`} type="number" min="0" max="100000000" step="0.01" placeholder="Sem dado" value={raw} onChange={e => setBudgets(b => ({...b,[g.key]:e.target.value}))} /></div><div><p className="text-xs text-muted-foreground">{g.metric} estimados</p><p className="text-lg font-semibold">{value(estimate)}</p></div></div>;
        })}</div>}</TabsContent>
        <TabsContent value="records" className="space-y-3"><h3 className="font-semibold">Campanhas · {rows.length}</h3><p className="text-xs text-muted-foreground">Toque no nome de uma campanha para abrir a edição, ou use o botão Editar na própria linha.</p><div className="overflow-x-auto border-y border-border"><Table><TableHeader><TableRow>{['Campanha / período','Canal / objetivo','Resultado mensurado','Resultados','Investimento','CPA','Impressões','Cliques','CTR','Receita'].map(h => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map(r => <TableRow key={r.id}><TableCell className="min-w-64 max-w-96"><button type="button" onClick={() => {setEditing(r);setOpen(true);}} className="font-medium break-words text-left underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">{r.name}</button><p className="text-xs text-muted-foreground whitespace-nowrap">{date(r.start_date)} → {r.end_date ? date(r.end_date) : 'Ongoing'}</p>{r.notes && <p className="mt-2 text-xs text-muted-foreground break-words whitespace-pre-wrap">{r.notes}</p>}<div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" aria-label={`Editar ${r.name}`} onClick={() => {setEditing(r);setOpen(true);}}><Pencil className="mr-2 h-4 w-4" />Editar</Button><Button size="sm" variant="ghost" aria-label={`Excluir ${r.name}`} disabled={remove.isPending} onClick={() => {if(confirm(`Excluir a campanha ${r.name}?`))remove.mutate(r.id);}}><Trash2 className="mr-2 h-4 w-4 text-destructive" />Excluir</Button></div></TableCell><TableCell className="min-w-36">{r.channel}<p className="text-xs text-muted-foreground">{objectiveLabel(r.objective)}</p></TableCell><TableCell>{r.result_metric}</TableCell><TableCell>{value(r.results)}</TableCell><TableCell className="whitespace-nowrap">{value(r.spend,money)}</TableCell><TableCell className="whitespace-nowrap">{value(costPerResult(r.spend,r.results),money)}</TableCell><TableCell>{value(r.impressions)}</TableCell><TableCell>{value(r.clicks)}</TableCell><TableCell>{value(clickThroughRate(r.impressions,r.clicks),percent)}</TableCell><TableCell className="whitespace-nowrap">{value(r.revenue,money)}</TableCell></TableRow>)}{!rows.length && <TableRow><TableCell colSpan={10} className="py-8 text-center text-muted-foreground">Nenhuma campanha neste período.</TableCell></TableRow>}</TableBody></Table></div></TabsContent>
      </Tabs>
    </>}
    <Dialog open={open} onOpenChange={v => {if(!v && !save.isPending)close();}}><DialogContent className="z-[60] max-w-2xl max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{editing ? 'Editar campanha' : 'Nova campanha'}</DialogTitle><DialogDescription>Período, objetivo e resultados da campanha</DialogDescription></DialogHeader>{open && <CampaignForm key={editing?.id ?? 'new'} campaign={editing} pending={save.isPending} onSave={f => save.mutate(f)} onCancel={close} />}</DialogContent></Dialog>
  </div>;
}

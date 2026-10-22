import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { campaignChannels, campaignObjectives, campaignPeriodValid, metricValid, optionalMetric, costPerResult, clickThroughRate, type MarketingCampaign } from '@/lib/marketingCampaigns';

export interface CampaignInput {
  id: string | null; name: string; start: string; end: string | null; channel: string; objective: string; metric: string;
  spend: number | null; results: number | null; revenue: number | null; impressions: number | null; clicks: number | null; notes: string;
}
const money = (n: number) => n.toLocaleString('pt-BR', { style:'currency',currency:'BRL' });
function CampaignDate({ id, value, onChange, disabled }: { id: string; value: string; onChange: (v: string) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const date = value ? new Date(`${value}T12:00:00`) : undefined;
  return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button id={id} type="button" variant="outline" disabled={disabled} className="w-full justify-start font-normal"><CalendarIcon className="mr-2 h-4 w-4" />{date ? format(date,'dd/MM/yyyy') : 'Selecionar data'}</Button></PopoverTrigger><PopoverContent align="start" className="z-[70] w-auto p-0"><Calendar mode="single" selected={date} defaultMonth={date} onSelect={d => { if (d) { onChange(format(d,'yyyy-MM-dd')); setOpen(false); } }} initialFocus className="p-3 pointer-events-auto" /></PopoverContent></Popover>;
}
export default function CampaignForm({ campaign, pending, onSave, onCancel }: { campaign: MarketingCampaign | null; pending: boolean; onSave: (input: CampaignInput) => void; onCancel: () => void }) {
  const [form, setForm] = useState(() => ({ name:campaign?.name ?? '', start:campaign?.start_date ?? format(new Date(),'yyyy-MM-dd'), end:campaign?.end_date ?? '', ongoing:campaign ? campaign.end_date === null : true, channel:campaign?.channel ?? '', objective:campaign?.objective ?? '', metric:campaign?.result_metric ?? '', spend:campaign?.spend?.toString() ?? '', results:campaign?.results?.toString() ?? '', revenue:campaign?.revenue?.toString() ?? '', impressions:campaign?.impressions?.toString() ?? '', clicks:campaign?.clicks?.toString() ?? '', notes:campaign?.notes ?? '' }));
  const update = (key: string, value: string) => setForm(f => ({...f,[key]:value}));
  const objective = campaignObjectives.find(o => o.value === form.objective);
  const metrics = [...new Set([...(objective?.metrics ?? []), ...(campaign?.objective === form.objective ? [campaign.result_metric] : [])])];
  const channels = [...new Set([...campaignChannels, ...(campaign ? [campaign.channel] : [])])];
  const valid = !!form.name.trim() && !!form.channel && !!objective && !!form.metric.trim() && campaignPeriodValid(form.start,form.end,form.ongoing) && ['spend','revenue'].every(k => metricValid(form[k as 'spend' | 'revenue'])) && ['results','impressions','clicks'].every(k => metricValid(form[k as 'results' | 'impressions' | 'clicks'],true));
  const cpa = costPerResult(optionalMetric(form.spend),optionalMetric(form.results));
  const ctr = clickThroughRate(optionalMetric(form.impressions),optionalMetric(form.clicks));
  return <form className="space-y-5" onSubmit={e => { e.preventDefault(); if (valid) onSave({id:campaign?.id ?? null,name:form.name.trim(),start:form.start,end:form.ongoing ? null : form.end,channel:form.channel,objective:form.objective,metric:form.metric.trim(),spend:optionalMetric(form.spend),results:optionalMetric(form.results),revenue:optionalMetric(form.revenue),impressions:optionalMetric(form.impressions),clicks:optionalMetric(form.clicks),notes:form.notes}); }}>
    <div><Label htmlFor="campaign-name">Nome da campanha</Label><Input id="campaign-name" required maxLength={120} value={form.name} disabled={pending} onChange={e => update('name',e.target.value)} /></div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div><Label htmlFor="campaign-start">Data de início</Label><CampaignDate id="campaign-start" value={form.start} disabled={pending} onChange={v => update('start',v)} /></div><div><Label htmlFor="campaign-end">Data de término</Label><CampaignDate id="campaign-end" value={form.end} disabled={pending || form.ongoing} onChange={v => update('end',v)} /></div></div>
    <div className="flex items-center gap-3"><Switch id="campaign-ongoing" checked={form.ongoing} disabled={pending} onCheckedChange={v => setForm(f => ({...f,ongoing:v,end:v ? '' : f.end}))} /><Label htmlFor="campaign-ongoing">Campanha ongoing · sem data de término</Label></div>
    {!form.ongoing && form.end && form.end < form.start && <p className="text-sm text-destructive">O término deve ser igual ou posterior ao início.</p>}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div><Label htmlFor="campaign-channel">Canal</Label><Select value={form.channel} onValueChange={v => update('channel',v)} disabled={pending}><SelectTrigger id="campaign-channel"><SelectValue placeholder="Selecionar canal" /></SelectTrigger><SelectContent className="z-[70]">{channels.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="campaign-objective">Objetivo da campanha</Label><Select value={form.objective} disabled={pending} onValueChange={v => setForm(f => ({...f,objective:v,metric:campaignObjectives.find(o => o.value === v)?.metrics[0] ?? '',results:''}))}><SelectTrigger id="campaign-objective"><SelectValue placeholder="Selecionar objetivo" /></SelectTrigger><SelectContent className="z-[70]">{campaignObjectives.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div></div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div><Label htmlFor="campaign-metric">Resultado mensurado</Label>{form.objective === 'other' ? <Input id="campaign-metric" required maxLength={80} value={form.metric} disabled={pending} onChange={e => update('metric',e.target.value)} /> : <Select key={form.objective} value={form.metric} disabled={pending || !objective} onValueChange={v => { if (v) setForm(f => ({...f,metric:v,results:''})); }}><SelectTrigger id="campaign-metric"><SelectValue placeholder="Selecionar resultado" /></SelectTrigger><SelectContent className="z-[70]">{metrics.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>}</div><div><Label htmlFor="campaign-results">Resultados · {form.metric || 'quantidade'}</Label><Input id="campaign-results" type="number" min="0" max="100000000" step="1" placeholder="Sem dado" disabled={pending} value={form.results} onChange={e => update('results',e.target.value)} /></div></div>
    <div className="grid grid-cols-2 gap-4">{([{key:'spend',label:'Investimento (R$)',step:'0.01'},{key:'revenue',label:'Receita (R$)',step:'0.01'},{key:'impressions',label:'Impressões',step:'1'},{key:'clicks',label:'Cliques',step:'1'}] as const).map(field => <div key={field.key}><Label htmlFor={`campaign-${field.key}`}>{field.label}</Label><Input id={`campaign-${field.key}`} type="number" min="0" max="100000000" step={field.step} placeholder="Sem dado" disabled={pending} value={form[field.key]} onChange={e => update(field.key,e.target.value)} /></div>)}</div>
    <div className="flex flex-wrap gap-x-8 gap-y-2 border-y border-border py-3 text-sm"><span>CPA · {form.metric || 'resultado'}: <strong>{cpa === null ? 'Sem dado' : money(cpa)}</strong></span><span>CTR: <strong>{ctr === null ? 'Sem dado' : `${ctr.toLocaleString('pt-BR',{maximumFractionDigits:2})}%`}</strong></span></div>
    <div><Label htmlFor="campaign-notes">Observações</Label><Textarea id="campaign-notes" rows={3} maxLength={2000} disabled={pending} value={form.notes} onChange={e => update('notes',e.target.value)} /><p className="text-right text-xs text-muted-foreground">{form.notes.length}/2000</p></div>
    <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={pending} onClick={onCancel}>Cancelar</Button><Button type="submit" disabled={!valid || pending}>{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar campanha</Button></div>
  </form>;
}
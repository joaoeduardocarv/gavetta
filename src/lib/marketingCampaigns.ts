export const campaignChannels = ['Meta Ads', 'Google Ads', 'Orgânico', 'TikTok Ads', 'Boost post', 'UGC', 'YouTube Ads', 'LinkedIn Ads', 'Email marketing', 'Influenciadores', 'Outros'];
export const campaignObjectives = [
  { value: 'awareness', label: 'Reconhecimento', metrics: ['Pessoas alcançadas', 'Impressões'] },
  { value: 'traffic', label: 'Tráfego', metrics: ['Cliques', 'Visitas à página'] },
  { value: 'engagement', label: 'Engajamento', metrics: ['Interações', 'Curtidas', 'Comentários', 'Compartilhamentos'] },
  { value: 'leads', label: 'Leads', metrics: ['Leads'] },
  { value: 'signups', label: 'Cadastros', metrics: ['Cadastros concluídos'] },
  { value: 'sales', label: 'Vendas', metrics: ['Compras'] },
  { value: 'video', label: 'Visualizações de vídeo', metrics: ['Visualizações de vídeo', 'Vídeos completos'] },
  { value: 'other', label: 'Outro', metrics: ['Conversões'] },
];
export interface MarketingCampaign {
  id: string; name: string; start_date: string; end_date: string | null; channel: string;
  objective: string; result_metric: string; spend: number | null; results: number | null;
  revenue: number | null; impressions: number | null; clicks: number | null; notes: string | null;
}
export const objectiveLabel = (value: string) => campaignObjectives.find(o => o.value === value)?.label ?? value;
export function optionalMetric(value: string): number | null { return value.trim() === '' ? null : Number(value); }
export function costPerResult(spend: number | null, results: number | null): number | null {
  return spend !== null && results !== null && results > 0 ? spend / results : null;
}
export function clickThroughRate(impressions: number | null, clicks: number | null): number | null {
  return impressions !== null && impressions > 0 && clicks !== null ? clicks / impressions * 100 : null;
}
export function sumKnown(values: (number | null)[]): number | null {
  const known = values.filter((v): v is number => v !== null);
  return known.length ? known.reduce((a, b) => a + Number(b), 0) : null;
}
export function campaignPeriodValid(start: string, end: string, ongoing: boolean) {
  const valid = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(new Date(`${d}T12:00:00Z`).getTime()) && new Date(`${d}T12:00:00Z`).toISOString().slice(0, 10) === d;
  return valid(start) && (ongoing || (valid(end) && end >= start));
}
export function metricValid(value: string, integer = false) {
  const n = optionalMetric(value);
  return n === null || (Number.isFinite(n) && n >= 0 && n <= 100000000 && (!integer || Number.isInteger(n)));
}
export function summarizeCampaigns(rows: MarketingCampaign[]) {
  const groups = new Map<string, { key: string; channel: string; objective: string; metric: string; rows: MarketingCampaign[] }>();
  for (const r of rows) {
    const key = JSON.stringify([r.channel, r.objective, r.result_metric]);
    const g = groups.get(key) ?? { key, channel: r.channel, objective: r.objective, metric: r.result_metric, rows: [] };
    g.rows.push(r); groups.set(key, g);
  }
  return [...groups.values()].map(g => {
    const paired = g.rows.filter(r => r.spend !== null && r.results !== null);
    const spend = sumKnown(g.rows.map(r => r.spend)), results = sumKnown(g.rows.map(r => r.results));
    const pairedSpend = sumKnown(paired.map(r => r.spend)), pairedResults = sumKnown(paired.map(r => r.results));
    const traffic = g.rows.filter(r => r.impressions !== null && r.clicks !== null);
    const revenuePairs = g.rows.filter(r => r.spend !== null && r.revenue !== null);
    const revenueSpend = sumKnown(revenuePairs.map(r => r.spend));
    const revenue = sumKnown(revenuePairs.map(r => r.revenue));
    return { ...g, spend, results, pairedSpend, pairedResults, cpa: costPerResult(pairedSpend, pairedResults),
      ctr: clickThroughRate(sumKnown(traffic.map(r => r.impressions)), sumKnown(traffic.map(r => r.clicks))),
      roas: revenueSpend !== null && revenueSpend > 0 && revenue !== null ? revenue / revenueSpend : null,
      partial: g.rows.some(r => r.spend === null || r.results === null) };
  });
}
import { describe, expect, it } from 'vitest';
import { optionalMetric, costPerResult, clickThroughRate, campaignPeriodValid, metricValid, sumKnown, summarizeCampaigns, resultMetricsFor, type MarketingCampaign } from './marketingCampaigns';
const row: MarketingCampaign = { id:'1', name:'Campanha', start_date:'2026-10-01', end_date:null, channel:'Meta Ads', objective:'signups', result_metric:'Cadastros concluídos', spend:200, results:10, revenue:null, reach:null, impressions:1000, clicks:20, notes:null };
describe('campaign metrics and periods', () => {
  it('stores omitted numbers as null, not zero', () => { expect(optionalMetric('')).toBeNull(); expect(optionalMetric('0')).toBe(0); });
  it('allows ongoing campaigns without an end date', () => expect(campaignPeriodValid('2026-10-01','',true)).toBe(true));
  it('requires an end date for finished campaigns', () => expect(campaignPeriodValid('2026-10-01','',false)).toBe(false));
  it('rejects end dates before the start', () => expect(campaignPeriodValid('2026-10-10','2026-10-01',false)).toBe(false));
  it('calculates CPA from measured results', () => expect(costPerResult(200,10)).toBe(20));
  it('does not calculate CPA for absent results', () => expect(costPerResult(200,null)).toBeNull());
  it('calculates CTR as clicks divided by impressions', () => expect(clickThroughRate(1000,20)).toBe(2));
  it('does not invent CTR when clicks are omitted', () => expect(clickThroughRate(1000,null)).toBeNull());
  it('keeps an explicit zero CTR', () => expect(clickThroughRate(1000,0)).toBe(0));
  it('does not divide by zero impressions', () => expect(clickThroughRate(0,20)).toBeNull());
  it('keeps omitted aggregate data absent', () => expect(sumKnown([null,null])).toBeNull());
  it('keeps objectives separate', () => expect(summarizeCampaigns([row,{...row,id:'2',objective:'traffic',result_metric:'Cliques'}])).toHaveLength(2));
  it('excludes unpaired investment from CPA', () => { const g = summarizeCampaigns([row,{...row,id:'2',spend:800,results:null}])[0]; expect(g.cpa).toBe(20); expect(g.partial).toBe(true); });
  it('allows blank optional metrics', () => expect(metricValid('',true)).toBe(true));
  it('rejects fractional result counts', () => expect(metricValid('2.5',true)).toBe(false));
  it('offers leads, signups and engagement for any objective', () => {
    const m = resultMetricsFor('awareness');
    expect(m[0]).toBe('Pessoas alcançadas');
    ['Leads','Cadastros','Engajamento','Seguidores'].forEach(x => expect(m).toContain(x));
  });
  it('keeps a previously saved result selectable', () => expect(resultMetricsFor('traffic','Seguidores')).toContain('Seguidores'));
  it('lists each result option once', () => { const m = resultMetricsFor('engagement'); expect(m).toHaveLength(new Set(m).size); });
  it('offers Visitar ao Perfil as an objective with its own metric', () => {
    const o = campaignObjectives.find(x => x.label === 'Visitar ao Perfil');
    expect(o?.value).toBe('profile_visit');
    expect(resultMetricsFor('profile_visit')).toContain('Visitas ao perfil');
  });
  it('offers visitas ao perfil as a result for any objective', () => expect(resultMetricsFor('sales')).toContain('Visitas ao perfil'));
});
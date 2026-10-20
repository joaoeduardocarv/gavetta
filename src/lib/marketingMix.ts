export interface MarketingObservation {
  id: string;
  week_start: string;
  channel: string;
  spend: number;
  conversions: number;
  revenue: number;
}

export function mondayOf(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

export function summarizeMarketing(rows: MarketingObservation[]) {
  const grouped = new Map<string, { channel: string; spend: number; conversions: number; revenue: number; weeks: Set<string> }>();
  for (const row of rows) {
    const group = grouped.get(row.channel) ?? { channel: row.channel, spend: 0, conversions: 0, revenue: 0, weeks: new Set<string>() };
    group.spend += Number(row.spend);
    group.conversions += Number(row.conversions);
    group.revenue += Number(row.revenue);
    group.weeks.add(row.week_start);
    grouped.set(row.channel, group);
  }
  return [...grouped.values()].map((g) => ({
    ...g, weeks: g.weeks.size,
    cpa: g.conversions > 0 ? g.spend / g.conversions : null,
    roas: g.spend > 0 ? g.revenue / g.spend : null,
  })).sort((a, b) => b.spend - a.spend);
}

// Descriptive historical ratio only: not a causal or fitted MMM model.
export function projectConversions(spend: number, conversions: number, budget: number): number | null {
  if (spend <= 0 || conversions <= 0 || !Number.isFinite(budget) || budget < 0) return null;
  return budget * conversions / spend;
}

export function validMarketingInput(spend: number, conversions: number, revenue: number) {
  return [spend, conversions, revenue].every((n) => Number.isFinite(n) && n >= 0 && n <= 100000000) && Number.isInteger(conversions);
}
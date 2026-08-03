// Date helpers shared by the notification checker.
// `now` is injectable so the behaviour can be unit-tested deterministically.

/** Data "hoje" no fuso do Brasil (UTC-3), formato YYYY-MM-DD */
export function brToday(now: number = Date.now()): string {
  const d = new Date(now - 3 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

/**
 * Dias inteiros entre hoje (BR) e uma data YYYY-MM-DD. 0 = hoje, 7 = daqui a 7 dias.
 * Retorna NaN para datas ausentes ou inválidas.
 */
export function daysUntil(dateStr: string | null | undefined, now: number = Date.now()): number {
  if (!dateStr) return Number.NaN;
  const target = Date.parse(`${dateStr.slice(0, 10)}T00:00:00Z`);
  const today = Date.parse(`${brToday(now)}T00:00:00Z`);
  if (Number.isNaN(target)) return Number.NaN;
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

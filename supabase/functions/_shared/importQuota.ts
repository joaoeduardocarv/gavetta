export const FREE_MONTHLY_IMPORT_LIMIT = 5;

/**
 * Espelha `src/lib/gavettaPlus.ts`: enquanto `false`, apenas admins
 * recebem as regras do Gavetta+ (usuários comuns não sofrem alteração).
 */
export const GAVETTA_PLUS_ENABLED = false;

export type ImportKind = "text" | "podcast";

export interface MonthWindow {
  monthStartIso: string;
  resetsAtIso: string;
}

export function getCurrentMonthWindow(now: Date = new Date()): MonthWindow {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const next = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0));
  return {
    monthStartIso: start.toISOString(),
    resetsAtIso: next.toISOString(),
  };
}

export type QuotaDecision =
  | { allowed: true }
  | { allowed: false; code: "PODCAST_PREMIUM_ONLY" }
  | {
      allowed: false;
      code: "IMPORT_QUOTA";
      used: number;
      limit: number;
      resets_at: string;
    };

export function evaluateImportQuota(params: {
  used: number;
  isPremium: boolean;
  enforce: boolean;
  kind: ImportKind;
  resetsAtIso: string;
  limit?: number;
}): QuotaDecision {
  const limit = params.limit ?? FREE_MONTHLY_IMPORT_LIMIT;
  if (!params.enforce || params.isPremium) {
    return { allowed: true };
  }
  if (params.kind === "podcast") {
    return { allowed: false, code: "PODCAST_PREMIUM_ONLY" };
  }
  if (params.used >= limit) {
    return {
      allowed: false,
      code: "IMPORT_QUOTA",
      used: params.used,
      limit,
      resets_at: params.resetsAtIso,
    };
  }
  return { allowed: true };
}

export function shouldEnforceGavettaPlus(isAdmin: boolean, flag = GAVETTA_PLUS_ENABLED): boolean {
  return flag || isAdmin;
}
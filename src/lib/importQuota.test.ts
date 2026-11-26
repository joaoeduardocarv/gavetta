import { describe, it, expect } from "vitest";
import {
  FREE_MONTHLY_IMPORT_LIMIT,
  evaluateImportQuota,
  getCurrentMonthWindow,
  shouldEnforceGavettaPlus,
} from "../../supabase/functions/_shared/importQuota";

describe("regras de cota mensal de importação", () => {
  const resetsAtIso = "2026-12-01T00:00:00.000Z";

  it("define o limite grátis como 5 importações por mês", () => {
    expect(FREE_MONTHLY_IMPORT_LIMIT).toBe(5);
  });

  it("permite importação de texto para grátis abaixo de 5 usos no mês", () => {
    expect(
      evaluateImportQuota({
        used: 4,
        isPremium: false,
        enforce: true,
        kind: "text",
        resetsAtIso,
      }),
    ).toEqual({ allowed: true });
  });

  it("bloqueia importação de texto para grátis ao atingir 5 usos com IMPORT_QUOTA", () => {
    expect(
      evaluateImportQuota({
        used: 5,
        isPremium: false,
        enforce: true,
        kind: "text",
        resetsAtIso,
      }),
    ).toEqual({
      allowed: false,
      code: "IMPORT_QUOTA",
      used: 5,
      limit: 5,
      resets_at: resetsAtIso,
    });
  });

  it("bloqueia transcrição de podcast para plano grátis mesmo com 0 usos", () => {
    expect(
      evaluateImportQuota({
        used: 0,
        isPremium: false,
        enforce: true,
        kind: "podcast",
        resetsAtIso,
      }),
    ).toEqual({
      allowed: false,
      code: "PODCAST_PREMIUM_ONLY",
    });
  });

  it("libera texto ilimitado e podcast para assinantes is_premium", () => {
    expect(
      evaluateImportQuota({
        used: 50,
        isPremium: true,
        enforce: true,
        kind: "text",
        resetsAtIso,
      }),
    ).toEqual({ allowed: true });

    expect(
      evaluateImportQuota({
        used: 50,
        isPremium: true,
        enforce: true,
        kind: "podcast",
        resetsAtIso,
      }),
    ).toEqual({ allowed: true });
  });

  it("não altera nada para usuário comum quando GAVETTA_PLUS_ENABLED está desligada", () => {
    expect(shouldEnforceGavettaPlus(false, false)).toBe(false);
    expect(shouldEnforceGavettaPlus(true, false)).toBe(true);
    expect(shouldEnforceGavettaPlus(false, true)).toBe(true);

    expect(
      evaluateImportQuota({
        used: 20,
        isPremium: false,
        enforce: false,
        kind: "text",
        resetsAtIso,
      }),
    ).toEqual({ allowed: true });

    expect(
      evaluateImportQuota({
        used: 20,
        isPremium: false,
        enforce: false,
        kind: "podcast",
        resetsAtIso,
      }),
    ).toEqual({ allowed: true });
  });

  it("calcula corretamente o início e a renovação do mês (incluindo virada de ano)", () => {
    expect(getCurrentMonthWindow(new Date("2026-11-26T12:40:00.000Z"))).toEqual({
      monthStartIso: "2026-11-01T00:00:00.000Z",
      resetsAtIso: "2026-12-01T00:00:00.000Z",
    });
    expect(getCurrentMonthWindow(new Date("2026-12-15T10:00:00.000Z"))).toEqual({
      monthStartIso: "2026-12-01T00:00:00.000Z",
      resetsAtIso: "2027-01-01T00:00:00.000Z",
    });
  });
});
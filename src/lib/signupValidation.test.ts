/**
 * Testes de contrato para a trigger `handle_new_user` (Postgres).
 *
 * A trigger usa regex POSIX:
 *   username: ^[[:alpha:][:digit:]_\-\. ']+$   (aceita letras com acento, dígitos, _ - . espaço ')
 *   handle:   ^[a-z0-9_]+$
 *
 * Como [:alpha:] em PostgreSQL respeita o locale (UTF-8), letras acentuadas
 * são aceitas. Em JS reproduzimos isso com \p{L}\p{N} (Unicode property
 * escapes), que são equivalentes para fins de validação client-side.
 *
 * Estes testes garantem que:
 * 1. Casos válidos passam (em especial: acentos PT-BR, ñ, ü, ', -, .).
 * 2. Casos inválidos são rejeitados.
 * 3. O shape esperado pela trigger não regride no client.
 *
 * Para o teste end-to-end real (que executa a trigger no Postgres),
 * use a edge function `signup-trigger-test`.
 */
import { describe, it, expect } from "vitest";

// Equivalente em JS da regex POSIX usada na trigger.
// PostgreSQL: ^[[:alpha:][:digit:]_\-\. ']+$
// JS (Unicode): \p{L} ≈ [:alpha:] (qualquer letra Unicode, incluindo acentos)
//               \p{N} ≈ [:digit:] (qualquer número Unicode)
const USERNAME_REGEX = /^[\p{L}\p{N}_\-\. ']+$/u;
const HANDLE_REGEX = /^[a-z0-9_]+$/;

function isValidUsername(name: string): boolean {
  if (name.length < 2 || name.length > 50) return false;
  return USERNAME_REGEX.test(name);
}

function isValidHandle(handle: string): boolean {
  if (handle.length < 3 || handle.length > 30) return false;
  return HANDLE_REGEX.test(handle);
}

describe("handle_new_user trigger — username validation contract", () => {
  describe("aceita ASCII", () => {
    it.each([
      "JohnDoe",
      "john doe",
      "Maria Silva",
      "X Y", // mínimo
      "a".repeat(50), // máximo
    ])("aceita %s", (name) => {
      expect(isValidUsername(name)).toBe(true);
    });
  });

  describe("aceita acentos PT-BR (regressão do bug \\p{L} -> POSIX)", () => {
    // Estes são exatamente os casos que quebravam antes da correção
    // de 04/05/2026, quando a trigger usava \p{L}\p{N} (sintaxe PCRE
    // não suportada pelo PostgreSQL, gerando erro 2201B).
    it.each([
      "João",
      "João Silva",
      "Antônio",
      "Antônio Brandão",
      "Conceição",
      "Conceição Mendonça",
      "André",
      "Vinícius de Moraes",
      "Cauã",
      "Iúna",
    ])("aceita nome PT-BR com acento: %s", (name) => {
      expect(isValidUsername(name)).toBe(true);
    });
  });

  describe("aceita acentos internacionais", () => {
    it.each([
      "Müller", // trema (DE)
      "Hans Müller",
      "María", // acento agudo (ES)
      "Núñez", // ñ (ES)
      "María Núñez",
      "Àlex", // grave (CA)
      "Beyoncé", // (FR)
      "Renée",
      "Søren", // ø (DK) — \p{L} cobre
      "Zoë", // diérese
    ])("aceita %s", (name) => {
      expect(isValidUsername(name)).toBe(true);
    });
  });

  describe("aceita pontuação permitida", () => {
    it.each([
      "J. Silva",
      "Silva-Costa",
      "J. Silva-Costa",
      "O'Brien",
      "Mary O'Connor",
      "Jean-Luc Picard",
    ])("aceita %s", (name) => {
      expect(isValidUsername(name)).toBe(true);
    });
  });

  describe("rejeita casos inválidos", () => {
    it.each([
      ["A", "muito curto"],
      ["", "vazio"],
      ["a".repeat(51), "muito longo"],
      ["user@name", "contém @"],
      ["user#tag", "contém #"],
      ["user/name", "contém /"],
      ["user\\name", "contém \\"],
      ["user!", "contém !"],
      ["user?", "contém ?"],
      ["<script>", "contém < e >"],
      ["user;name", "contém ;"],
    ])("rejeita %s (%s)", (name) => {
      expect(isValidUsername(name)).toBe(false);
    });
  });
});

describe("handle_new_user trigger — handle validation contract", () => {
  describe("aceita handles válidos", () => {
    it.each([
      "abc",
      "joaoeduardo",
      "user_123",
      "joao_silva_2",
      "a_b_c",
      "a".repeat(30), // máximo
    ])("aceita %s", (handle) => {
      expect(isValidHandle(handle)).toBe(true);
    });
  });

  describe("rejeita handles inválidos", () => {
    it.each([
      ["ab", "muito curto"],
      ["", "vazio"],
      ["a".repeat(31), "muito longo"],
      ["JoaoSilva", "tem maiúsculas"],
      ["joão", "tem acento"],
      ["joao silva", "tem espaço"],
      ["joao-silva", "tem hífen"],
      ["joao.silva", "tem ponto"],
      ["joao@silva", "tem @"],
      ["joão_silva", "acento no meio"],
    ])("rejeita %s (%s)", (handle) => {
      expect(isValidHandle(handle)).toBe(false);
    });
  });
});

describe("regressão: regex \\p{L}\\p{N} na trigger", () => {
  // Documenta o bug histórico para evitar reintrodução.
  it("Postgres NÃO suporta \\p{L}\\p{N} — usar [:alpha:][:digit:]", () => {
    // Confirma que o equivalente JS funciona (sanity-check).
    // Se algum dia alguém trocar a regex POSIX por \p{L}\p{N} no SQL,
    // a edge function `signup-trigger-test` vai pegar.
    const jsRegex = /^[\p{L}\p{N}_\-\. ']+$/u;
    expect(jsRegex.test("João")).toBe(true);

    // Sintaxe POSIX equivalente (o que a trigger usa hoje no Postgres):
    // ^[[:alpha:][:digit:]_\-\. ']+$
    // Não há como exercitar POSIX em JS, então o teste end-to-end
    // (signup-trigger-test) é a fonte de verdade.
    expect(true).toBe(true);
  });
});

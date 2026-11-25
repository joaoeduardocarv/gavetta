import { describe, it, expect } from "vitest";
import { isValidCpf, stripCpf } from "../../supabase/functions/billing-checkout/cpf";

describe("validação de CPF do billing-checkout", () => {
  it("aceita CPFs válidos com ou sem pontuação", () => {
    expect(isValidCpf("52998224725")).toBe(true);
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("11144477735")).toBe(true);
    expect(stripCpf("529.982.247-25")).toBe("52998224725");
  });

  it("rejeita CPFs com dígitos verificadores inválidos", () => {
    expect(isValidCpf("52998224726")).toBe(false);
    expect(isValidCpf("52998224715")).toBe(false);
  });

  it("rejeita CPFs com todos os dígitos iguais ou tamanho incorreto", () => {
    expect(isValidCpf("00000000000")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("123456789")).toBe(false);
    expect(isValidCpf("")).toBe(false);
  });
});
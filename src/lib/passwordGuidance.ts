export const PASSWORD_HELP =
  "Use 6 ou mais caracteres. Pode ser uma frase ou combinação pessoal e incomum.";

export function getPasswordErrorMessage(message: string): string {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("weak") ||
    normalized.includes("pwned") ||
    normalized.includes("known") ||
    normalized.includes("leaked")
  ) {
    return "Essa senha apareceu em vazamentos conhecidos. Escolha outra combinação única; não é obrigatório adicionar símbolos ou números.";
  }

  if (normalized.includes("password should be at least")) {
    return "Use pelo menos 6 caracteres.";
  }

  return "Não foi possível salvar essa senha. Tente outra combinação pessoal e incomum.";
}
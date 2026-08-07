/**
 * Camada de segurança de cadastro: bloqueia emails descartáveis, domínios
 * reservados/de teste e endereços "de função" (noreply, admin, test...).
 *
 * A mesma lista é replicada na trigger `handle_new_user` (Postgres) para que
 * a regra valha mesmo se alguém chamar a API diretamente (defesa em profundidade).
 *
 * Não muda a experiência do usuário legítimo: só dispara mensagem de erro
 * quando o email é claramente inválido/descartável.
 */

// TLDs reservados pela IANA (RFC 2606/6761) — nunca recebem email de verdade.
export const BLOCKED_TLDS = [
  "test",
  "example",
  "invalid",
  "localhost",
  "local",
  "internal",
  "lan",
  "example.com",
  "example.org",
  "example.net",
];

// Serviços de email temporário/descartável mais usados.
export const DISPOSABLE_DOMAINS = new Set([
  "10minutemail.com", "10minutemail.net", "20minutemail.com", "33mail.com",
  "anonbox.net", "armyspy.com", "burnermail.io", "cuvox.de", "dayrep.com",
  "discard.email", "dispostable.com", "einrot.com", "emailondeck.com",
  "emailtemporario.com.br", "fakeinbox.com", "fakemail.net", "fleckens.hu",
  "getairmail.com", "getnada.com", "grr.la", "guerrillamail.com",
  "guerrillamail.info", "guerrillamail.net", "guerrillamail.org",
  "guerrillamailblock.com", "harakirimail.com", "inboxbear.com",
  "inboxkitten.com", "jetable.org", "mail-temporaire.fr", "mail7.io",
  "mailcatch.com", "maildrop.cc", "mailinator.com", "mailnesia.com",
  "mailsac.com", "mintemail.com", "moakt.com", "mohmal.com", "mytemp.email",
  "nada.email", "one-time.email", "opayq.com", "pokemail.net", "rhyta.com",
  "sharklasers.com", "spam4.me", "spambog.com", "spamgourmet.com",
  "superrito.com", "teleworm.us", "temp-mail.io", "temp-mail.org",
  "tempail.com", "tempinbox.com", "tempm.com", "tempmail.com",
  "tempmail.net", "tempmailo.com", "tempr.email", "throwawaymail.com",
  "tmail.ws", "trashmail.com", "trashmail.de", "trbvm.com", "vomoto.com",
  "yopmail.com", "yopmail.fr", "yopmail.net", "zetmail.com",
]);

// Prefixos "de função" — não pertencem a uma pessoa real.
const BLOCKED_LOCAL_PARTS = new Set([
  "noreply", "no-reply", "donotreply", "do-not-reply", "postmaster",
  "mailer-daemon", "abuse", "spam", "test", "teste", "testing", "example",
  "asdf", "aaaa", "qwerty",
]);

export type EmailPolicyResult = { ok: true } | { ok: false; reason: string };

export function checkEmailPolicy(rawEmail: string): EmailPolicyResult {
  const email = rawEmail.trim().toLowerCase();

  const match = email.match(/^([^\s@]+)@([^\s@]+\.[^\s@]+)$/);
  if (!match) return { ok: false, reason: "Email inválido" };

  const [, localPart, domain] = match;

  const labels = domain.split(".");
  const tld = labels[labels.length - 1];

  if (BLOCKED_TLDS.includes(tld) || BLOCKED_TLDS.includes(domain)) {
    return { ok: false, reason: "Use um endereço de email real — este domínio não recebe emails." };
  }

  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { ok: false, reason: "Emails temporários/descartáveis não são aceitos. Use seu email pessoal." };
  }

  // Domínios que só existem para descartar (subdomínios de serviços conhecidos)
  for (const d of DISPOSABLE_DOMAINS) {
    if (domain.endsWith(`.${d}`)) {
      return { ok: false, reason: "Emails temporários/descartáveis não são aceitos. Use seu email pessoal." };
    }
  }

  const baseLocal = localPart.split("+")[0].replace(/\./g, "");
  if (BLOCKED_LOCAL_PARTS.has(localPart.split("+")[0]) || BLOCKED_LOCAL_PARTS.has(baseLocal)) {
    return { ok: false, reason: "Use um email pessoal válido (endereços de teste não são aceitos)." };
  }

  if (domain.length < 4 || labels.length < 2 || tld.length < 2) {
    return { ok: false, reason: "Email inválido" };
  }

  return { ok: true };
}

import type { User } from "@supabase/supabase-js";

const WINDOW_MS = 48 * 60 * 60 * 1000;
const SENT_PREFIX = "oaiq_signup_sent:";

type Oaiq = (...args: unknown[]) => void;

/** Conta nova = criada nas últimas 48h (cobre a confirmação de e-mail feita depois). */
export function isNewAccount(user: Pick<User, "created_at">, now = Date.now()): boolean {
  const created = Date.parse(user.created_at);
  return Number.isFinite(created) && now - created >= 0 && now - created <= WINDOW_MS;
}

/** Envia a conversão de cadastro ao ChatGPT Ads uma única vez por conta. */
export function trackChatGptSignup(user: Pick<User, "id" | "created_at">) {
  try {
    const oaiq = (window as unknown as { oaiq?: Oaiq }).oaiq;
    if (!oaiq || !isNewAccount(user)) return;
    const key = SENT_PREFIX + user.id;
    if (localStorage.getItem(key)) return;
    oaiq("measure", "registration_completed", { type: "customer_action" }, { event_id: `signup-${user.id}` });
    localStorage.setItem(key, "1");
  } catch { /* nunca quebra o login */ }
}

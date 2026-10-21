import { supabase } from "@/integrations/supabase/client";

const KEY = "gavetta:attribution";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const FIELDS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

export type Attribution = Partial<Record<(typeof FIELDS)[number], string>> & {
  landing_path?: string;
  referrer?: string;
  first_seen_at?: string;
};

/** Lê UTMs da URL. Retorna null quando não há utm_source nem utm_campaign. */
export function parseUtm(search: string, path = "/", referrer = ""): Attribution | null {
  const params = new URLSearchParams(search);
  const out: Attribution = {};
  for (const f of FIELDS) {
    const v = params.get(f)?.trim();
    if (v) out[f] = v.slice(0, 200);
  }
  if (!out.utm_source && !out.utm_campaign) return null;
  out.landing_path = path.slice(0, 300);
  if (referrer) out.referrer = referrer.slice(0, 300);
  out.first_seen_at = new Date().toISOString();
  return out;
}

/** Primeiro toque: guarda a primeira campanha vista nos últimos 30 dias. */
export function captureAttribution() {
  try {
    const stored = readStored();
    if (stored) return;
    const found = parseUtm(window.location.search, window.location.pathname, document.referrer);
    if (found) localStorage.setItem(KEY, JSON.stringify(found));
  } catch { /* armazenamento indisponível */ }
}

function readStored(): Attribution | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  const data = JSON.parse(raw) as Attribution;
  if (!data.first_seen_at || Date.now() - Date.parse(data.first_seen_at) > MAX_AGE_MS) {
    localStorage.removeItem(KEY);
    return null;
  }
  return data;
}

/** Envia a campanha para contas recém-criadas; o servidor ignora contas antigas. */
export async function flushAttribution() {
  try {
    const data = readStored();
    if (!data) return;
    const { error } = await supabase.rpc("record_signup_attribution", { _data: data });
    if (!error) localStorage.removeItem(KEY);
  } catch { /* tenta de novo no próximo login */ }
}

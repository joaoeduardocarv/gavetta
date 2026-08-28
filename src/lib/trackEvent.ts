import { supabase } from "@/integrations/supabase/client";

/**
 * Registra um evento leve de uso de funcionalidade (fire-and-forget).
 * Usado para funcionalidades que acontecem apenas no cliente,
 * como a Gavetta Mágica, e que por isso não deixam rastro no banco.
 */
export async function trackFeature(feature: string, label?: string) {
  try {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) return;
    await supabase.from("feature_events").insert({
      user_id: userId,
      feature,
      metadata: label ? { label } : null,
    });
  } catch {
    // silencioso: telemetria nunca pode quebrar a experiência
  }
}

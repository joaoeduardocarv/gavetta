import type { Notification } from "@/hooks/useNotifications";
import { supabase } from "@/integrations/supabase/client";
import { extractTmdbInfoFromId, normalizeStoredContent } from "@/lib/contentNormalizer";
import { getMovieDetails, getTVDetails } from "@/lib/tmdb";
import type { Content } from "@/lib/mockData";
export async function resolveNotificationContent(n: Notification, userId: string): Promise<{ content: Content; comment?: string | null }> {
  if (n.type === "recommendation") {
    let query = supabase.from("recommendations").select("*").eq("receiver_id", userId);
    if (n.event_id) query = query.eq("id", n.event_id);
    else {
      if (!n.related_content_id || !n.related_user_id) throw new Error("Esta indicação não está mais disponível.");
      query = query.eq("production_id", n.related_content_id).eq("sender_id", n.related_user_id).lte("created_at", n.created_at).order("created_at", { ascending: false }).limit(1);
    }
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Esta indicação foi removida ou não está mais disponível.");
    await supabase.from("recommendations").update({ is_read: true }).eq("id", data.id);
    return { content: normalizeStoredContent(data.production_data, { productionId: data.production_id, productionType: data.production_type }), comment: data.comment };
  }
  const parsed = extractTmdbInfoFromId(n.related_content_id || "");
  if (!parsed) throw new Error("Este título não está mais disponível.");
  const { data: stored, error } = await supabase.from("user_drawer_assignments").select("production_id,production_type,production_data").eq("user_id", userId).eq("production_id", n.related_content_id || "").limit(1).maybeSingle();
  if (error) throw error;
  if (stored) return { content: normalizeStoredContent(stored.production_data, { productionId: stored.production_id, productionType: stored.production_type }) };
  const details = parsed.mediaType === "movie" ? await getMovieDetails(parsed.tmdbId) : await getTVDetails(parsed.tmdbId);
  return { content: normalizeStoredContent(details, { productionId: `${parsed.mediaType}-${parsed.tmdbId}`, productionType: parsed.mediaType }) };
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const CONTENT_NOTIFICATION_TYPES = [
  "new_episodes",
  "new_season",
  "upcoming_content",
  "streaming_change",
  "vod_arrival",
];

export interface ContentNotificationInfo {
  type: string;
  title: string;
  message: string | null;
}

export function useContentNotifications() {
  const { user } = useAuth();

  const { data: contentNotifMap = new Map<string, ContentNotificationInfo>() } = useQuery({
    queryKey: ["content-notifications-map", user?.id],
    queryFn: async () => {
      if (!user?.id) return new Map<string, ContentNotificationInfo>();

      const { data, error } = await supabase
        .from("notifications")
        .select("type, title, message, related_content_id, is_read")
        .eq("user_id", user.id)
        .eq("is_read", false)
        .in("type", CONTENT_NOTIFICATION_TYPES)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const map = new Map<string, ContentNotificationInfo>();
      for (const n of data || []) {
        if (n.related_content_id && !map.has(n.related_content_id)) {
          map.set(n.related_content_id, {
            type: n.type,
            title: n.title,
            message: n.message,
          });
        }
      }
      return map;
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const getContentNotification = (contentId: string): ContentNotificationInfo | null => {
    return contentNotifMap.get(contentId) || null;
  };

  return { getContentNotification, contentNotifMap };
}

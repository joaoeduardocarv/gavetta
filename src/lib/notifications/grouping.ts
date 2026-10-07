import type { Notification } from "@/hooks/useNotifications";
import { isToday, isYesterday } from "date-fns";
export const contentTypes = new Set(["streaming_change", "new_season", "new_episodes", "upcoming_content", "rental_arrival", "purchase_arrival"]);
export type InboxFilter = "all" | "content" | "social";
export interface NotificationGroup { id: string; items: Notification[]; dateLabel: string; }
export function groupNotifications(notifications: Notification[], filter: InboxFilter): NotificationGroup[] {
  const groups = new Map<string, NotificationGroup>();
  for (const n of notifications) {
    const content = contentTypes.has(n.type);
    if ((filter === "content" && !content) || (filter === "social" && content)) continue;
    const date = new Date(n.created_at);
    const day = date.toDateString();
    const canGroup = n.type === "activity_like" || ["streaming_change", "rental_arrival", "purchase_arrival"].includes(n.type);
    const key = canGroup && n.related_content_id ? `${n.type}:${n.related_content_id}:${day}` : n.id;
    const group = groups.get(key);
    if (group) group.items.push(n);
    else groups.set(key, { id: key, items: [n], dateLabel: isToday(date) ? "Hoje" : isYesterday(date) ? "Ontem" : "Anteriores" });
  }
  return [...groups.values()];
}
export function notificationContext(n: Notification): Record<string, unknown> {
  return n.context && typeof n.context === "object" && !Array.isArray(n.context) ? n.context as Record<string, unknown> : {};
}

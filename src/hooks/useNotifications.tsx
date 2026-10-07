import { useEffect } from "react";
import { useInfiniteQuery, useQuery, useMutation, useQueryClient, InfiniteData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface Notification {
  id: string; user_id: string;
  type: "friend_request" | "friend_accepted" | "recommendation" | "activity" | "activity_like" | "activity_comment" | "shared_drawer_invite" | "streaming_change" | "new_season" | "new_episodes" | "upcoming_content" | "rental_arrival" | "purchase_arrival";
  title: string; message: string | null; related_user_id: string | null; related_content_id: string | null;
  is_read: boolean; created_at: string; event_id?: string | null; event_key?: string | null;
  context?: unknown;
}
export interface PendingItem { id: string; actor_id: string; username: string | null; avatar_url: string | null; created_at: string; drawer_id?: string; name?: string; }
export interface PendingItems { friends: PendingItem[]; drawers: PendingItem[]; }
const PAGE_SIZE = 30;
type Page = Notification[];

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const key = ["notifications", user?.id];
  const countKey = ["notification-count", user?.id];
  const invalidate = () => {
    for (const prefix of ["notifications", "notification-count", "notification-pending", "content-notifications-map"]) {
      void queryClient.invalidateQueries({ queryKey: [prefix, user?.id] });
    }
  };
  const inbox = useInfiniteQuery({
    queryKey: key, initialPageParam: null as { created_at: string; id: string } | null,
    queryFn: async ({ pageParam }) => {
      if (!user) return [];
      let query = supabase.from("notifications").select("*").eq("user_id", user.id)
        .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(PAGE_SIZE);
      if (pageParam) query = query.or(`created_at.lt.${pageParam.created_at},and(created_at.eq.${pageParam.created_at},id.lt.${pageParam.id})`);
      const { data, error } = await query;
      if (error) throw error;
      return data as Notification[];
    },
    getNextPageParam: (page) => page.length === PAGE_SIZE ? page[page.length - 1] : undefined,
    enabled: !!user, refetchInterval: 60_000,
  });
  const count = useQuery({
    queryKey: countKey, enabled: !!user, refetchInterval: 30_000,
    queryFn: async () => {
      if (!user) return 0;
      const { count, error } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("is_read", false);
      if (error) throw error;
      return count || 0;
    },
  });
  const pending = useQuery({
    queryKey: ["notification-pending", user?.id], enabled: !!user, refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("notification_pending_items");
      if (error) throw error;
      return data as unknown as PendingItems;
    },
  });
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(`notification-inbox-${user.id}-${crypto.randomUUID()}`);
    for (const table of ["notifications", "friendships", "shared_drawer_members"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table, ...(table === "notifications" ? { filter: `user_id=eq.${user.id}` } : {}) }, invalidate);
    }
    channel.subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id, queryClient]);

  const optimistic = async (transform: (n: Notification) => Notification | null, decrement: number) => {
    await Promise.all([queryClient.cancelQueries({ queryKey: key }), queryClient.cancelQueries({ queryKey: countKey })]);
    const previous = queryClient.getQueryData<InfiniteData<Page>>(key);
    const previousCount = queryClient.getQueryData<number>(countKey);
    queryClient.setQueryData<InfiniteData<Page>>(key, (old) => old && ({ ...old, pages: old.pages.map(page => page.flatMap(n => { const next = transform(n); return next ? [next] : []; })) }));
    queryClient.setQueryData<number>(countKey, old => Math.max(0, (old || 0) - decrement));
    return { previous, previousCount };
  };
  const rollback = (_error: unknown, _variables: unknown, context: { previous?: InfiniteData<Page>; previousCount?: number } | undefined) => {
    if (context) { queryClient.setQueryData(key, context.previous); queryClient.setQueryData(countKey, context.previousCount); }
    toast({ title: "Não foi possível atualizar o aviso", description: "Nada foi perdido. Tente novamente.", variant: "destructive" });
  };
  const markAsRead = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id); if (error) throw error; },
    onMutate: id => optimistic(n => n.id === id ? { ...n, is_read: true } : n, inbox.data?.pages.flat().some(n => n.id === id && !n.is_read) ? 1 : 0),
    onError: rollback, onSettled: invalidate,
  });
  const markAllAsRead = useMutation({
    mutationFn: async (cutoff: string = new Date().toISOString()) => {
      if (!user) return;
      const { error } = await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false).lte("created_at", cutoff);
      if (error) throw error;
    },
    onMutate: cutoff => optimistic(n => n.created_at <= (cutoff || new Date().toISOString()) ? { ...n, is_read: true } : n, count.data || 0),
    onError: rollback, onSettled: invalidate,
  });
  const deleteNotification = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("notifications").delete().eq("id", id); if (error) throw error; },
    onMutate: id => optimistic(n => n.id === id ? null : n, inbox.data?.pages.flat().some(n => n.id === id && !n.is_read) ? 1 : 0),
    onError: rollback, onSettled: invalidate,
  });
  const respond = useMutation({
    mutationFn: async ({ item, kind, accept }: { item: PendingItem; kind: "friends" | "drawers"; accept: boolean }) => {
      if (!user) throw new Error("Entre novamente.");
      const table = kind === "friends" ? "friendships" : "shared_drawer_members";
      const result = accept ? await supabase.from(table).update({ status: "accepted" }).eq("id", item.id).eq("status", "pending").select("id")
        : await supabase.from(table).delete().eq("id", item.id).eq("status", "pending").select("id");
      if (result.error) throw result.error;
      if (!result.data?.length) throw new Error("Este convite já foi respondido.");
    },
    onMutate: async ({ item, kind }) => {
      const pendingKey = ["notification-pending", user?.id];
      await queryClient.cancelQueries({ queryKey: pendingKey });
      const previous = queryClient.getQueryData<PendingItems>(pendingKey);
      queryClient.setQueryData<PendingItems>(pendingKey, old => old && ({ ...old, [kind]: old[kind].filter(p => p.id !== item.id) }));
      return { previous };
    },
    onError: (_e, _v, ctx) => { queryClient.setQueryData(["notification-pending", user?.id], ctx?.previous); toast({ title: "Não foi possível responder", description: "Tente novamente.", variant: "destructive" }); },
    onSuccess: (_data, v) => toast({ title: v.accept ? "Convite aceito" : "Convite recusado" }),
    onSettled: () => { invalidate(); for (const prefix of ["friendships", "friends", "friend-requests", "pending-requests"]) void queryClient.invalidateQueries({ queryKey: [prefix] }); },
  });
  return { notifications: inbox.data?.pages.flat() || [], isLoading: inbox.isLoading, error: inbox.error || pending.error,
    unreadCount: count.data || 0, pending: pending.data || { friends: [], drawers: [] }, respond,
    markAsRead, markAllAsRead, deleteNotification, fetchNextPage: inbox.fetchNextPage, hasNextPage: inbox.hasNextPage,
    isFetchingNextPage: inbox.isFetchingNextPage, refetch: invalidate };
}

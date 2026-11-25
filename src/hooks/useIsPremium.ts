import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Tables } from "@/integrations/supabase/types";

export type Subscription = Tables<"subscriptions">;

interface PremiumStatusData {
  isPremium: boolean;
  subscription: Subscription | null;
}

export function useIsPremium() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const query = useQuery<PremiumStatusData>({
    queryKey: ["premium-status", userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const [rpcResult, subResult] = await Promise.all([
        supabase.rpc("is_premium", { _user_id: userId! }),
        supabase
          .from("subscriptions")
          .select("*")
          .eq("user_id", userId!)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (rpcResult.error) throw rpcResult.error;
      if (subResult.error) throw subResult.error;

      return {
        isPremium: !!rpcResult.data,
        subscription: subResult.data ?? null,
      };
    },
  });

  useEffect(() => {
    if (!userId) return;

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ["premium-status", userId] });
    };

    const channel = supabase
      .channel(`subscriptions-${userId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "subscriptions",
          filter: `user_id=eq.${userId}`,
        },
        invalidate,
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "subscriptions",
          filter: `user_id=eq.${userId}`,
        },
        invalidate,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);

  return {
    isPremium: query.data?.isPremium ?? false,
    subscription: query.data?.subscription ?? null,
    isLoading: authLoading || (!!userId && query.isLoading),
  };
}
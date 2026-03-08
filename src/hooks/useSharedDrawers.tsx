import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Content } from "@/lib/mockData";

export interface SharedDrawer {
  id: string;
  drawerId: string;
  name: string;
  icon: string;
  color: string;
  ownerUsername: string;
  ownerId: string;
}

export function useSharedDrawers() {
  const { user } = useAuth();
  const [sharedDrawers, setSharedDrawers] = useState<SharedDrawer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSharedDrawers = useCallback(async () => {
    if (!user) {
      setSharedDrawers([]);
      setIsLoading(false);
      return;
    }

    try {
      // Fetch accepted shared memberships for this user
      const { data: memberships, error: memError } = await supabase
        .from("shared_drawer_members" as any)
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "accepted");

      if (memError) throw memError;
      if (!memberships || memberships.length === 0) {
        setSharedDrawers([]);
        setIsLoading(false);
        return;
      }

      const drawerIds = (memberships as any[]).map((m: any) => m.drawer_id);

      // Fetch the drawer info
      const { data: drawers, error: drawersError } = await supabase
        .from("user_custom_drawers")
        .select("*")
        .in("id", drawerIds);

      if (drawersError) throw drawersError;

      // Fetch owner profiles
      const ownerIds = [...new Set((drawers || []).map((d: any) => d.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", ownerIds);

      const result: SharedDrawer[] = (drawers || []).map((d: any) => {
        const owner = profiles?.find((p: any) => p.id === d.user_id);
        return {
          id: d.id,
          drawerId: d.id,
          name: d.name,
          icon: d.icon,
          color: "#6366f1",
          ownerUsername: owner?.username || "Desconhecido",
          ownerId: d.user_id,
        };
      });

      setSharedDrawers(result);
    } catch (error) {
      console.error("Error fetching shared drawers:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSharedDrawers();
  }, [fetchSharedDrawers]);

  const getSharedDrawerContents = useCallback(async (drawerId: string): Promise<Content[]> => {
    const { data, error } = await supabase
      .from("user_drawer_assignments")
      .select("*")
      .eq("drawer_id", drawerId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching shared drawer contents:", error);
      return [];
    }

    return (data || []).map((a: any) => a.production_data as Content);
  }, []);

  const acceptInvite = useCallback(async (drawerId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("shared_drawer_members" as any)
      .update({ status: "accepted" })
      .eq("drawer_id", drawerId)
      .eq("user_id", user.id);

    if (error) throw error;
    await fetchSharedDrawers();
  }, [user, fetchSharedDrawers]);

  const rejectInvite = useCallback(async (drawerId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("shared_drawer_members" as any)
      .delete()
      .eq("drawer_id", drawerId)
      .eq("user_id", user.id);

    if (error) throw error;
    await fetchSharedDrawers();
  }, [user, fetchSharedDrawers]);

  const addToSharedDrawer = useCallback(async (content: Content, drawerId: string, ownerId: string) => {
    if (!user) return;

    const productionType = content.type === "movie" ? "movie" : "tv";
    const { error } = await supabase
      .from("user_drawer_assignments")
      .insert({
        user_id: ownerId, // assignments belong to the drawer owner's context
        drawer_id: drawerId,
        production_id: content.id,
        production_type: productionType,
        production_data: content as unknown as Record<string, unknown>,
      } as any);

    if (error) throw error;
  }, [user]);

  return {
    sharedDrawers,
    isLoading,
    getSharedDrawerContents,
    acceptInvite,
    rejectInvite,
    addToSharedDrawer,
    refetch: fetchSharedDrawers,
  };
}

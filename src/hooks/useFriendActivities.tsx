import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFriendships } from "@/hooks/useFriendships";

export interface FriendActivity {
  id: string;
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  production_id: string;
  production_type: string;
  production_data: {
    id: number;
    title: string;
    name?: string;
    poster_path?: string;
    media_type?: string;
    vote_average?: number;
    release_date?: string;
    first_air_date?: string;
  };
  rating: number | null;
  comment: string | null;
  created_at: string;
  drawer_id: string;
  drawer_label: string;
  rewatch_count: number;
}

// Built-in drawers
const DEFAULT_DRAWER_LABELS: Record<string, string> = {
  watched: "assistidos",
  "want-to-watch": "quero assistir",
  favorites: "favoritos",
};

export function useFriendActivities() {
  const { user } = useAuth();
  const { friends } = useFriendships();

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["friend-activities", user?.id, friends.map((f) => f.id)],
    queryFn: async () => {
      if (!user?.id || friends.length === 0) return [];

      const friendIds = friends.map((f) => f.id);

      // Fetch ALL drawer assignments from friends (any drawer)
      const { data: assignments, error } = await supabase
        .from("user_drawer_assignments")
        .select("*")
        .in("user_id", friendIds)
        .order("created_at", { ascending: false })
        .limit(80);

      if (error) throw error;
      if (!assignments || assignments.length === 0) return [];

      // Fetch profiles
      const userIds = [...new Set(assignments.map((a) => a.user_id))];
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      // Fetch custom drawer names (uuids only)
      const customDrawerIds = [
        ...new Set(
          assignments
            .map((a) => a.drawer_id)
            .filter((id) => id && !DEFAULT_DRAWER_LABELS[id]) as string[]
        ),
      ];

      let customDrawers: { id: string; name: string }[] = [];
      if (customDrawerIds.length > 0) {
        const { data } = await supabase
          .from("user_custom_drawers")
          .select("id, name")
          .in("id", customDrawerIds);
        customDrawers = data || [];
      }

      return assignments.map((assignment) => {
        const profile = profiles?.find((p) => p.id === assignment.user_id);
        const custom = customDrawers.find((d) => d.id === assignment.drawer_id);
        const label =
          DEFAULT_DRAWER_LABELS[assignment.drawer_id] ||
          custom?.name?.toLowerCase() ||
          "uma gaveta";
        return {
          id: assignment.id,
          user_id: assignment.user_id,
          username: profile?.username || null,
          avatar_url: profile?.avatar_url || null,
          production_id: assignment.production_id,
          production_type: assignment.production_type,
          production_data: assignment.production_data as FriendActivity["production_data"],
          rating: assignment.rating,
          comment: assignment.comment,
          created_at: assignment.created_at,
          drawer_id: assignment.drawer_id,
          drawer_label: label,
          rewatch_count: ((assignment as any).rewatch_count as number | null) ?? 0,
        } as FriendActivity;
      });
    },
    enabled: !!user?.id && friends.length > 0,
  });

  return {
    activities,
    isLoading,
  };
}

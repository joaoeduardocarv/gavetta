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
}

export function useFriendActivities() {
  const { user } = useAuth();
  const { friends } = useFriendships();

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["friend-activities", user?.id, friends.map((f) => f.id)],
    queryFn: async () => {
      if (!user?.id || friends.length === 0) return [];

      const friendIds = friends.map((f) => f.id);

      // Get friends' watched assignments
      const { data: assignments, error } = await supabase
        .from("user_drawer_assignments")
        .select("*")
        .eq("drawer_id", "watched")
        .in("user_id", friendIds)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      if (!assignments || assignments.length === 0) return [];

      // Get profiles for all users in assignments
      const userIds = [...new Set(assignments.map((a) => a.user_id))];
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      // Combine assignments with profile data
      return assignments.map((assignment) => {
        const profile = profiles?.find((p) => p.id === assignment.user_id);
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

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const ACTIVITY_COMMENT_LIMIT = 280;

export interface ActivityComment {
  id: string;
  activity_id: string;
  user_id: string;
  body: string;
  created_at: string;
  username: string | null;
  avatar_url: string | null;
}

export function useActivityInteractions(activityIds: string[]) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const stableIds = [...activityIds].sort();
  const queryKey = ["activity-interactions", user?.id, stableIds];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!user?.id || stableIds.length === 0) {
        return { likes: [], comments: [] as ActivityComment[] };
      }

      const [likesResult, commentsResult] = await Promise.all([
        supabase.from("activity_likes").select("id, activity_id, user_id").in("activity_id", stableIds),
        supabase
          .from("activity_comments")
          .select("id, activity_id, user_id, body, created_at")
          .in("activity_id", stableIds)
          .order("created_at", { ascending: true }),
      ]);

      if (likesResult.error) throw likesResult.error;
      if (commentsResult.error) throw commentsResult.error;

      const userIds = [...new Set((commentsResult.data || []).map((comment) => comment.user_id))];
      const profilesResult = userIds.length
        ? await supabase.from("profiles").select("id, username, avatar_url").in("id", userIds)
        : { data: [], error: null };

      if (profilesResult.error) throw profilesResult.error;
      const profiles = new Map((profilesResult.data || []).map((profile) => [profile.id, profile]));

      return {
        likes: likesResult.data || [],
        comments: (commentsResult.data || []).map((comment) => ({
          ...comment,
          username: profiles.get(comment.user_id)?.username || null,
          avatar_url: profiles.get(comment.user_id)?.avatar_url || null,
        })),
      };
    },
    enabled: !!user?.id && stableIds.length > 0,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["activity-interactions"] });

  const toggleLike = useMutation({
    mutationFn: async (activityId: string) => {
      if (!user?.id) throw new Error("Entre novamente para curtir.");
      const existing = data?.likes.find(
        (like) => like.activity_id === activityId && like.user_id === user.id
      );

      const result = existing
        ? await supabase.from("activity_likes").delete().eq("id", existing.id)
        : await supabase.from("activity_likes").insert({ activity_id: activityId, user_id: user.id });

      if (result.error) throw result.error;
    },
    onSuccess: invalidate,
  });

  const addComment = useMutation({
    mutationFn: async ({ activityId, body }: { activityId: string; body: string }) => {
      if (!user?.id) throw new Error("Entre novamente para comentar.");
      const cleanBody = body.trim();
      if (!cleanBody || cleanBody.length > ACTIVITY_COMMENT_LIMIT) {
        throw new Error(`O comentário deve ter até ${ACTIVITY_COMMENT_LIMIT} caracteres.`);
      }

      const { error } = await supabase
        .from("activity_comments")
        .insert({ activity_id: activityId, user_id: user.id, body: cleanBody });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteComment = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase.from("activity_comments").delete().eq("id", commentId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    userId: user?.id,
    likes: data?.likes || [],
    comments: data?.comments || [],
    isLoading,
    toggleLike,
    addComment,
    deleteComment,
  };
}
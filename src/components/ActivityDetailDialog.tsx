import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActivityInteractions } from "@/hooks/useActivityInteractions";
import type { FriendActivity } from "@/hooks/useFriendActivities";
import { ActivityCard } from "@/components/ActivityFeed";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ContentDetailDialog } from "@/components/ContentDetailDialog";
import { normalizeStoredContent } from "@/lib/contentNormalizer";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
export function ActivityDetailDialog({ activityId, commentId, open, onOpenChange }: { activityId: string | null; commentId?: string | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user } = useAuth();
  const [contentOpen, setContentOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const activity = useQuery({
    queryKey: ["notification-activity", user?.id, activityId], enabled: open && !!activityId && !!user,
    queryFn: async () => {
      if (!activityId || !user) return null;
      // Public drawer visibility is not sufficient: interaction access requires accepted friendship.
      const { data: allowed, error: accessError } = await supabase.rpc("is_activity_participant", { _activity_id: activityId, _viewer_id: user.id });
      if (accessError) throw accessError;
      if (!allowed) return null;
      const { data, error } = await supabase.from("user_drawer_assignments").select("*").eq("id", activityId).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const { data: profile } = await supabase.from("profiles").select("username,avatar_url").eq("id", data.user_id).maybeSingle();
      return { ...data, username: profile?.username || null, avatar_url: profile?.avatar_url || null,
        drawer_label: ({ watched: "Assistidos", watching: "Assistindo", "to-watch": "Quero ver" } as Record<string, string>)[data.drawer_id] || "uma gavetta" } as unknown as FriendActivity;
    },
  });
  const interactions = useActivityInteractions(open && activity.data ? [activity.data.id] : []);
  useEffect(() => {
    if (!open) { setContentOpen(false); return; }
    if (commentId && !interactions.isLoading) container.current?.querySelector(".ring-2")?.scrollIntoView({ block: "center" });
  }, [open, commentId, interactions.isLoading]);
  const content = activity.data ? normalizeStoredContent(activity.data.production_data, { productionId: activity.data.production_id, productionType: activity.data.production_type }) : null;
  const missingComment = commentId && !interactions.isLoading && !interactions.comments.some(c => c.id === commentId);
  return <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="z-[60] max-h-[85vh] overflow-y-auto sm:max-w-lg" ref={container}>
        <DialogHeader><DialogTitle>Sua atividade</DialogTitle><DialogDescription>Interações sobre este título</DialogDescription></DialogHeader>
        {activity.isLoading ? <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /> : activity.error ? <p role="alert" className="text-sm text-muted-foreground">Não foi possível carregar a atividade. Tente novamente.</p> : !activity.data ? <p className="text-sm text-muted-foreground">Esta atividade foi removida ou não está mais disponível para você.</p> : <>
          {missingComment && <p role="status" className="text-sm text-muted-foreground">O comentário original não está mais disponível.</p>}
          <ActivityCard key={`${activity.data.id}:${commentId || "likes"}`} activity={activity.data} interactions={interactions} onClick={() => setContentOpen(true)} initialCommentsOpen highlightedCommentId={commentId} />
        </>}
      </DialogContent>
    </Dialog>
    <ContentDetailDialog content={content} open={contentOpen} onOpenChange={setContentOpen} />
  </>;
}

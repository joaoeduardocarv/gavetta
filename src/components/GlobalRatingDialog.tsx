import { useDrawers } from "@/contexts/DrawerContext";
import { RatingDialog } from "@/components/RatingDialog";

export function GlobalRatingDialog() {
  const { pendingWatchedAssignment, confirmWatchedRating, cancelWatchedRating } = useDrawers();

  if (!pendingWatchedAssignment) return null;

  const contentTitle = pendingWatchedAssignment.content.title || "Conteúdo";

  return (
    <RatingDialog
      open={true}
      onOpenChange={(open) => {
        if (!open) {
          cancelWatchedRating();
        }
      }}
      contentTitle={contentTitle}
      onConfirm={(rating, comment) => {
        confirmWatchedRating(rating, comment);
      }}
    />
  );
}

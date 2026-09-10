import { useState } from "react";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAwards } from "@/hooks/useAwards";
import { AwardsDialog } from "./AwardsDialog";

interface AwardsBadgeProps {
  mediaType: "movie" | "tv" | null;
  tmdbId: number | null;
  title: string;
  className?: string;
}

export function AwardsBadge({ mediaType, tmdbId, title, className }: AwardsBadgeProps) {
  const { awards, hasAwards } = useAwards(mediaType, tmdbId);
  const [open, setOpen] = useState(false);

  if (!hasAwards || !awards) return null;

  const isWinner = awards.total_wins > 0;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={`Ver premiações de ${title}`}
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-full shadow-md ring-1 ring-background transition-transform active:scale-90",
          isWinner ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground",
          className,
        )}
      >
        <Trophy className="h-3.5 w-3.5" />
      </button>
      <AwardsDialog
        open={open}
        onOpenChange={(next) => setOpen(next)}
        title={title}
        awards={awards}
      />
    </>
  );
}

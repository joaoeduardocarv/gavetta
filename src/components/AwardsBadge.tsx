import { useState } from "react";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAwards } from "@/hooks/useAwards";
import { AwardsDialog } from "./AwardsDialog";
import { Button } from "@/components/ui/button";

interface AwardsBadgeProps {
  mediaType: "movie" | "tv" | null;
  tmdbId: number | null;
  title: string;
  releaseDate?: string | null;
  className?: string;
}

export function AwardsBadge({ mediaType, tmdbId, title, releaseDate, className }: AwardsBadgeProps) {
  const { awards, hasAwards } = useAwards(mediaType, tmdbId, releaseDate);
  const [open, setOpen] = useState(false);

  if (!hasAwards || !awards) return null;

  const isWinner = awards.total_wins > 0;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={`Ver premiações de ${title}`}
        className={cn(
          "h-6 w-6 rounded-sm bg-transparent p-0 shadow-none transition-colors active:scale-90",
          isWinner ? "text-accent hover:bg-accent/10" : "text-muted-foreground hover:bg-muted",
          className,
        )}
      >
        <Trophy className="h-3 w-3" />
      </Button>
      <AwardsDialog
        open={open}
        onOpenChange={(next) => setOpen(next)}
        title={title}
        awards={awards}
      />
    </>
  );
}

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Trophy, Award } from "lucide-react";
import { formatAwardsSummary, getAwardHighlights, type TitleAwards } from "@/hooks/useAwards";

interface AwardsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  awards: TitleAwards | null;
}

export function AwardsDialog({ open, onOpenChange, title, awards }: AwardsDialogProps) {
  const highlights = awards ? getAwardHighlights(awards) : [];
  const summary = awards ? formatAwardsSummary(awards) : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="z-[60] max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading">
            <Trophy className="h-5 w-5 text-accent" />
            Premiações
          </DialogTitle>
          <DialogDescription className="line-clamp-2">{title}</DialogDescription>
        </DialogHeader>

        {!awards || !awards.has_awards ? (
          <p className="text-sm text-muted-foreground">
            Sem premiações registradas para este título.
          </p>
        ) : (
          <div className="space-y-4">
            {highlights.length > 0 && (
              <div className="space-y-2">
                {highlights.map((h) => (
                  <div
                    key={h.label}
                    className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Award className="h-4 w-4 text-accent" />
                      {h.label}
                    </span>
                    <span className="flex gap-1.5">
                      {h.wins > 0 && (
                        <Badge className="text-xs">
                          {h.wins} {h.wins === 1 ? "vitória" : "vitórias"}
                        </Badge>
                      )}
                      {h.nominations > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {h.nominations} {h.nominations === 1 ? "indicação" : "indicações"}
                        </Badge>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {summary && (
              <p className="text-sm text-muted-foreground">
                No total: <span className="font-semibold text-foreground">{summary}</span> em
                premiações do cinema e da TV.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

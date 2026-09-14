import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Trophy, Award, Calendar } from "lucide-react";
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

            {awards.award_details && awards.award_details.length > 0 && (
              <div className="space-y-2 border-t border-border pt-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Prêmios detalhados</p>
                {awards.award_details.map((detail, index) => (
                  <div key={`${detail.award}-${detail.year ?? "sem-ano"}-${index}`} className="flex gap-2.5 py-1.5">
                    <Award className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent" />
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm font-medium leading-snug">{detail.award}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{detail.result === "winner" ? "Vencedor" : "Indicado"}</span>
                        {detail.year && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {detail.year}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(!awards.award_details || awards.award_details.length === 0) && awards.raw_text && (
              <p className="text-xs text-muted-foreground">
                A fonte informa apenas os totais deste título; categoria e ano não estão disponíveis.
              </p>
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

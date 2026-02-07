import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface RatingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentTitle: string;
  onConfirm: (rating: number, comment: string) => void;
  initialRating?: number;
  initialComment?: string;
}

export function RatingDialog({
  open,
  onOpenChange,
  contentTitle,
  onConfirm,
  initialRating = 0,
  initialComment = "",
}: RatingDialogProps) {
  const [rating, setRating] = useState(initialRating);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState(initialComment);

  const handleConfirm = () => {
    if (rating === 0) return;
    onConfirm(rating, comment);
    onOpenChange(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      // Reset state when closing
      setRating(initialRating);
      setComment(initialComment);
      setHoveredRating(0);
    }
    onOpenChange(isOpen);
  };

  const displayRating = hoveredRating || rating;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center">Avaliar</DialogTitle>
          <DialogDescription className="text-center">
            {contentTitle}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Star Rating */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
                <button
                  key={value}
                  type="button"
                  className="p-0.5 transition-transform hover:scale-110 focus:outline-none"
                  onMouseEnter={() => setHoveredRating(value)}
                  onMouseLeave={() => setHoveredRating(0)}
                  onClick={() => setRating(value)}
                >
                  <Star
                    className={cn(
                      "h-6 w-6 transition-colors",
                      value <= displayRating
                        ? "fill-amber-400 text-amber-400"
                        : "text-muted-foreground/30"
                    )}
                  />
                </button>
              ))}
            </div>
            <span className="text-2xl font-bold text-foreground">
              {displayRating > 0 ? `${displayRating}/10` : "—"}
            </span>
          </div>

          {/* Comment (optional) */}
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">
              Comentário (opcional)
            </label>
            <Textarea
              placeholder="O que você achou?"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="resize-none"
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => handleOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              disabled={rating === 0}
              onClick={handleConfirm}
            >
              Confirmar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

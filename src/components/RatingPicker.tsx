import { useState } from "react";
import { Star, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RatingPickerProps {
  /** Current value (1-10) or null when not rated. */
  value: number | null;
  /** Whether the displayed value is an auto-computed average (vs. an explicit user choice). */
  isAverage?: boolean;
  /** When true, button is non-interactive. */
  disabled?: boolean;
  /** Tooltip / accessibility label shown on the trigger. */
  label: string;
  /** Compact = chip-style trigger; full = always shows 10 stars (used in headers). */
  size?: "compact" | "default";
  /** Optional controlled open state — when provided, parent manages open/close. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onChange: (value: number | null) => void;
}

/**
 * Inline 1-10 rating selector. Renders as a small chip showing the current value
 * (or "Avaliar"). Clicking opens a popover with 10 stars to choose.
 */
export function RatingPicker({
  value,
  isAverage = false,
  disabled = false,
  label,
  size = "compact",
  open: controlledOpen,
  onOpenChange,
  onChange,
}: RatingPickerProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [hover, setHover] = useState<number | null>(null);

  const open = controlledOpen ?? internalOpen;
  const setOpen = (v: boolean) => {
    if (onOpenChange) onOpenChange(v);
    else setInternalOpen(v);
  };

  const display = hover ?? value ?? 0;

  const formattedValue =
    value != null ? value.toFixed(value % 1 === 0 ? 0 : 1) : null;
  const triggerLabel = formattedValue != null ? `${formattedValue}/10` : "—";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={label}
          title={label}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-0.5 text-xs font-medium transition-colors",
            "hover:bg-accent hover:text-accent-foreground",
            disabled && "opacity-40 cursor-not-allowed hover:bg-transparent",
            value != null && !isAverage && "bg-primary/10 text-primary border-primary/30",
            value != null && isAverage && "bg-muted text-muted-foreground italic",
            size === "default" && "px-2.5 py-1 text-sm"
          )}
        >
          <Star
            className={cn(
              "h-3 w-3",
              value != null && !isAverage && "fill-primary",
              size === "default" && "h-3.5 w-3.5"
            )}
          />
          <span>{triggerLabel}</span>
          {isAverage && value != null && <span className="text-[10px]">média</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="top"
        className="z-[70] w-auto p-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            {value != null && (
              <span
                className={cn(
                  "text-xs font-semibold tabular-nums",
                  isAverage ? "text-muted-foreground italic" : "text-primary"
                )}
                title={isAverage ? "Média calculada" : "Nota salva no banco"}
              >
                {formattedValue}/10
                {isAverage && <span className="ml-1 font-normal">(média)</span>}
              </span>
            )}
          </div>
          <div className="flex gap-0.5" onMouseLeave={() => setHover(null)}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onMouseEnter={() => setHover(n)}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(n);
                  // Small delay so user sees the selected stars fill in before closing
                  setTimeout(() => setOpen(false), 400);
                }}
                aria-label={`${n} de 10`}
                className="p-0.5 transition-transform hover:scale-110"
              >
                <Star
                  className={cn(
                    "h-5 w-5 transition-colors",
                    n <= display
                      ? "fill-primary text-primary"
                      : "text-muted-foreground"
                  )}
                />
              </button>
            ))}
          </div>
          {value != null && !isAverage && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-7 text-xs gap-1.5"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
                setOpen(false);
              }}
            >
              <Trash2 className="h-3 w-3" />
              Remover nota
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

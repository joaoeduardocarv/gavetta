import { Sparkles } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { useGavettaPlusEnabled } from "@/lib/gavettaPlus";
import { cn } from "@/lib/utils";

export interface PremiumBadgeProps extends Omit<BadgeProps, "variant"> {
  showIcon?: boolean;
}

export function PremiumBadge({ className, showIcon = true, ...props }: PremiumBadgeProps) {
  const { enabled } = useGavettaPlusEnabled();
  if (!enabled) return null;

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 border-accent/40 bg-accent/15 px-2 py-0.5 text-[11px] font-semibold leading-none text-foreground dark:text-accent",
        className,
      )}
      {...props}
    >
      {showIcon && <Sparkles className="h-3 w-3 shrink-0 text-accent" aria-hidden="true" />}
      <span>Gavetta+</span>
    </Badge>
  );
}
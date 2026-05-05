import gavetaIcon from "@/assets/gaveta-icon.png";
import { cn } from "@/lib/utils";

interface GavetaIconProps {
  className?: string;
}

export function GavetaIcon({ className }: GavetaIconProps) {
  return (
    <img
      src={gavetaIcon}
      alt=""
      aria-hidden="true"
      className={cn("inline-block object-contain", className)}
    />
  );
}

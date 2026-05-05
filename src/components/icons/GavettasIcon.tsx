import { SVGProps } from "react";

/**
 * Monochrome version of the Gavetta drawer stack icon.
 * Uses currentColor so it inherits text color (muted/primary) like lucide icons.
 */
export function GavettasIcon({
  className,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Three stacked drawers with notch handles */}
      <path d="M3 4h18v4H3z" />
      <path d="M10 4v1.5a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1V4" />
      <path d="M3 10h18v4H3z" />
      <path d="M10 10v1.5a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1V10" />
      <path d="M3 16h18v4H3z" />
      <path d="M10 16v1.5a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1V16" />
    </svg>
  );
}

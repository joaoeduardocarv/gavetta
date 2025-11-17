import { Film } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center justify-center px-4 max-w-lg">
        <div className="flex items-center gap-2">
          <Film className="h-6 w-6 text-primary" />
          <span className="font-heading text-xl font-bold text-foreground">
            CineList
          </span>
        </div>
      </div>
    </header>
  );
}

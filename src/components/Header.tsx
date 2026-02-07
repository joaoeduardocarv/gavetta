import logo from "@/assets/gavettalogo.png";
import { NotificationsPopover } from "@/components/NotificationsPopover";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center justify-between px-4 max-w-lg">
        <div className="w-10" /> {/* Spacer for balance */}
        <div className="flex items-center gap-2">
          <img src={logo} alt="Gavetta" className="h-6 dark:brightness-0 dark:invert" />
        </div>
        <NotificationsPopover />
      </div>
    </header>
  );
}

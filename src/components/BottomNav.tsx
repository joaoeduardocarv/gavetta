import { List, TrendingUp, Users, Settings } from "lucide-react";
import { NavLink } from "./NavLink";

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        <NavLink
          to="/"
          className="flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg text-muted-foreground transition-colors"
          activeClassName="text-primary bg-primary/10"
        >
          <List className="h-5 w-5" />
          <span className="text-xs font-medium">Minha Lista</span>
        </NavLink>

        <NavLink
          to="/news"
          className="flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg text-muted-foreground transition-colors"
          activeClassName="text-primary bg-primary/10"
        >
          <TrendingUp className="h-5 w-5" />
          <span className="text-xs font-medium">Em Alta</span>
        </NavLink>

        <NavLink
          to="/friends"
          className="flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg text-muted-foreground transition-colors"
          activeClassName="text-primary bg-primary/10"
        >
          <Users className="h-5 w-5" />
          <span className="text-xs font-medium">Amigos</span>
        </NavLink>

        <NavLink
          to="/settings"
          className="flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg text-muted-foreground transition-colors"
          activeClassName="text-primary bg-primary/10"
        >
          <Settings className="h-5 w-5" />
          <span className="text-xs font-medium">Config</span>
        </NavLink>
      </div>
    </nav>
  );
}

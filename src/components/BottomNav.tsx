import { List, Users } from "lucide-react";
import { NavLink } from "./NavLink";
import gavetaIcon from "@/assets/gaveta-icon.png";

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {/* Minhas Gavettas */}
        <NavLink
          to="/my-drawers"
          className="flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg text-muted-foreground transition-colors"
          activeClassName="text-primary bg-primary/10"
        >
          <List className="h-5 w-5" />
          <span className="text-xs font-medium">Gavettas</span>
        </NavLink>

        {/* Botão Central - Feed */}
        <NavLink
          to="/"
          className="flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg text-muted-foreground transition-colors"
          activeClassName="text-primary"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-[#4ADE80] via-[#3B82F6] to-[#FBBF24] rounded-full blur-md opacity-70" />
            <div className="relative bg-gradient-to-br from-[#4ADE80] via-[#3B82F6] to-[#FBBF24] p-3 rounded-full">
              <img src={gavetaIcon} alt="Gavetta" className="h-6 w-6 brightness-0 invert" />
            </div>
          </div>
          <span className="text-xs font-medium mt-1">Feed</span>
        </NavLink>

        {/* Meus Amigos */}
        <NavLink
          to="/friends"
          className="flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg text-muted-foreground transition-colors"
          activeClassName="text-primary bg-primary/10"
        >
          <Users className="h-5 w-5" />
          <span className="text-xs font-medium">Amigos</span>
        </NavLink>
      </div>
    </nav>
  );
}

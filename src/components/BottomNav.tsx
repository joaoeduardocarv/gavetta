import { List, Users, Search, TrendingUp, User } from "lucide-react";
import { NavLink } from "./NavLink";

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-1">
        {/* Minhas Gavettas */}
        <NavLink
          to="/"
          className="flex flex-col items-center justify-center gap-0.5 px-2 py-2 rounded-lg text-muted-foreground transition-colors"
          activeClassName="text-primary"
        >
          <List className="h-5 w-5" />
          <span className="text-[10px] font-medium">Gavettas</span>
        </NavLink>

        {/* Meus Amigos */}
        <NavLink
          to="/friends"
          className="flex flex-col items-center justify-center gap-0.5 px-2 py-2 rounded-lg text-muted-foreground transition-colors"
          activeClassName="text-primary"
        >
          <Users className="h-5 w-5" />
          <span className="text-[10px] font-medium">Amigos</span>
        </NavLink>

        {/* Botão Central - Busca */}
        <NavLink
          to="/search"
          className="flex flex-col items-center justify-center -mt-4"
          activeClassName=""
        >
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-[#4ADE80] via-[#3B82F6] to-[#FBBF24] rounded-full blur-md opacity-70" />
            <div className="relative bg-gradient-to-br from-[#4ADE80] via-[#3B82F6] to-[#FBBF24] p-4 rounded-full">
              <Search className="h-6 w-6 text-white" />
            </div>
          </div>
          <span className="text-[10px] font-medium text-muted-foreground mt-1">Busca</span>
        </NavLink>

        {/* Em Alta */}
        <NavLink
          to="/trending"
          className="flex flex-col items-center justify-center gap-0.5 px-2 py-2 rounded-lg text-muted-foreground transition-colors"
          activeClassName="text-primary"
        >
          <TrendingUp className="h-5 w-5" />
          <span className="text-[10px] font-medium">Em Alta</span>
        </NavLink>

        {/* Meu Perfil */}
        <NavLink
          to="/profile"
          className="flex flex-col items-center justify-center gap-0.5 px-2 py-2 rounded-lg text-muted-foreground transition-colors"
          activeClassName="text-primary"
        >
          <User className="h-5 w-5" />
          <span className="text-[10px] font-medium">Perfil</span>
        </NavLink>
      </div>
    </nav>
  );
}

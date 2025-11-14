import { Film, Search, User } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Link } from "react-router-dom";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <Film className="h-6 w-6 text-primary" />
          <h1 className="font-heading text-xl font-bold text-foreground">
            Curadoria Cultural
          </h1>
        </Link>
        
        <nav className="hidden items-center gap-6 md:flex">
          <Link
            to="/"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Sua Lista
          </Link>
          <Link
            to="/news"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Notícias
          </Link>
          <Link
            to="/friends"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Amigos
          </Link>
        </nav>
        
        <div className="flex items-center gap-3">
          <div className="relative hidden lg:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar conteúdo..."
              className="w-64 pl-9"
            />
          </div>
          
          <Button size="icon" variant="ghost">
            <User className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}

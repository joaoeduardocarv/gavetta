import { Link } from "react-router-dom";
import { Trophy } from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";

/** Private preview: only admins see this entry point until launch. */
export function OscarEntryButton() {
  const { isAdmin } = useIsAdmin();
  if (!isAdmin) return null;
  return (
    <Link to="/meu-oscar-2027" className="gala gala-frame mb-6 flex w-full items-center gap-2 rounded-md px-4 py-3" aria-label="Abrir Meu Oscar 2027">
      <Trophy className="h-4 w-4 shrink-0 text-[hsl(var(--gala-gold))]" />
      <span className="gala-serif gala-gold-text text-sm font-semibold tracking-wide">Meu Oscar 2027</span>
      <span className="gala-muted ml-auto hidden text-xs sm:inline">Faça suas apostas · prévia só sua</span>
    </Link>
  );
}

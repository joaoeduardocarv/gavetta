import { Sparkles, Wand2 } from "lucide-react";

interface DestinyDrawerCardProps {
  onClick: () => void;
}

export function DestinyDrawerCard({ onClick }: DestinyDrawerCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative w-full mb-6 px-4 py-3 rounded-md bg-gradient-destiny shadow-destiny overflow-hidden text-left transition-transform hover:scale-[1.005] active:scale-[0.99] flex items-center gap-2"
      aria-label="Abrir Gavetta Mágica"
    >
      {/* partículas decorativas */}
      <div className="absolute inset-0 pointer-events-none opacity-60">
        <Sparkles className="absolute top-1 left-4 w-2.5 h-2.5 text-white animate-gold-shimmer" style={{ animationDelay: '0.2s' }} />
        <Sparkles className="absolute top-2 right-16 w-3 h-3 text-white animate-gold-shimmer" style={{ animationDelay: '0.8s' }} />
        <Sparkles className="absolute bottom-1 left-24 w-2.5 h-2.5 text-white animate-gold-shimmer" style={{ animationDelay: '1.2s' }} />
        <Sparkles className="absolute bottom-2 right-6 w-2.5 h-2.5 text-white animate-gold-shimmer" style={{ animationDelay: '0.5s' }} />
      </div>

      <Wand2 className="relative w-4 h-4 text-white shrink-0" />
      <span className="relative font-heading font-bold text-sm text-white tracking-wide">
        Gavetta Mágica
      </span>
      <span className="relative text-xs text-white/85 ml-auto hidden sm:inline">
        IA que sugere filmes e séries pra você
      </span>
    </button>
  );
}

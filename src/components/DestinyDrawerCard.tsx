import { Sparkles, ChevronRight } from "lucide-react";
import { GavetaIcon } from "@/components/GavetaIcon";

interface DestinyDrawerCardProps {
  onClick: () => void;
}

export function DestinyDrawerCard({ onClick }: DestinyDrawerCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative w-full mb-6 p-4 rounded-xl bg-gradient-destiny shadow-destiny overflow-hidden text-left transition-transform hover:scale-[1.01] active:scale-[0.99]"
      aria-label="Abrir Gaveta do Destino"
    >
      {/* partículas decorativas */}
      <div className="absolute inset-0 pointer-events-none opacity-50">
        <Sparkles className="absolute top-2 left-3 w-3 h-3 text-white animate-gold-shimmer" style={{ animationDelay: '0.2s' }} />
        <Sparkles className="absolute top-6 right-12 w-4 h-4 text-white animate-gold-shimmer" style={{ animationDelay: '0.8s' }} />
        <Sparkles className="absolute bottom-3 left-16 w-3 h-3 text-white animate-gold-shimmer" style={{ animationDelay: '1.2s' }} />
        <Sparkles className="absolute bottom-4 right-4 w-3 h-3 text-white animate-gold-shimmer" style={{ animationDelay: '0.5s' }} />
      </div>

      <div className="relative flex items-center gap-3">
        <div className="shrink-0 w-12 h-12 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20 animate-gold-pulse-glow">
          <GavetaIcon className="w-7 h-7 brightness-0 invert" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-heading font-bold text-base text-white leading-tight">
            Gaveta do Destino
          </h3>
          <p className="text-xs text-white/90 mt-0.5">
            Uma escolha feita pra você
          </p>
        </div>
        <ChevronRight className="w-5 h-5 text-white shrink-0 transition-transform group-hover:translate-x-0.5" />
      </div>
    </button>
  );
}

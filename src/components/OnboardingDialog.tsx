import { useEffect, useLayoutEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

const STORAGE_PREFIX = "gavetta:onboarding-seen:";

interface Step {
  target?: string; // data-onboarding attribute; undefined = welcome (centered)
  title: string;
  description: string;
}

const steps: Step[] = [
  {
    title: "Bem-vindo à Gavetta",
    description:
      "Faça um tour rápido pelos botões principais para descobrir como organizar tudo o que você assiste.",
  },
  {
    target: "nav-gavettas",
    title: "Suas Gavettas",
    description:
      "Aqui ficam suas gavettas: Para Assistir, Assistindo e Assistidos. Crie também gavettas personalizadas para listas e maratonas.",
  },
  {
    target: "nav-search",
    title: "Buscar filmes e séries",
    description:
      "Toque no botão central para buscar títulos, ver onde assistir, elenco, detalhes e adicionar à sua gaveta.",
  },
  {
    target: "nav-friends",
    title: "Amigos",
    description:
      "Adicione amigos pelo @handle, acompanhe o que estão assistindo e envie recomendações diretas.",
  },
  {
    target: "nav-trending",
    title: "Em Alta",
    description:
      "Descubra os filmes, séries e notícias mais comentados do momento, com filtros diário e semanal.",
  },
  {
    target: "nav-profile",
    title: "Seu Perfil",
    description:
      "Edite avatar, @handle, ajustes de privacidade, notificações e compartilhe seu perfil público.",
  },
  {
    target: "header-notifications",
    title: "Notificações",
    description:
      "Receba avisos de novos episódios, estreias, mudanças de streaming, pedidos de amizade e recomendações.",
  },
];

type Rect = { top: number; left: number; width: number; height: number };

function useTargetRect(selector: string | undefined) {
  const [rect, setRect] = useState<Rect | null>(null);

  useLayoutEffect(() => {
    if (!selector) {
      setRect(null);
      return;
    }
    const update = () => {
      const el = document.querySelector<HTMLElement>(
        `[data-onboarding="${selector}"]`,
      );
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    update();
    const id = window.setTimeout(update, 50);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [selector]);

  return rect;
}

export function OnboardingDialog() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (loading || !user) return;
    try {
      const key = STORAGE_PREFIX + user.id;
      if (!localStorage.getItem(key)) {
        setOpen(true);
      }
    } catch {
      // ignore
    }
  }, [user, loading]);

  const current = steps[step];
  const rect = useTargetRect(open ? current.target : undefined);

  const finish = () => {
    if (user) {
      try {
        localStorage.setItem(STORAGE_PREFIX + user.id, "1");
      } catch {
        // ignore
      }
    }
    setOpen(false);
    setStep(0);
    try {
      window.dispatchEvent(new Event("gavetta:onboarding-finished"));
    } catch {
      // ignore
    }
  };

  if (!open) return null;

  const isLast = step === steps.length - 1;
  const PAD = 8;
  const vw = typeof window !== "undefined" ? window.innerWidth : 0;
  const vh = typeof window !== "undefined" ? window.innerHeight : 0;

  // Spotlight box
  const spot = rect
    ? {
        top: Math.max(0, rect.top - PAD),
        left: Math.max(0, rect.left - PAD),
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
      }
    : null;

  // Tooltip card position: prefer above target; fallback below; else center
  const CARD_W = Math.min(340, vw - 24);
  const CARD_EST_H = 200;
  let cardStyle: React.CSSProperties;
  if (!spot) {
    cardStyle = {
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: CARD_W,
    };
  } else {
    const spaceAbove = spot.top;
    const spaceBelow = vh - (spot.top + spot.height);
    const placeAbove = spaceAbove > spaceBelow;
    const top = placeAbove
      ? Math.max(12, spot.top - CARD_EST_H - 12)
      : Math.min(vh - CARD_EST_H - 12, spot.top + spot.height + 12);
    const centerX = spot.left + spot.width / 2;
    const left = Math.min(
      Math.max(12, centerX - CARD_W / 2),
      vw - CARD_W - 12,
    );
    cardStyle = { top, left, width: CARD_W };
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100]"
      role="dialog"
      aria-modal="true"
      aria-label="Tour de boas-vindas"
    >
      {/* Backdrop with spotlight via SVG mask */}
      <svg
        className="absolute inset-0 h-full w-full"
        width="100%"
        height="100%"
        aria-hidden="true"
      >
        <defs>
          <mask id="onboarding-spot-mask">
            <rect width="100%" height="100%" fill="white" />
            {spot && (
              <rect
                x={spot.left}
                y={spot.top}
                width={spot.width}
                height={spot.height}
                rx={16}
                ry={16}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.7)"
          mask="url(#onboarding-spot-mask)"
        />
      </svg>

      {/* Highlight ring on target */}
      {spot && (
        <div
          className="pointer-events-none absolute rounded-2xl ring-2 ring-primary animate-pulse"
          style={{
            top: spot.top,
            left: spot.left,
            width: spot.width,
            height: spot.height,
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        className="absolute rounded-xl border border-border bg-background p-4 shadow-2xl"
        style={cardStyle}
      >
        {!current.target && (
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#4ADE80] via-[#3B82F6] to-[#FBBF24]">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
        )}
        <h3 className="font-heading text-lg text-center">{current.title}</h3>
        <p className="mt-1.5 text-sm text-muted-foreground text-center">
          {current.description}
        </p>

        {/* Dots */}
        <div className="mt-3 flex justify-center gap-1.5">
          {steps.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStep(i)}
              aria-label={`Passo ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? "w-6 bg-primary" : "w-1.5 bg-muted"
              }`}
            />
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2">
          {step > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              Voltar
            </Button>
          )}
          <Button
            size="sm"
            className="flex-1"
            onClick={() => (isLast ? finish() : setStep((s) => s + 1))}
          >
            {isLast ? "Começar a usar" : "Próximo"}
            {!isLast && <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>

        {!isLast && (
          <button
            type="button"
            onClick={finish}
            className="mt-2 w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Pular tour
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}

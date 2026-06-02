import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  Bookmark,
  Search,
  Users,
  TrendingUp,
  Sparkles,
  Share2,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import logo from "@/assets/gavettalogo.png";

const STORAGE_PREFIX = "gavetta:onboarding-seen:";

interface Step {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

const steps: Step[] = [
  {
    icon: Sparkles,
    title: "Bem-vindo à Gavetta",
    description:
      "Seu organizador pessoal de filmes e séries. Guarde tudo o que quer assistir, está assistindo e já viu — em um só lugar.",
  },
  {
    icon: Bookmark,
    title: "Organize em Gavettas",
    description:
      "Use as gavettas padrão (Para Assistir, Assistindo e Assistidos) ou crie as suas próprias para temas, listas e maratonas.",
  },
  {
    icon: Search,
    title: "Busque e adicione",
    description:
      "Toque na busca central para encontrar filmes, séries e artistas. Veja onde assistir, elenco e detalhes completos antes de salvar.",
  },
  {
    icon: TrendingUp,
    title: "Acompanhe episódios",
    description:
      "Marque episódios assistidos, avalie de 1 a 10 e receba alertas quando novos episódios ou temporadas chegarem.",
  },
  {
    icon: Users,
    title: "Conecte-se com amigos",
    description:
      "Adicione amigos pelo @handle, veja o que estão assistindo e recomende títulos diretamente para eles.",
  },
  {
    icon: Share2,
    title: "Compartilhe suas descobertas",
    description:
      "Gere cards no formato Stories para o Instagram e mostre suas avaliações e gavettas favoritas.",
  },
];

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
  };

  const isLast = step === steps.length - 1;
  const current = steps[step];
  const Icon = current.icon;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) finish();
      }}
    >
      <DialogContent className="max-w-sm sm:max-w-md text-center">
        <div className="flex justify-center pt-2">
          <img
            src={logo}
            alt="Gavetta"
            className="h-6 dark:brightness-0 dark:invert"
          />
        </div>

        <div className="mx-auto mt-2 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#4ADE80] via-[#3B82F6] to-[#FBBF24]">
          <Icon className="h-8 w-8 text-white" />
        </div>

        <DialogTitle className="font-heading text-2xl">
          {current.title}
        </DialogTitle>
        <DialogDescription className="text-base px-2">
          {current.description}
        </DialogDescription>

        {/* Dots */}
        <div className="flex justify-center gap-1.5 mt-2">
          {steps.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStep(i)}
              aria-label={`Ir para passo ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? "w-6 bg-primary" : "w-1.5 bg-muted"
              }`}
            />
          ))}
        </div>

        <div className="flex flex-col gap-2 mt-3">
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button
                variant="outline"
                size="lg"
                className="flex-1"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                Voltar
              </Button>
            )}
            <Button
              size="lg"
              className="flex-1"
              onClick={() => {
                if (isLast) finish();
                else setStep((s) => s + 1);
              }}
            >
              {isLast ? "Começar a usar" : "Próximo"}
              {!isLast && <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>
          {!isLast && (
            <button
              type="button"
              onClick={finish}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              Pular tour
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

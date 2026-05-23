import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Sparkles } from "lucide-react";

interface SignupPromptOverlayProps {
  /** Time in seconds before showing the prompt. Default 60. */
  delaySeconds?: number;
  /** Scroll percentage (0-1) that triggers the prompt. Default 0.5. */
  scrollThreshold?: number;
}

/**
 * Public-page conversion prompt: appears for unauthenticated visitors
 * after they scroll past `scrollThreshold` OR after `delaySeconds`,
 * whichever happens first. Non-dismissible body scroll continues —
 * the modal is closable so it never traps the user.
 */
export function SignupPromptOverlay({
  delaySeconds = 60,
  scrollThreshold = 0.5,
}: SignupPromptOverlayProps) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (dismissed) return;

    const trigger = () => {
      if (!dismissed) setOpen(true);
    };

    const timer = window.setTimeout(trigger, delaySeconds * 1000);

    const onScroll = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;
      const pct = window.scrollY / scrollable;
      if (pct >= scrollThreshold) {
        trigger();
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, [delaySeconds, scrollThreshold, dismissed]);

  const handleChange = (next: boolean) => {
    setOpen(next);
    if (!next) setDismissed(true);
  };

  return (
    <Dialog open={open} onOpenChange={handleChange}>
      <DialogContent className="max-w-md text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <DialogTitle className="font-heading text-2xl">
          Gostou? Crie sua conta grátis
        </DialogTitle>
        <DialogDescription className="text-base">
          Organize seus filmes e séries em gavetas, acompanhe episódios, descubra o
          que seus amigos estão assistindo e receba alertas de novos lançamentos.
        </DialogDescription>
        <div className="mt-2 flex flex-col gap-2">
          <Button asChild size="lg" className="w-full">
            <Link to="/auth">Criar conta grátis</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link to="/auth">Já tenho conta — entrar</Link>
          </Button>
          <button
            type="button"
            onClick={() => handleChange(false)}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Continuar vendo sem conta
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

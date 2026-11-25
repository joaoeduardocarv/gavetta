import { Link } from "react-router-dom";
import { CheckCircle2, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PremiumBadge } from "@/components/premium/PremiumBadge";

const CONFETTI_PIECES = [
  { left: "10%", delay: "0ms", color: "bg-accent" },
  { left: "22%", delay: "120ms", color: "bg-primary" },
  { left: "34%", delay: "60ms", color: "bg-accent/80" },
  { left: "48%", delay: "180ms", color: "bg-primary/80" },
  { left: "62%", delay: "90ms", color: "bg-accent" },
  { left: "75%", delay: "150ms", color: "bg-primary" },
  { left: "88%", delay: "40ms", color: "bg-accent/80" },
];

export function CheckoutSuccessView() {
  return (
    <Card className="relative overflow-hidden border-accent/40 bg-card">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32" aria-hidden="true">
        {CONFETTI_PIECES.map((piece, idx) => (
          <span
            key={idx}
            style={{ left: piece.left, animationDelay: piece.delay }}
            className={`animate-confetti-fall absolute top-2 h-2 w-2 rounded-sm ${piece.color}`}
          />
        ))}
      </div>

      <CardContent className="relative flex flex-col items-center gap-4 px-6 py-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-accent">
          <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
        </div>

        <PremiumBadge />

        <div className="space-y-1.5">
          <h2 className="font-heading text-2xl font-bold text-foreground">
            Bem-vindo ao Gavetta+!
          </h2>
          <p className="text-sm text-muted-foreground">
            Sua assinatura está ativa. Aproveite o Gavetta sem anúncios e com todos os recursos liberados.
          </p>
        </div>

        <Button asChild className="mt-2 w-full sm:w-auto">
          <Link to="/profile#estatisticas">
            <BarChart3 className="h-4 w-4 mr-2" aria-hidden="true" />
            Ver minhas estatísticas
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsPremium } from "@/hooks/useIsPremium";
import { useGavettaPlusEnabled } from "@/lib/gavettaPlus";
import { trackEvent } from "@/hooks/useAnalytics";

export interface PremiumGateProps {
  feature: string;
  fallback?: ReactNode;
  children: ReactNode;
}

function DefaultPaywallCard({ feature }: { feature: string }) {
  useEffect(() => {
    trackEvent("paywall_view", { feature });
  }, [feature]);

  return (
    <Card className="border-accent/30 bg-card">
      <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 text-accent">
          <Lock className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">Recurso do Gavetta+</h3>
          <p className="text-sm text-muted-foreground">
            Disponível para assinantes do Gavetta+.
          </p>
        </div>
        <Button asChild size="sm">
          <Link to="/gavetta-plus">Conhecer o Gavetta+</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function PremiumGate({ feature, fallback, children }: PremiumGateProps) {
  const { enabled } = useGavettaPlusEnabled();
  const { isPremium, isLoading } = useIsPremium();

  if (!enabled) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div role="status" aria-busy="true" aria-label="Carregando" className="space-y-2 p-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (isPremium) {
    return <>{children}</>;
  }

  if (fallback !== undefined) {
    return <>{fallback}</>;
  }

  return <DefaultPaywallCard feature={feature} />;
}
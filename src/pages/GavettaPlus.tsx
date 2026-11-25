import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Clock,
  ExternalLink,
  Loader2,
  Minus,
  RefreshCw,
  Settings,
} from "lucide-react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PremiumBadge } from "@/components/premium/PremiumBadge";
import { CheckoutDialog } from "@/components/premium/CheckoutDialog";
import { CheckoutSuccessView } from "@/components/premium/CheckoutSuccessView";
import { useGavettaPlusEnabled } from "@/lib/gavettaPlus";
import { useIsPremium } from "@/hooks/useIsPremium";
import { useAuth } from "@/hooks/useAuth";
import type { BillingPlan } from "@/lib/billing";

const CARD_SESSION_KEY = "gavetta_card_checkout";
const CARD_TIMEOUT_MS = 120_000;

interface ComparisonRow {
  label: string;
  free: boolean | string;
  plus: boolean | string;
}

const COMPARISON_ROWS: ComparisonRow[] = [
  { label: "Gavetas, episódios e amigos", free: true, plus: true },
  { label: "Sem anúncios", free: false, plus: true },
  { label: "Estatísticas e retrospectiva", free: false, plus: true },
  { label: "Alertas quando um título chega no seu streaming", free: false, plus: true },
  { label: "Importação por IA", free: "5/mês", plus: "Ilimitada" },
  { label: "Selo Gavetta+ e temas", free: false, plus: true },
];

const PLUS_FAQS = [
  {
    q: "O que continua grátis?",
    a: "O essencial do Gavetta é grátis para sempre: suas gavetas, controle de episódios, avaliações, amigos e até 5 importações por IA por mês.",
  },
  {
    q: "Como cancelar?",
    a: "Você pode cancelar quando quiser sem multa. Seu acesso ao Gavetta+ continua ativo até o fim do período já pago, e oferecemos reembolso integral em até 7 dias.",
  },
  {
    q: "Quais são as formas de pagamento?",
    a: "Aceitamos Pix (avulso no plano anual e Pix Automático no mensal) e cartão de crédito em ambiente seguro do Asaas. Não armazenamos dados do seu cartão nem seu CPF.",
  },
];

function renderCell(value: boolean | string, highlight = false) {
  if (typeof value === "string") {
    return (
      <span className={`text-xs font-medium ${highlight ? "text-foreground" : "text-muted-foreground"}`}>
        {value}
      </span>
    );
  }
  if (value) {
    return (
      <Check
        className={`mx-auto h-4 w-4 ${highlight ? "text-accent" : "text-primary"}`}
        aria-label="Incluído"
      />
    );
  }
  return <Minus className="mx-auto h-4 w-4 text-muted-foreground/50" aria-label="Não incluído" />;
}

function readPendingCardSession(): { startedAt: number; invoiceUrl: string } | null {
  try {
    const raw = window.sessionStorage.getItem(CARD_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { startedAt?: number; invoiceUrl?: string };
    if (typeof parsed.startedAt !== "number" || typeof parsed.invoiceUrl !== "string") return null;
    if (Date.now() - parsed.startedAt > 15 * 60_000) {
      window.sessionStorage.removeItem(CARD_SESSION_KEY);
      return null;
    }
    return { startedAt: parsed.startedAt, invoiceUrl: parsed.invoiceUrl };
  } catch {
    return null;
  }
}

export default function GavettaPlus() {
  const { enabled, isLoading: flagLoading } = useGavettaPlusEnabled();
  const { isPremium, subscription, isLoading: premiumLoading } = useIsPremium();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedPlan, setSelectedPlan] = useState<BillingPlan>("yearly");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [hadCheckoutInSession, setHadCheckoutInSession] = useState(() => readPendingCardSession() !== null);
  const [justActivated, setJustActivated] = useState(false);
  const [pendingCard, setPendingCard] = useState(() => readPendingCardSession());
  const [cardTimedOut, setCardTimedOut] = useState(false);
  const [legalDialog, setLegalDialog] = useState<"terms" | "privacy" | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Detecta ativação em tempo real após iniciar checkout nesta sessão
  useEffect(() => {
    if (isPremium && hadCheckoutInSession) {
      setJustActivated(true);
      setPendingCard(null);
      try {
        window.sessionStorage.removeItem(CARD_SESSION_KEY);
      } catch {
        // ignore storage errors
      }
    }
  }, [isPremium, hadCheckoutInSession]);

  // Timeout de 2 minutos para confirmação do cartão após retorno
  useEffect(() => {
    if (!pendingCard || isPremium) return;
    const elapsed = Date.now() - pendingCard.startedAt;
    const remaining = CARD_TIMEOUT_MS - elapsed;
    if (remaining <= 0) {
      setCardTimedOut(true);
      return;
    }
    setCardTimedOut(false);
    const timer = window.setTimeout(() => setCardTimedOut(true), remaining);
    return () => window.clearTimeout(timer);
  }, [pendingCard, isPremium]);

  // Ao voltar para a aba depois do pagamento no Asaas, revalida o status
  useEffect(() => {
    if (!pendingCard || isPremium || !user?.id) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        queryClient.invalidateQueries({ queryKey: ["premium-status", user.id] });
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [pendingCard, isPremium, user?.id, queryClient]);

  if (flagLoading || premiumLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!enabled) {
    return <Navigate to="/" replace />;
  }

  const defaultName =
    (typeof user?.user_metadata?.full_name === "string" && user.user_metadata.full_name) ||
    (typeof user?.user_metadata?.name === "string" && user.user_metadata.name) ||
    "";

  const handleCardCheckoutOpened = (invoiceUrl: string) => {
    const session = { startedAt: Date.now(), invoiceUrl };
    setPendingCard(session);
    setCardTimedOut(false);
    try {
      window.sessionStorage.setItem(CARD_SESSION_KEY, JSON.stringify(session));
    } catch {
      // ignore storage errors
    }
  };

  const periodEndFormatted = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString("pt-BR")
    : null;

  return (
    <div className="min-h-screen bg-background pb-24">
      <Helmet>
        <title>Gavetta+ · Gavetta</title>
        <meta name="description" content="Gavetta+: mais do seu cinema, sem anúncios." />
        <meta name="robots" content="noindex" />
      </Helmet>

      <Header />

      <main className="container mx-auto max-w-lg px-4 py-6 space-y-6">
        {justActivated ? (
          <CheckoutSuccessView />
        ) : isPremium ? (
          <Card className="border-accent/40 bg-card">
            <CardContent className="flex flex-col items-center gap-4 px-6 py-8 text-center">
              <PremiumBadge />
              <div className="space-y-1.5">
                <h1 className="font-heading text-2xl font-bold text-foreground">
                  Você já é Gavetta+
                </h1>
                <p className="text-sm text-muted-foreground">
                  {subscription
                    ? `Plano ${subscription.plan === "yearly" ? "anual" : "mensal"}${
                        periodEndFormatted ? ` · válido até ${periodEndFormatted}` : ""
                      }.`
                    : "Seu acesso ao Gavetta+ está ativo."}
                </p>
              </div>
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link to="/profile">
                  <Settings className="h-4 w-4 mr-2" aria-hidden="true" />
                  Gerenciar assinatura
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Topo */}
            <section className="space-y-3 text-center">
              <div className="flex justify-center">
                <PremiumBadge />
              </div>
              <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
                Gavetta+: mais do seu cinema, sem anúncios
              </h1>
              <p className="text-sm text-muted-foreground">
                Apoie o Gavetta e desbloqueie estatísticas, alertas de streaming e importação por IA sem limites.
              </p>
            </section>

            {/* Banner de retorno do pagamento com cartão */}
            {pendingCard && !checkoutOpen && (
              <Card className="border-primary/40 bg-card">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start gap-3">
                    {cardTimedOut ? (
                      <Clock className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    ) : (
                      <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-primary" aria-hidden="true" />
                    )}
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">
                        {cardTimedOut ? "Ainda aguardando confirmação" : "Confirmando pagamento…"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {cardTimedOut
                          ? "A confirmação do cartão pode levar alguns minutos. Assim que for aprovado, seu acesso será liberado automaticamente."
                          : "Assim que o Asaas confirmar seu cartão, esta página atualizará automaticamente."}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline">
                      <a href={pendingCard.invoiceUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                        Abrir pagamento
                      </a>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        user?.id && queryClient.invalidateQueries({ queryKey: ["premium-status", user.id] })
                      }
                    >
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                      Verificar agora
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Seletor de planos */}
            <section className="space-y-3" aria-label="Escolha seu plano">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Planos Gavetta+">
                <button
                  type="button"
                  role="radio"
                  aria-checked={selectedPlan === "yearly"}
                  onClick={() => setSelectedPlan("yearly")}
                  className={`relative flex flex-col justify-between rounded-xl border p-4 text-left transition-all ${
                    selectedPlan === "yearly"
                      ? "border-accent bg-accent/10 ring-2 ring-accent/30"
                      : "border-border bg-card hover:border-accent/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-heading text-base font-bold text-foreground">Anual</span>
                    <Badge className="bg-accent text-accent-foreground hover:bg-accent text-[11px] font-semibold">
                      economize 37%
                    </Badge>
                  </div>
                  <div className="mt-3">
                    <p className="text-2xl font-bold text-foreground">
                      R$ 59,90<span className="text-sm font-normal text-muted-foreground">/ano</span>
                    </p>
                    <p className="text-xs text-muted-foreground">Equivale a R$ 4,99/mês</p>
                  </div>
                </button>

                <button
                  type="button"
                  role="radio"
                  aria-checked={selectedPlan === "monthly"}
                  onClick={() => setSelectedPlan("monthly")}
                  className={`flex flex-col justify-between rounded-xl border p-4 text-left transition-all ${
                    selectedPlan === "monthly"
                      ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                      : "border-border bg-card hover:border-primary/50"
                  }`}
                >
                  <span className="font-heading text-base font-bold text-foreground">Mensal</span>
                  <div className="mt-3">
                    <p className="text-2xl font-bold text-foreground">
                      R$ 7,90<span className="text-sm font-normal text-muted-foreground">/mês</span>
                    </p>
                    <p className="text-xs text-muted-foreground">Cobrança recorrente mensal</p>
                  </div>
                </button>
              </div>

              <Button size="lg" className="w-full" onClick={() => setCheckoutOpen(true)}>
                Assinar Gavetta+
              </Button>
            </section>

            {/* Comparativo Grátis x Gavetta+ */}
            <section aria-label="Comparativo de planos">
              <Card className="bg-card">
                <CardContent className="p-4">
                  <div className="grid grid-cols-[1fr_64px_76px] items-center gap-2 border-b border-border pb-3 text-xs font-semibold">
                    <span className="text-muted-foreground">Recursos</span>
                    <span className="text-center text-muted-foreground">Grátis</span>
                    <span className="text-center text-foreground">Gavetta+</span>
                  </div>
                  <ul className="divide-y divide-border/60">
                    {COMPARISON_ROWS.map((row) => (
                      <li
                        key={row.label}
                        className="grid grid-cols-[1fr_64px_76px] items-center gap-2 py-3 text-sm"
                      >
                        <span className="text-foreground">{row.label}</span>
                        <span className="text-center">{renderCell(row.free)}</span>
                        <span className="text-center">{renderCell(row.plus, true)}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </section>

            {/* FAQ curto */}
            <section className="space-y-3" aria-label="Perguntas frequentes">
              <h2 className="font-heading text-lg font-bold text-foreground">Dúvidas rápidas</h2>
              <Accordion type="single" collapsible className="rounded-lg bg-card px-4">
                {PLUS_FAQS.map((item, idx) => (
                  <AccordionItem key={idx} value={`plus-faq-${idx}`} className="border-border/60 last:border-b-0">
                    <AccordionTrigger className="text-left text-sm font-semibold">
                      {item.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">
                      {item.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>

            {/* Rodapé */}
            <footer className="space-y-2 pt-2 text-center text-xs text-muted-foreground">
              <p>Cancele quando quiser. Reembolso integral em até 7 dias.</p>
              <div className="flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => setLegalDialog("terms")}
                  className="underline underline-offset-4 hover:text-foreground"
                >
                  Termos de Uso
                </button>
                <button
                  type="button"
                  onClick={() => setLegalDialog("privacy")}
                  className="underline underline-offset-4 hover:text-foreground"
                >
                  Política de Privacidade
                </button>
              </div>
            </footer>
          </>
        )}
      </main>

      <BottomNav />

      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        plan={selectedPlan}
        defaultName={defaultName}
        isPremium={isPremium}
        onCheckoutStarted={() => setHadCheckoutInSession(true)}
        onCardCheckoutOpened={handleCardCheckoutOpened}
      />

      <Dialog open={legalDialog !== null} onOpenChange={(open) => !open && setLegalDialog(null)}>
        <DialogContent className="z-[60] max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {legalDialog === "terms" ? "Termos de Uso · Gavetta+" : "Política de Privacidade · Gavetta+"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            {legalDialog === "terms" ? (
              <>
                <p>
                  A assinatura do Gavetta+ libera os recursos exclusivos na sua conta enquanto o plano estiver ativo.
                </p>
                <p>
                  Você pode cancelar a qualquer momento. Em caso de arrependimento, garantimos reembolso integral em até 7 dias corridos após o primeiro pagamento.
                </p>
              </>
            ) : (
              <>
                <p>
                  Seus pagamentos são processados com segurança pelo Asaas. O Gavetta não armazena seu CPF nem os dados do seu cartão de crédito.
                </p>
                <p>
                  Guardamos apenas o status e o período da sua assinatura para manter o acesso ao Gavetta+ sincronizado.
                </p>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
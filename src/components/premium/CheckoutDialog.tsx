import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Copy,
  CreditCard,
  ExternalLink,
  Loader2,
  QrCode,
  Clock,
  RefreshCw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  startBillingCheckout,
  type BillingMethod,
  type BillingPlan,
  type CheckoutResponse,
} from "@/lib/billing";
import { formatCpf, isValidCpf } from "@/lib/cpf";

const CARD_CONFIRM_TIMEOUT_MS = 120_000;

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: BillingPlan;
  defaultName: string;
  isPremium: boolean;
  onCheckoutStarted: () => void;
  onCardCheckoutOpened: (invoiceUrl: string) => void;
}

function formatExpiration(iso?: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CheckoutDialog({
  open,
  onOpenChange,
  plan,
  defaultName,
  isPremium,
  onCheckoutStarted,
  onCardCheckoutOpened,
}: CheckoutDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [name, setName] = useState(defaultName);
  const [cpf, setCpf] = useState("");
  const [method, setMethod] = useState<BillingMethod>("pix");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<CheckoutResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [cardTimedOut, setCardTimedOut] = useState(false);

  // Reset completo ao abrir/fechar (nunca reter CPF entre aberturas)
  useEffect(() => {
    if (!open) {
      setName(defaultName);
      setCpf("");
      setMethod("pix");
      setSubmitting(false);
      setError(null);
      setCheckout(null);
      setCopied(false);
      setCardTimedOut(false);
    } else if (!name && defaultName) {
      setName(defaultName);
    }
  }, [open, defaultName]);

  // Timeout de 2 minutos na espera por confirmação do cartão
  useEffect(() => {
    if (!open || checkout?.method !== "credit_card" || isPremium) return;
    setCardTimedOut(false);
    const timer = window.setTimeout(() => {
      setCardTimedOut(true);
    }, CARD_CONFIRM_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [open, checkout?.method, isPremium]);

  // Fecha o dialog assim que o Realtime confirmar a assinatura ativa
  useEffect(() => {
    if (open && checkout && isPremium) {
      onOpenChange(false);
    }
  }, [open, checkout, isPremium, onOpenChange]);

  const planLabel = plan === "yearly" ? "Anual — R$ 59,90/ano" : "Mensal — R$ 7,90/mês";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      setError("Informe seu nome completo.");
      return;
    }
    if (!isValidCpf(cpf)) {
      setError("CPF inválido. Confira os números digitados.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await startBillingCheckout({
        plan,
        method,
        cpf,
        name: trimmedName,
      });
      setCheckout(result);
      onCheckoutStarted();

      if (result.method === "credit_card" && result.invoiceUrl) {
        onCardCheckoutOpened(result.invoiceUrl);
        window.open(result.invoiceUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Não foi possível iniciar o pagamento. Tente novamente.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyPix = async () => {
    if (!checkout?.pixCopyPaste) return;
    try {
      await navigator.clipboard.writeText(checkout.pixCopyPaste);
      setCopied(true);
      toast({ title: "Código Pix copiado!", description: "Cole no app do seu banco para pagar." });
      window.setTimeout(() => setCopied(false), 3000);
    } catch {
      toast({
        title: "Não foi possível copiar",
        description: "Selecione e copie o código manualmente.",
        variant: "destructive",
      });
    }
  };

  const handleRecheckStatus = () => {
    if (user?.id) {
      queryClient.invalidateQueries({ queryKey: ["premium-status", user.id] });
    }
  };

  const expirationFormatted = formatExpiration(checkout?.expirationDate);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="z-[60] max-w-md">
        {!checkout ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-heading">Assinar Gavetta+</DialogTitle>
              <DialogDescription>{planLabel}</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="checkout-name">Nome completo</Label>
                <Input
                  id="checkout-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome completo"
                  autoComplete="name"
                  disabled={submitting}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="checkout-cpf">CPF</Label>
                <Input
                  id="checkout-cpf"
                  inputMode="numeric"
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  disabled={submitting}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Usado apenas para emitir a cobrança. Não salvamos seu CPF.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Forma de pagamento</Label>
                <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Forma de pagamento">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={method === "pix"}
                    disabled={submitting}
                    onClick={() => setMethod("pix")}
                    className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-medium transition-colors ${
                      method === "pix"
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-background text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <QrCode className="h-4 w-4" aria-hidden="true" />
                    Pix
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={method === "credit_card"}
                    disabled={submitting}
                    onClick={() => setMethod("credit_card")}
                    className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-medium transition-colors ${
                      method === "credit_card"
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-background text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <CreditCard className="h-4 w-4" aria-hidden="true" />
                    Cartão
                  </button>
                </div>
              </div>

              {error && (
                <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                    Gerando pagamento...
                  </>
                ) : method === "pix" ? (
                  "Gerar QR Code Pix"
                ) : (
                  "Continuar para pagamento"
                )}
              </Button>
            </form>
          </>
        ) : checkout.method === "credit_card" ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-heading">
                {cardTimedOut ? "Ainda aguardando confirmação" : "Confirmando pagamento…"}
              </DialogTitle>
              <DialogDescription>
                {cardTimedOut
                  ? "A confirmação do cartão pode levar alguns minutos. Assim que for aprovado, o Gavetta+ é liberado automaticamente na sua conta."
                  : "Conclua o pagamento na página segura do Asaas. Esta tela atualiza automaticamente assim que for aprovado."}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center gap-4 py-4 text-center">
              {cardTimedOut ? (
                <Clock className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
              ) : (
                <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden="true" />
              )}

              {checkout.invoiceUrl && (
                <Button asChild variant={cardTimedOut ? "outline" : "default"} className="w-full">
                  <a href={checkout.invoiceUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" aria-hidden="true" />
                    Abrir página de pagamento
                  </a>
                </Button>
              )}

              {cardTimedOut && (
                <Button type="button" variant="secondary" className="w-full" onClick={handleRecheckStatus}>
                  <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
                  Verificar novamente
                </Button>
              )}
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-heading">Pague com Pix</DialogTitle>
              <DialogDescription>
                {checkout.method === "pix_automatico"
                  ? "Escaneie ou copie o código para pagar a primeira mensalidade e ativar o Pix Automático."
                  : "Escaneie o QR Code ou copie o código no app do seu banco."}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center gap-4 py-2">
              {checkout.qrCodeBase64 && (
                <div className="rounded-lg border border-border bg-white p-3">
                  <img
                    src={`data:image/png;base64,${checkout.qrCodeBase64}`}
                    alt="QR Code Pix para assinatura Gavetta+"
                    className="h-48 w-48 object-contain"
                  />
                </div>
              )}

              {checkout.pixCopyPaste && (
                <Button type="button" className="w-full" onClick={handleCopyPix}>
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-2" aria-hidden="true" />
                      Código copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" aria-hidden="true" />
                      Copiar código Pix
                    </>
                  )}
                </Button>
              )}

              <div className="w-full space-y-2 rounded-lg bg-muted/60 p-3 text-center text-xs text-muted-foreground">
                <p>
                  {expirationFormatted
                    ? `Este código Pix é válido até ${expirationFormatted}.`
                    : "Este código Pix tem validade de 24 horas."}
                </p>
                <p className="inline-flex items-center justify-center gap-1.5 font-medium text-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" aria-hidden="true" />
                  Aguardando confirmação do pagamento…
                </p>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
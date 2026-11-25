import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/hooks/useAnalytics";

export type BillingPlan = "monthly" | "yearly";
export type BillingMethod = "pix" | "credit_card";

export interface CheckoutRequest {
  plan: BillingPlan;
  method: BillingMethod;
  cpf: string;
  name: string;
}

export interface CheckoutResponse {
  subscriptionId: string;
  plan: BillingPlan;
  method: "pix" | "pix_automatico" | "credit_card";
  value: number;
  paymentId?: string | null;
  authorizationId?: string | null;
  providerSubscriptionId?: string | null;
  qrCodeBase64?: string | null;
  pixCopyPaste?: string | null;
  expirationDate?: string | null;
  invoiceUrl?: string | null;
}

export async function startBillingCheckout(payload: CheckoutRequest): Promise<CheckoutResponse> {
  trackEvent("checkout_start", { plan: payload.plan, method: payload.method });

  const { data, error } = await supabase.functions.invoke("billing-checkout", {
    body: payload,
  });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      try {
        const parsed = await error.context.json();
        throw new Error(parsed?.message || parsed?.error || "Não foi possível iniciar o pagamento.");
      } catch (e) {
        if (e instanceof Error && e.message) throw e;
      }
    }
    throw new Error("Não foi possível iniciar o pagamento. Tente novamente.");
  }

  return data as CheckoutResponse;
}
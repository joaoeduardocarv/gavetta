import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { isValidCpf, stripCpf } from "./cpf.ts";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/asaas";

const PLAN_PRICES = {
  monthly: 7.9,
  yearly: 59.9,
} as const;

type Plan = keyof typeof PLAN_PRICES;
type Method = "pix" | "credit_card";

class AsaasError extends Error {
  status: number;
  userMessage: string;
  constructor(status: number, userMessage: string, internalMessage: string) {
    super(internalMessage);
    this.status = status;
    this.userMessage = userMessage;
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function formatSaoPauloDate(addDays = 0): string {
  const target = new Date(Date.now() + addDays * 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(target);
  const year = parts.find((p) => p.type === "year")?.value ?? "2026";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function mapAsaasError(status: number, rawBody: string): string {
  let code = "";
  let desc = "";
  try {
    const parsed = JSON.parse(rawBody);
    const first = Array.isArray(parsed?.errors) ? parsed.errors[0] : null;
    code = String(first?.code ?? "").toLowerCase();
    desc = String(first?.description ?? "").toLowerCase();
  } catch {
    // ignore non-JSON body
  }

  if (code.includes("cpf") || desc.includes("cpf") || code === "invalid_customer") {
    return "Não foi possível validar seus dados cadastrais (CPF ou nome). Confira e tente novamente.";
  }
  if (desc.includes("chave pix") || desc.includes("pix key") || code.includes("pix")) {
    return "O pagamento via Pix está temporariamente indisponível. Tente novamente em instantes ou use cartão.";
  }
  if (status === 429) {
    return "Muitas tentativas em sequência. Aguarde alguns segundos e tente novamente.";
  }
  if (status === 401 || status === 403) {
    return "Serviço de pagamento indisponível no momento. Tente novamente mais tarde.";
  }
  return "Não foi possível iniciar o pagamento agora. Tente novamente em alguns instantes.";
}

async function asaasRequest<T = Record<string, unknown>>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const asaasKey = Deno.env.get("ASAAS_CONNECTION_KEY");
  if (!lovableKey || !asaasKey) {
    throw new AsaasError(
      503,
      "Serviço de pagamento não configurado no momento.",
      "Missing LOVABLE_API_KEY or ASAAS_CONNECTION_KEY",
    );
  }

  const res = await fetch(`${GATEWAY_URL}/${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": asaasKey,
      "Content-Type": "application/json",
    },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  });

  if (!res.ok) {
    const raw = await res.text();
    console.error(`Asaas ${init.method ?? "GET"} ${path} failed [${res.status}]: ${raw}`);
    throw new AsaasError(
      res.status >= 400 && res.status < 500 ? 400 : 502,
      mapAsaasError(res.status, raw),
      `Asaas ${path} [${res.status}]`,
    );
  }

  return (await res.json()) as T;
}

async function findOrCreateCustomer(params: {
  existingCustomerId: string | null;
  cpfDigits: string;
  name: string;
  email: string;
  userId: string;
}): Promise<string> {
  if (params.existingCustomerId) {
    return params.existingCustomerId;
  }

  const byRef = await asaasRequest<{ data?: Array<{ id: string }> }>(
    `customers?externalReference=${encodeURIComponent(params.userId)}`,
  );
  if (byRef.data && byRef.data.length > 0 && byRef.data[0]?.id) {
    return byRef.data[0].id;
  }

  const byCpf = await asaasRequest<{ data?: Array<{ id: string }> }>(
    `customers?cpfCnpj=${encodeURIComponent(params.cpfDigits)}`,
  );
  if (byCpf.data && byCpf.data.length > 0 && byCpf.data[0]?.id) {
    return byCpf.data[0].id;
  }

  const created = await asaasRequest<{ id: string }>("customers", {
    method: "POST",
    body: {
      name: params.name,
      cpfCnpj: params.cpfDigits,
      email: params.email,
      externalReference: params.userId,
      notificationDisabled: true,
    },
  });

  return created.id;
}

async function findActivePixKey(): Promise<string | null> {
  try {
    const res = await asaasRequest<{ data?: Array<{ key?: string; status?: string }> }>(
      "pix/addressKeys?status=ACTIVE",
    );
    const active = res.data?.find((k) => k.key);
    return active?.key ?? null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "METHOD_NOT_ALLOWED", message: "Método não permitido." }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "UNAUTHORIZED", message: "Sessão inválida. Faça login novamente." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
    if (claimsErr || !userId) {
      return jsonResponse({ error: "UNAUTHORIZED", message: "Sessão inválida. Faça login novamente." }, 401);
    }

    let userEmail = typeof claimsData?.claims?.email === "string" ? claimsData.claims.email : "";
    if (!userEmail) {
      const adminClient = createClient(supabaseUrl, serviceRoleKey);
      const { data: adminUser } = await adminClient.auth.admin.getUserById(userId);
      userEmail = adminUser?.user?.email ?? "";
    }

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return jsonResponse({ error: "INVALID_BODY", message: "Dados de pagamento inválidos." }, 400);
    }

    const plan = body.plan;
    const method = body.method;
    const rawCpf = typeof body.cpf === "string" ? body.cpf : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (plan !== "monthly" && plan !== "yearly") {
      return jsonResponse({ error: "INVALID_PLAN", message: "Plano inválido. Escolha mensal ou anual." }, 400);
    }
    if (method !== "pix" && method !== "credit_card") {
      return jsonResponse({ error: "INVALID_METHOD", message: "Forma de pagamento inválida." }, 400);
    }
    if (name.length < 2 || name.length > 120) {
      return jsonResponse({ error: "INVALID_NAME", message: "Informe seu nome completo." }, 400);
    }
    if (!isValidCpf(rawCpf)) {
      return jsonResponse({ error: "INVALID_CPF", message: "CPF inválido. Confira os números digitados." }, 400);
    }

    const cpfDigits = stripCpf(rawCpf);
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    // 1. Bloqueia se o usuário já for premium
    const { data: alreadyPremium, error: premiumErr } = await serviceClient.rpc("is_premium", {
      _user_id: userId,
    });
    if (premiumErr) {
      console.error("is_premium RPC failed:", premiumErr);
      return jsonResponse({ error: "INTERNAL_ERROR", message: "Erro ao verificar sua assinatura." }, 500);
    }
    if (alreadyPremium) {
      return jsonResponse({ error: "ALREADY_PREMIUM", message: "Você já possui o Gavetta+ ativo." }, 409);
    }

    // 2. Busca customer salvo e eventual assinatura pendente
    const { data: existingRows, error: subFetchErr } = await serviceClient
      .from("subscriptions")
      .select("id, status, provider_customer_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);

    if (subFetchErr) {
      console.error("Failed reading subscriptions:", subFetchErr);
      return jsonResponse({ error: "INTERNAL_ERROR", message: "Erro ao preparar sua assinatura." }, 500);
    }

    const savedCustomerId = existingRows?.find((r) => r.provider_customer_id)?.provider_customer_id ?? null;
    const pendingRow = existingRows?.find((r) => r.status === "pending") ?? null;

    // 3. Busca ou cria cliente no Asaas (CPF nunca é gravado no nosso banco)
    const customerId = await findOrCreateCustomer({
      existingCustomerId: savedCustomerId,
      cpfDigits,
      name,
      email: userEmail,
      userId,
    });

    const storedPaymentMethod = plan === "monthly" && method === "pix" ? "pix_automatico" : method;
    const value = PLAN_PRICES[plan as Plan];

    // 4. Grava/atualiza linha pendente com provider_customer_id antes da cobrança
    let subscriptionRowId: string;
    if (pendingRow) {
      const { error: updErr } = await serviceClient
        .from("subscriptions")
        .update({
          plan,
          payment_method: storedPaymentMethod,
          provider_customer_id: customerId,
          status: "pending",
        })
        .eq("id", pendingRow.id);
      if (updErr) {
        console.error("Failed updating pending subscription:", updErr);
        return jsonResponse({ error: "INTERNAL_ERROR", message: "Erro ao salvar dados da assinatura." }, 500);
      }
      subscriptionRowId = pendingRow.id;
    } else {
      const { data: inserted, error: insErr } = await serviceClient
        .from("subscriptions")
        .insert({
          user_id: userId,
          provider: "asaas",
          provider_customer_id: customerId,
          plan,
          payment_method: storedPaymentMethod,
          status: "pending",
        })
        .select("id")
        .single();
      if (insErr || !inserted) {
        console.error("Failed inserting pending subscription:", insErr);
        return jsonResponse({ error: "INTERNAL_ERROR", message: "Erro ao registrar sua assinatura." }, 500);
      }
      subscriptionRowId = inserted.id;
    }

    // Registra início de checkout (telemetria server-side)
    void serviceClient.from("feature_events").insert({
      user_id: userId,
      feature: "checkout_start",
      metadata: { plan, method },
    });

    // 5. Fluxos por plano e método
    if (plan === "yearly" && method === "pix") {
      const dueDate = formatSaoPauloDate(1);
      const payment = await asaasRequest<{ id: string }>("payments", {
        method: "POST",
        body: {
          customer: customerId,
          billingType: "PIX",
          value,
          dueDate,
          description: "Gavetta+ anual",
          externalReference: userId,
        },
      });

      const qr = await asaasRequest<{
        encodedImage: string;
        payload: string;
        expirationDate?: string;
      }>(`payments/${payment.id}/pixQrCode`);

      await serviceClient
        .from("subscriptions")
        .update({
          provider_payment_id: payment.id,
          provider_subscription_id: null,
        })
        .eq("id", subscriptionRowId);

      return jsonResponse({
        subscriptionId: subscriptionRowId,
        plan,
        method: "pix",
        value,
        paymentId: payment.id,
        qrCodeBase64: qr.encodedImage,
        pixCopyPaste: qr.payload,
        expirationDate: qr.expirationDate ?? null,
      });
    }

    if (plan === "monthly" && method === "pix") {
      const startDate = formatSaoPauloDate(0);
      const contractId = `gav-${userId.replace(/-/g, "").slice(0, 31)}`;
      const pixKey = await findActivePixKey();

      const immediateQrCode: Record<string, unknown> = {
        expirationSeconds: 86400,
        originalValue: value,
        description: "Gavetta+ mensal",
      };
      if (pixKey) {
        immediateQrCode.pixKey = pixKey;
      }

      const authResp = await asaasRequest<{
        id: string;
        subscriptionId?: string | null;
        encodedImage?: string | null;
        payload?: string | null;
        immediateQrCode?: {
          conciliationIdentifier?: string | null;
          expirationDate?: string | null;
        } | null;
      }>("pix/automatic/authorizations", {
        method: "POST",
        body: {
          frequency: "MONTHLY",
          contractId,
          startDate,
          value,
          description: "Gavetta+ mensal",
          customerId,
          paymentCreationMode: "SUBSCRIPTION",
          immediateQrCode,
        },
      });

      await serviceClient
        .from("subscriptions")
        .update({
          provider_subscription_id: authResp.subscriptionId ?? authResp.id,
          provider_payment_id: authResp.immediateQrCode?.conciliationIdentifier ?? null,
        })
        .eq("id", subscriptionRowId);

      return jsonResponse({
        subscriptionId: subscriptionRowId,
        plan,
        method: "pix_automatico",
        value,
        authorizationId: authResp.id,
        providerSubscriptionId: authResp.subscriptionId ?? null,
        qrCodeBase64: authResp.encodedImage ?? null,
        pixCopyPaste: authResp.payload ?? null,
        expirationDate: authResp.immediateQrCode?.expirationDate ?? null,
      });
    }

    // credit_card (monthly ou yearly)
    const nextDueDate = formatSaoPauloDate(0);
    const cycle = plan === "monthly" ? "MONTHLY" : "YEARLY";
    const description = plan === "monthly" ? "Gavetta+ mensal" : "Gavetta+ anual";

    const asaasSub = await asaasRequest<{ id: string }>("subscriptions", {
      method: "POST",
      body: {
        customer: customerId,
        billingType: "CREDIT_CARD",
        value,
        nextDueDate,
        cycle,
        description,
        externalReference: userId,
      },
    });

    const subPayments = await asaasRequest<{
      data?: Array<{ id: string; invoiceUrl?: string | null }>;
    }>(`subscriptions/${asaasSub.id}/payments`);

    const firstPayment = subPayments.data?.[0] ?? null;
    if (!firstPayment?.invoiceUrl) {
      console.error("Asaas subscription created without invoiceUrl:", asaasSub.id);
      return jsonResponse(
        {
          error: "PAYMENT_URL_UNAVAILABLE",
          message: "Não foi possível gerar o link de pagamento. Tente novamente em instantes.",
        },
        502,
      );
    }

    await serviceClient
      .from("subscriptions")
      .update({
        provider_subscription_id: asaasSub.id,
        provider_payment_id: firstPayment.id,
      })
      .eq("id", subscriptionRowId);

    return jsonResponse({
      subscriptionId: subscriptionRowId,
      plan,
      method: "credit_card",
      value,
      providerSubscriptionId: asaasSub.id,
      paymentId: firstPayment.id,
      invoiceUrl: firstPayment.invoiceUrl,
    });
  } catch (err) {
    if (err instanceof AsaasError) {
      return jsonResponse({ error: "PAYMENT_PROVIDER_ERROR", message: err.userMessage }, err.status);
    }
    console.error("billing-checkout unexpected error:", err);
    return jsonResponse(
      { error: "INTERNAL_ERROR", message: "Não foi possível processar o pagamento agora. Tente novamente." },
      500,
    );
  }
});
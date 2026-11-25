import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { authenticateCronRequest } from "../_shared/cron-auth.ts";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/asaas";
const PAID_STATUSES = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function asaasGet<T = Record<string, unknown>>(path: string): Promise<T | null> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const asaasKey = Deno.env.get("ASAAS_CONNECTION_KEY");
  if (!lovableKey || !asaasKey) {
    throw new Error("Asaas credentials not configured");
  }
  const res = await fetch(`${GATEWAY_URL}/${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": asaasKey,
      "Content-Type": "application/json",
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Asaas GET ${path} [${res.status}]: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

function parseDate(raw: unknown): Date {
  if (typeof raw === "string" && raw.trim()) {
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw.trim()) ? `${raw.trim()}T12:00:00Z` : raw.trim();
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

function addPlanPeriod(start: Date, plan: string): Date {
  const end = new Date(start.getTime());
  if (plan === "yearly") end.setUTCFullYear(end.getUTCFullYear() + 1);
  else end.setUTCMonth(end.getUTCMonth() + 1);
  return end;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const authError = authenticateCronRequest(req);
  if (authError) {
    const match = /^Bearer ([^\s,]+)$/.exec(req.headers.get("authorization") ?? "");
    const token = match?.[1] ?? "";
    const { data: valid } = token
      ? await service.rpc("verify_billing_reconcile_token", { _token: token })
      : { data: false };
    if (!valid) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const oneHourAgoIso = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const sevenDaysAgoMs = now.getTime() - 7 * 24 * 60 * 60 * 1000;

  const stats = {
    canceledExpired: 0,
    pendingChecked: 0,
    pendingUpdated: 0,
    activeChecked: 0,
    activeUpdated: 0,
    errors: 0,
  };

  try {
    // 1. Marca como 'expired' as 'canceled' cujo período já acabou
    const { data: expiredCanceled } = await service
      .from("subscriptions")
      .update({ status: "expired" })
      .eq("status", "canceled")
      .not("current_period_end", "is", null)
      .lte("current_period_end", nowIso)
      .select("id");
    stats.canceledExpired = expiredCanceled?.length ?? 0;

    // 2. Consulta 'pending' com mais de 1 hora
    const { data: pendingRows } = await service
      .from("subscriptions")
      .select("id, user_id, plan, payment_method, status, provider_subscription_id, provider_payment_id, first_paid_at, created_at")
      .eq("status", "pending")
      .lt("created_at", oneHourAgoIso)
      .order("created_at", { ascending: true })
      .limit(50);

    for (const sub of pendingRows ?? []) {
      stats.pendingChecked++;
      try {
        let payment: Record<string, unknown> | null = null;
        if (sub.provider_payment_id && sub.provider_payment_id.startsWith("pay_")) {
          payment = await asaasGet<Record<string, unknown>>(`payments/${sub.provider_payment_id}`);
        } else if (sub.provider_subscription_id && sub.provider_subscription_id.startsWith("sub_")) {
          const list = await asaasGet<{ data?: Array<Record<string, unknown>> }>(
            `subscriptions/${sub.provider_subscription_id}/payments?limit=1`,
          );
          payment = list?.data?.[0] ?? null;
        } else {
          const list = await asaasGet<{ data?: Array<Record<string, unknown>> }>(
            `payments?externalReference=${encodeURIComponent(sub.user_id)}&limit=1`,
          );
          payment = list?.data?.[0] ?? null;
        }

        const payStatus = typeof payment?.status === "string" ? payment.status : null;
        if (payStatus && PAID_STATUSES.has(payStatus)) {
          const paidAt = parseDate(payment?.paymentDate ?? payment?.confirmedDate ?? nowIso);
          const periodEnd = addPlanPeriod(paidAt, sub.plan);
          await service
            .from("subscriptions")
            .update({
              status: "active",
              current_period_start: paidAt.toISOString(),
              current_period_end: periodEnd.toISOString(),
              first_paid_at: sub.first_paid_at ?? paidAt.toISOString(),
              provider_payment_id: typeof payment?.id === "string" ? payment.id : sub.provider_payment_id,
            })
            .eq("id", sub.id);

          await service.from("notifications").insert({
            user_id: sub.user_id,
            type: "billing_activated",
            title: "Bem-vindo ao Gavetta+!",
            message:
              sub.plan === "yearly"
                ? "Sua assinatura anual do Gavetta+ está ativa."
                : "Sua assinatura mensal do Gavetta+ está ativa.",
            event_key: `billing_reconcile_activated:${sub.id}`,
            context: { plan: sub.plan, method: sub.payment_method, subscription_id: sub.id },
          });

          await service.from("feature_events").insert({
            user_id: sub.user_id,
            feature: "checkout_success",
            metadata: { plan: sub.plan, method: sub.payment_method, subscription_id: sub.id, source: "reconcile" },
          });
          stats.pendingUpdated++;
        } else if (payStatus === "REFUNDED") {
          await service.from("subscriptions").update({ status: "refunded", current_period_end: nowIso }).eq("id", sub.id);
          stats.pendingUpdated++;
        } else if (payStatus === "OVERDUE") {
          await service.from("subscriptions").update({ status: "past_due" }).eq("id", sub.id);
          stats.pendingUpdated++;
        } else if (new Date(sub.created_at).getTime() < sevenDaysAgoMs) {
          await service.from("subscriptions").update({ status: "expired" }).eq("id", sub.id);
          stats.pendingUpdated++;
        }
      } catch (e) {
        stats.errors++;
        console.error("billing-reconcile pending error:", sub.id, e);
      }
    }

    // 3. Consulta 'active' com período vencido
    const { data: activeExpiredRows } = await service
      .from("subscriptions")
      .select("id, user_id, plan, payment_method, status, provider_subscription_id, provider_payment_id, current_period_end")
      .eq("status", "active")
      .not("current_period_end", "is", null)
      .lte("current_period_end", nowIso)
      .limit(50);

    for (const sub of activeExpiredRows ?? []) {
      stats.activeChecked++;
      try {
        if (!sub.provider_subscription_id || !sub.provider_subscription_id.startsWith("sub_")) {
          // Cobrança avulsa (ex.: anual Pix) vencida
          await service.from("subscriptions").update({ status: "expired" }).eq("id", sub.id);
          stats.activeUpdated++;
          continue;
        }

        const list = await asaasGet<{ data?: Array<Record<string, unknown>> }>(
          `subscriptions/${sub.provider_subscription_id}/payments?limit=3`,
        );
        const payments = list?.data ?? [];
        const newestPaid = payments.find(
          (p) => typeof p.status === "string" && PAID_STATUSES.has(p.status),
        );
        const newestOverdue = payments.find((p) => p.status === "OVERDUE");

        if (newestPaid) {
          const paidAt = parseDate(newestPaid.paymentDate ?? newestPaid.confirmedDate ?? nowIso);
          const newEnd = addPlanPeriod(paidAt, sub.plan);
          const currentEnd = sub.current_period_end ? new Date(sub.current_period_end) : new Date(0);
          if (newEnd > currentEnd) {
            await service
              .from("subscriptions")
              .update({
                current_period_start: paidAt.toISOString(),
                current_period_end: newEnd.toISOString(),
                provider_payment_id:
                  typeof newestPaid.id === "string" ? newestPaid.id : sub.provider_payment_id,
              })
              .eq("id", sub.id);
            stats.activeUpdated++;
            continue;
          }
        }

        if (newestOverdue) {
          await service.from("subscriptions").update({ status: "past_due" }).eq("id", sub.id);
          stats.activeUpdated++;
        } else {
          await service.from("subscriptions").update({ status: "expired" }).eq("id", sub.id);
          stats.activeUpdated++;
        }
      } catch (e) {
        stats.errors++;
        console.error("billing-reconcile active error:", sub.id, e);
      }
    }

    return json({ ok: true, stats }, 200);
  } catch (err) {
    console.error("billing-reconcile fatal error:", err);
    return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
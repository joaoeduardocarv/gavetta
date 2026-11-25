import { createHash, timingSafeEqual } from "node:crypto";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function tokensMatch(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const digest = (v: string) => createHash("sha256").update(v, "utf8").digest();
  return timingSafeEqual(digest(provided), digest(expected));
}

function parsePaymentDate(payment: Record<string, unknown>): Date {
  const candidates = [
    payment.paymentDate,
    payment.confirmedDate,
    payment.clientPaymentDate,
  ];
  for (const raw of candidates) {
    if (typeof raw === "string" && raw.trim()) {
      const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw.trim())
        ? `${raw.trim()}T12:00:00Z`
        : raw.trim();
      const d = new Date(iso);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return new Date();
}

function addPlanPeriod(start: Date, plan: string): Date {
  const end = new Date(start.getTime());
  if (plan === "yearly") {
    end.setUTCFullYear(end.getUTCFullYear() + 1);
  } else {
    end.setUTCMonth(end.getUTCMonth() + 1);
  }
  return end;
}

interface SubRow {
  id: string;
  user_id: string;
  plan: string;
  payment_method: string;
  status: string;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  provider_payment_id: string | null;
  current_period_end: string | null;
  first_paid_at: string | null;
}

// deno-lint-ignore no-explicit-any
async function findSubscription(service: any, body: Record<string, unknown>): Promise<SubRow | null> {
  const payment = (body.payment ?? null) as Record<string, unknown> | null;
  const subObj = (body.subscription ?? null) as Record<string, unknown> | null;
  const pixAuth = (body.pixAutomaticAuthorization ?? body.authorization ?? null) as Record<string, unknown> | null;

  const providerSubIds = [
    payment?.subscription,
    subObj?.id,
    pixAuth?.subscriptionId,
    pixAuth?.id,
  ].filter((v): v is string => typeof v === "string" && v.length > 0);

  for (const subId of providerSubIds) {
    const { data } = await service
      .from("subscriptions")
      .select("id, user_id, plan, payment_method, status, provider_customer_id, provider_subscription_id, provider_payment_id, current_period_end, first_paid_at")
      .eq("provider_subscription_id", subId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data as SubRow;
  }

  const immediateQr = (pixAuth?.immediateQrCode ?? null) as Record<string, unknown> | null;
  const providerPaymentIds = [
    payment?.id,
    immediateQr?.conciliationIdentifier,
  ].filter((v): v is string => typeof v === "string" && v.length > 0);

  for (const payId of providerPaymentIds) {
    const { data } = await service
      .from("subscriptions")
      .select("id, user_id, plan, payment_method, status, provider_customer_id, provider_subscription_id, provider_payment_id, current_period_end, first_paid_at")
      .eq("provider_payment_id", payId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data as SubRow;
  }

  const externalRefs = [
    payment?.externalReference,
    subObj?.externalReference,
  ].filter((v): v is string => typeof v === "string" && v.length > 0);

  for (const ref of externalRefs) {
    const { data } = await service
      .from("subscriptions")
      .select("id, user_id, plan, payment_method, status, provider_customer_id, provider_subscription_id, provider_payment_id, current_period_end, first_paid_at")
      .eq("user_id", ref)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data as SubRow;
  }

  const customerIds = [
    pixAuth?.customerId,
    payment?.customer,
    subObj?.customer,
  ].filter((v): v is string => typeof v === "string" && v.length > 0);

  for (const cid of customerIds) {
    const { data } = await service
      .from("subscriptions")
      .select("id, user_id, plan, payment_method, status, provider_customer_id, provider_subscription_id, provider_payment_id, current_period_end, first_paid_at")
      .eq("provider_customer_id", cid)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data as SubRow;
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const expectedToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN") ?? "";
  const receivedToken = req.headers.get("asaas-access-token") ?? "";
  if (!tokensMatch(receivedToken, expectedToken)) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const eventType = typeof body.event === "string" ? body.event : "UNKNOWN";
  const eventId =
    typeof body.id === "string" && body.id.trim()
      ? body.id.trim()
      : `asaas_${eventType}_${Date.now()}`;

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Idempotência: grava o evento com provider_event_id único
  const { data: insertedEvent, error: insertErr } = await service
    .from("billing_events")
    .insert({
      provider: "asaas",
      provider_event_id: eventId,
      event_type: eventType,
      payload: body,
    })
    .select("id")
    .single();

  if (insertErr) {
    if (insertErr.code === "23505") {
      return json({ ok: true, duplicate: true }, 200);
    }
    console.error("Failed inserting billing_events:", insertErr);
    return json({ ok: true, logged: false }, 200);
  }

  const billingEventId = insertedEvent.id as string;

  try {
    const sub = await findSubscription(service, body);
    if (!sub) {
      await service
        .from("billing_events")
        .update({ processed_at: new Date().toISOString() })
        .eq("id", billingEventId);
      return json({ ok: true, ignored: true }, 200);
    }

    const payment = (body.payment ?? null) as Record<string, unknown> | null;
    const pixAuth = (body.pixAutomaticAuthorization ?? body.authorization ?? null) as Record<string, unknown> | null;
    const nowIso = new Date().toISOString();

    if (eventType === "PAYMENT_CONFIRMED" || eventType === "PAYMENT_RECEIVED") {
      const paidAt = parsePaymentDate(payment ?? {});
      const computedEnd = addPlanPeriod(paidAt, sub.plan);
      const existingEnd = sub.current_period_end ? new Date(sub.current_period_end) : null;
      const finalEnd =
        existingEnd && !Number.isNaN(existingEnd.getTime()) && existingEnd > computedEnd
          ? existingEnd
          : computedEnd;

      const wasActive = sub.status === "active";

      const { error: updErr } = await service
        .from("subscriptions")
        .update({
          status: "active",
          current_period_start: paidAt.toISOString(),
          current_period_end: finalEnd.toISOString(),
          first_paid_at: sub.first_paid_at ?? paidAt.toISOString(),
          cancel_at_period_end: false,
          provider_payment_id:
            typeof payment?.id === "string" ? payment.id : sub.provider_payment_id,
          provider_subscription_id:
            typeof payment?.subscription === "string"
              ? payment.subscription
              : sub.provider_subscription_id,
        })
        .eq("id", sub.id);
      if (updErr) throw updErr;

      if (!wasActive) {
        await service.from("notifications").insert({
          user_id: sub.user_id,
          type: "billing_activated",
          title: "Bem-vindo ao Gavetta+!",
          message:
            sub.plan === "yearly"
              ? "Sua assinatura anual do Gavetta+ está ativa."
              : "Sua assinatura mensal do Gavetta+ está ativa.",
          event_key: `billing_activated:${sub.id}:${eventId}`,
          context: {
            plan: sub.plan,
            method: sub.payment_method,
            subscription_id: sub.id,
          },
        });
      }

      await service.from("feature_events").insert({
        user_id: sub.user_id,
        feature: "checkout_success",
        metadata: {
          plan: sub.plan,
          method: sub.payment_method,
          subscription_id: sub.id,
          event_id: eventId,
        },
      });
    } else if (eventType === "PAYMENT_OVERDUE") {
      const { error: updErr } = await service
        .from("subscriptions")
        .update({ status: "past_due" })
        .eq("id", sub.id);
      if (updErr) throw updErr;
    } else if (eventType === "PAYMENT_REFUNDED") {
      const { error: updErr } = await service
        .from("subscriptions")
        .update({ status: "refunded", current_period_end: nowIso })
        .eq("id", sub.id);
      if (updErr) throw updErr;
    } else if (eventType === "SUBSCRIPTION_DELETED" || eventType === "SUBSCRIPTION_INACTIVATED") {
      const { error: updErr } = await service
        .from("subscriptions")
        .update({ cancel_at_period_end: true, status: "canceled" })
        .eq("id", sub.id);
      if (updErr) throw updErr;
    } else if (eventType.startsWith("PIX_AUTOMATIC_RECURRING_AUTHORIZATION_")) {
      if (
        eventType === "PIX_AUTOMATIC_RECURRING_AUTHORIZATION_REFUSED" ||
        eventType === "PIX_AUTOMATIC_RECURRING_AUTHORIZATION_CANCELLED" ||
        eventType === "PIX_AUTOMATIC_RECURRING_AUTHORIZATION_EXPIRED"
      ) {
        const patch: Record<string, unknown> = { cancel_at_period_end: true };
        if (sub.status === "pending") {
          patch.status = "canceled";
        }
        const { error: updErr } = await service
          .from("subscriptions")
          .update(patch)
          .eq("id", sub.id);
        if (updErr) throw updErr;
      } else if (
        eventType === "PIX_AUTOMATIC_RECURRING_AUTHORIZATION_ACTIVATED" &&
        typeof pixAuth?.subscriptionId === "string" &&
        !sub.provider_subscription_id
      ) {
        const { error: updErr } = await service
          .from("subscriptions")
          .update({ provider_subscription_id: pixAuth.subscriptionId })
          .eq("id", sub.id);
        if (updErr) throw updErr;
      }
    }

    await service
      .from("billing_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("id", billingEventId);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`billing-webhook processing error for ${eventId}:`, errMsg);
    await service
      .from("billing_events")
      .update({
        processed_at: new Date().toISOString(),
        error: errMsg.slice(0, 1000),
      })
      .eq("id", billingEventId);
  }

  return json({ ok: true }, 200);
});
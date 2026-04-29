import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FOUNDER_HANDLE = "joaoeduardo";

interface DebugResult {
  email: string;
  verdict: { level: "ok" | "warn" | "error"; code: string; message: string };
  authUser: null | {
    exists: true;
    id: string;
    createdAt: string | null;
    emailConfirmedAt: string | null;
    lastSignInAt: string | null;
    provider: string | null;
  };
  profile: { exists: false } | { exists: true; handle: string | null; username: string | null };
  format: { valid: boolean; domain: string | null };
  triggerSimulation: { suggestedHandle: string; available: boolean };
  recentLogs: Array<{
    timestamp: string;
    action: string | null;
    path: string | null;
    status: number | null;
    errorMsg: string | null;
  }>;
  notes: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing authorization" }, 401);
    }

    // Validate caller
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return json({ error: "Invalid token" }, 401);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Check founder handle
    const { data: callerProfile } = await admin
      .from("profiles")
      .select("handle")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (!callerProfile || callerProfile.handle !== FOUNDER_HANDLE) {
      return json({ error: "Forbidden" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const rawEmail = String(body?.email ?? "").trim().toLowerCase();
    if (!rawEmail) {
      return json({ error: "email required" }, 400);
    }

    const result: DebugResult = {
      email: rawEmail,
      verdict: { level: "ok", code: "unknown", message: "" },
      authUser: null,
      profile: { exists: false },
      format: { valid: false, domain: null },
      triggerSimulation: { suggestedHandle: "", available: false },
      recentLogs: [],
      notes: [],
    };

    // 1. Format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const formatValid = emailRegex.test(rawEmail);
    const domain = rawEmail.includes("@") ? rawEmail.split("@")[1] : null;
    result.format = { valid: formatValid, domain };

    // 2. auth.users lookup via Admin API
    let authUserRecord:
      | { id: string; created_at?: string; email_confirmed_at?: string | null; last_sign_in_at?: string | null; app_metadata?: Record<string, unknown> }
      | null = null;
    try {
      // Paginate through users (Admin API has no direct getByEmail in JS client v2)
      let page = 1;
      const perPage = 200;
      while (page <= 25) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
        if (error) {
          result.notes.push(`listUsers error: ${error.message}`);
          break;
        }
        const found = data.users.find(
          (u) => (u.email ?? "").toLowerCase() === rawEmail
        );
        if (found) {
          authUserRecord = found as typeof authUserRecord;
          break;
        }
        if (data.users.length < perPage) break;
        page++;
      }
    } catch (e) {
      result.notes.push(`auth lookup failed: ${(e as Error).message}`);
    }

    if (authUserRecord) {
      result.authUser = {
        exists: true,
        id: authUserRecord.id,
        createdAt: authUserRecord.created_at ?? null,
        emailConfirmedAt: authUserRecord.email_confirmed_at ?? null,
        lastSignInAt: authUserRecord.last_sign_in_at ?? null,
        provider:
          (authUserRecord.app_metadata as { provider?: string } | undefined)
            ?.provider ?? null,
      };

      // Profile lookup
      const { data: prof } = await admin
        .from("profiles")
        .select("handle, username")
        .eq("id", authUserRecord.id)
        .maybeSingle();
      if (prof) {
        result.profile = { exists: true, handle: prof.handle, username: prof.username };
      } else {
        result.profile = { exists: false };
      }
    }

    // 3. Trigger simulation
    const localPart = (domain ? rawEmail.split("@")[0] : rawEmail) || "user";
    const baseHandle = localPart
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 30) || "user";

    let suggested = baseHandle;
    let available = false;
    for (let i = 1; i <= 50; i++) {
      const candidate = i === 1 ? baseHandle : `${baseHandle.slice(0, 30 - String(i).length)}${i}`;
      const { data: existing } = await admin
        .from("profiles")
        .select("id")
        .eq("handle", candidate)
        .maybeSingle();
      if (!existing) {
        suggested = candidate;
        available = true;
        break;
      }
    }
    result.triggerSimulation = { suggestedHandle: suggested, available };

    // 4. Recent auth logs (best-effort; depends on analytics availability)
    // We use the Postgres analytics endpoint via a simple fetch since the JS client doesn't expose it.
    // Skipping if not reachable — won't crash.
    try {
      const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\./)?.[1];
      if (projectRef) {
        // Not available from edge function context — leave empty and add note
        result.notes.push(
          "Logs detalhados de auth: consulte os logs no painel (não acessíveis via service role)."
        );
      }
    } catch {
      // ignore
    }

    // 5. Verdict
    if (!result.format.valid) {
      result.verdict = {
        level: "error",
        code: "invalid_format",
        message: "Formato de email inválido — request nem chega ao Supabase.",
      };
    } else if (result.authUser && result.profile.exists) {
      if (result.authUser.emailConfirmedAt) {
        result.verdict = {
          level: "warn",
          code: "already_registered_confirmed",
          message: "Email já cadastrado e confirmado. O usuário deve fazer login.",
        };
      } else {
        result.verdict = {
          level: "warn",
          code: "already_registered_unconfirmed",
          message: "Email cadastrado mas não confirmado. Reenvie o email de verificação.",
        };
      }
    } else if (result.authUser && !result.profile.exists) {
      result.verdict = {
        level: "error",
        code: "orphan_record",
        message:
          "Registro órfão: existe em auth.users mas não tem profile. O trigger handle_new_user falhou. Limpe o registro para liberar o email.",
      };
    } else {
      result.verdict = {
        level: "ok",
        code: "available",
        message:
          "Email livre no banco. Se o cadastro falhou, o problema está antes do Supabase (rede, validação no client) ou na entrega do email de confirmação (caixa de spam, filtro corporativo).",
      };
    }

    return json(result, 200);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }

  function json(payload: unknown, status: number) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

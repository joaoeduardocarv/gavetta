// Edge function de carga/latência: cria N usuários (sequenciais e
// concorrentes) usando a Admin API, mede latência ponta-a-ponta
// (auth.users INSERT + trigger handle_new_user + profile INSERT) e
// retorna estatísticas. Apaga todos os usuários ao final.
//
// Acesso restrito ao founder (handle = joaoeduardo).
//
// Query params:
//   sequential = N (default 10, max 50)   — usuários criados em série
//   concurrent = N (default 10, max 50)   — usuários criados em paralelo
//
// Retorna p50/p95/p99/min/max/avg em ms para cada modo, taxa de sucesso,
// e detalhes de qualquer erro encontrado.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FOUNDER_HANDLE = "joaoeduardo";
const TEST_EMAIL_DOMAIN = "@gavetta-load-test.invalid";

interface Sample {
  ms: number;
  ok: boolean;
  userId?: string;
  error?: string;
  profileMs?: number; // tempo só do SELECT do profile (verifica trigger)
}

interface Stats {
  count: number;
  ok: number;
  failed: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  totalMs: number;
}

function pct(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function summarize(samples: Sample[], totalMs: number): Stats {
  const ok = samples.filter((s) => s.ok);
  const sorted = ok.map((s) => s.ms).sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    count: samples.length,
    ok: ok.length,
    failed: samples.length - ok.length,
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
    avg: ok.length ? +(sum / ok.length).toFixed(1) : 0,
    p50: pct(sorted, 50),
    p95: pct(sorted, 95),
    p99: pct(sorted, 99),
    totalMs,
  };
}

async function createOne(
  admin: ReturnType<typeof createClient>,
  runId: string,
  idx: number,
  prefix: string,
): Promise<Sample> {
  const email = `lt-${runId}-${prefix}${idx}${TEST_EMAIL_DOMAIN}`;
  const handle = `lt_${runId.slice(0, 6)}_${prefix}${idx}`.slice(0, 30);
  const username = `LoadTest ${prefix.toUpperCase()}${idx}`;

  const t0 = performance.now();
  try {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: "LoadTest123!",
      email_confirm: true,
      user_metadata: {
        username,
        handle,
        avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=lt",
      },
    });
    const ms = +(performance.now() - t0).toFixed(1);

    if (error || !data.user) {
      return { ms, ok: false, error: error?.message ?? "no user returned" };
    }

    // Mede tempo de leitura do profile (deve existir pela trigger)
    const tp = performance.now();
    const { data: prof } = await admin
      .from("profiles")
      .select("handle")
      .eq("id", data.user.id)
      .maybeSingle();
    const profileMs = +(performance.now() - tp).toFixed(1);

    if (!prof) {
      return {
        ms,
        ok: false,
        userId: data.user.id,
        error: "Profile não criado pela trigger",
        profileMs,
      };
    }

    return { ms, ok: true, userId: data.user.id, profileMs };
  } catch (e) {
    return {
      ms: +(performance.now() - t0).toFixed(1),
      ok: false,
      error: (e as Error).message,
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (payload: unknown, status: number) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    // Auth: founder only
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Invalid token" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: caller } = await admin
      .from("profiles")
      .select("handle")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (!caller || (caller as { handle: string }).handle !== FOUNDER_HANDLE) {
      return json({ error: "Forbidden — founder only" }, 403);
    }

    // Parse params
    const url = new URL(req.url);
    const sequentialN = Math.min(
      Math.max(parseInt(url.searchParams.get("sequential") ?? "10", 10) || 10, 0),
      50,
    );
    const concurrentN = Math.min(
      Math.max(parseInt(url.searchParams.get("concurrent") ?? "10", 10) || 10, 0),
      50,
    );

    const runId = crypto.randomUUID().slice(0, 8);
    const createdIds: string[] = [];

    // ── Sequencial ──
    const seqSamples: Sample[] = [];
    const seqStart = performance.now();
    for (let i = 0; i < sequentialN; i++) {
      const s = await createOne(admin, runId, i, "s");
      seqSamples.push(s);
      if (s.userId) createdIds.push(s.userId);
    }
    const seqTotal = +(performance.now() - seqStart).toFixed(1);

    // ── Concorrente ──
    const concStart = performance.now();
    const concSamples = await Promise.all(
      Array.from({ length: concurrentN }, (_, i) =>
        createOne(admin, runId, i, "c"),
      ),
    );
    const concTotal = +(performance.now() - concStart).toFixed(1);
    for (const s of concSamples) if (s.userId) createdIds.push(s.userId);

    // Stats de leitura do profile (mede saúde da trigger)
    const allProfileMs = [...seqSamples, ...concSamples]
      .filter((s) => s.profileMs !== undefined)
      .map((s) => s.profileMs!) as number[];
    const profileSorted = allProfileMs.sort((a, b) => a - b);
    const profileStats = {
      count: allProfileMs.length,
      avg: allProfileMs.length
        ? +(allProfileMs.reduce((a, b) => a + b, 0) / allProfileMs.length).toFixed(1)
        : 0,
      p50: pct(profileSorted, 50),
      p95: pct(profileSorted, 95),
      max: profileSorted[profileSorted.length - 1] ?? 0,
    };

    // ── Cleanup ──
    const cleanupStart = performance.now();
    let cleanupErrors = 0;
    // Apagar em paralelo, em chunks de 10 para não martelar
    for (let i = 0; i < createdIds.length; i += 10) {
      const chunk = createdIds.slice(i, i + 10);
      const results = await Promise.all(
        chunk.map((id) => admin.auth.admin.deleteUser(id)),
      );
      cleanupErrors += results.filter((r) => r.error).length;
    }
    const cleanupMs = +(performance.now() - cleanupStart).toFixed(1);

    const seqStats = summarize(seqSamples, seqTotal);
    const concStats = summarize(concSamples, concTotal);

    // Diagnóstico simples
    const warnings: string[] = [];
    if (seqStats.p95 > 2000) warnings.push(`Latência sequencial p95 alta: ${seqStats.p95}ms`);
    if (concStats.p95 > 4000) warnings.push(`Latência concorrente p95 alta: ${concStats.p95}ms`);
    if (seqStats.failed > 0) warnings.push(`${seqStats.failed} falhas no modo sequencial`);
    if (concStats.failed > 0) warnings.push(`${concStats.failed} falhas no modo concorrente`);
    if (profileStats.p95 > 200) warnings.push(`Leitura do profile p95 alta: ${profileStats.p95}ms (trigger lenta?)`);

    return json(
      {
        runId,
        params: { sequentialN, concurrentN },
        sequential: seqStats,
        concurrent: concStats,
        profileRead: profileStats,
        cleanup: {
          deleted: createdIds.length,
          errors: cleanupErrors,
          totalMs: cleanupMs,
        },
        errors: [...seqSamples, ...concSamples]
          .filter((s) => !s.ok)
          .map((s) => s.error)
          .slice(0, 10),
        warnings,
        healthy: warnings.length === 0,
      },
      200,
    );
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

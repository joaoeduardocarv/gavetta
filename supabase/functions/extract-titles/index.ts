import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import {
  buildItems,
  extractTitles,
  resolveSource,
} from "../_shared/importCore.ts";
import {
  FREE_MONTHLY_IMPORT_LIMIT,
  evaluateImportQuota,
  getCurrentMonthWindow,
  shouldEnforceGavettaPlus,
} from "../_shared/importQuota.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const adminClient = () =>
  createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

const BodySchema = z.object({
  url: z.string().trim().url().max(2000).optional(),
  text: z.string().trim().max(20000).optional(),
});

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Não autenticado" }, 401);
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return json({ error: "Não autenticado" }, 401);
    }
    const userId = userData.user.id;

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return json({ error: parsed.error.flatten().fieldErrors }, 400);
    }
    const { url, text } = parsed.data;
    if (!url && !text) {
      return json({ error: "Envie um link ou um texto." }, 400);
    }

    let sourceTitle = "";
    let sourceProvider = "texto";
    let sourceText = text ?? "";
    let audio = null as Awaited<ReturnType<typeof resolveSource>>["audio"];

    if (url) {
      const source = await resolveSource(url);
      sourceTitle = source.title;
      sourceProvider = source.provider;
      audio = source.audio;
      sourceText = [source.text, text ?? ""].filter(Boolean).join("\n").trim();
    }

    const service = adminClient();
    const { monthStartIso, resetsAtIso } = getCurrentMonthWindow();
    const [premiumRes, adminRes, usageRes] = await Promise.all([
      service.rpc("is_premium", { _user_id: userId }),
      service.rpc("has_role", { _user_id: userId, _role: "admin" }),
      service
        .from("import_usage")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", monthStartIso),
    ]);

    if (premiumRes.error) {
      console.error("is_premium rpc error", premiumRes.error);
      return json({ error: "Erro ao verificar assinatura." }, 500);
    }
    if (adminRes.error) {
      console.error("has_role rpc error", adminRes.error);
      return json({ error: "Erro ao verificar permissões." }, 500);
    }
    if (usageRes.error) {
      console.error("import_usage count error", usageRes.error);
      return json({ error: "Erro ao verificar cota mensal." }, 500);
    }

    const isPremium = Boolean(premiumRes.data);
    const isAdmin = Boolean(adminRes.data);
    const enforce = shouldEnforceGavettaPlus(isAdmin);
    const used = usageRes.count ?? 0;

    // Podcast com áudio localizado: cria um job e transcreve o episódio inteiro.
    if (audio?.audioUrl) {
      const podcastDecision = evaluateImportQuota({
        used,
        isPremium,
        enforce,
        kind: "podcast",
        resetsAtIso,
      });
      if (!podcastDecision.allowed) {
        return json(
          {
            code: podcastDecision.code,
            error: "A transcrição de podcasts é exclusiva do Gavetta+.",
          },
          402,
        );
      }

      const { error: usageInsertErr } = await service.from("import_usage").insert({
        user_id: userId,
        source_url: url ?? null,
        kind: "podcast",
      });
      if (usageInsertErr) {
        console.error("import_usage podcast insert error", usageInsertErr);
      }

      const { data: job, error: jobError } = await supabase
        .from("import_jobs")
        .insert({
          user_id: userId,
          source_url: url,
          status: "queued",
          stage: "Localizando o episódio",
          source_title: audio.episodeTitle || sourceTitle,
          source_provider: sourceProvider,
          result: { audioUrl: audio.audioUrl, isMp3: audio.isMp3, notes: sourceText },
        })
        .select("id")
        .single();

      if (!jobError && job) {
        const trigger = fetch(`${SUPABASE_URL}/functions/v1/transcribe-episode`, {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ jobId: job.id }),
        }).catch((e) => console.error("trigger transcribe error", e));
        // @ts-ignore EdgeRuntime existe no runtime do Supabase
        if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(trigger);

        return json({
          mode: "audio",
          jobId: job.id,
          needsText: false,
          sourceTitle: audio.episodeTitle || sourceTitle,
          sourceProvider,
          items: [],
        });
      }
      console.error("import_jobs insert error", jobError);
    }

    const textDecision = evaluateImportQuota({
      used,
      isPremium,
      enforce,
      kind: "text",
      resetsAtIso,
    });
    if (!textDecision.allowed && textDecision.code === "IMPORT_QUOTA") {
      return json(
        {
          code: "IMPORT_QUOTA",
          used: textDecision.used,
          limit: textDecision.limit,
          resets_at: textDecision.resets_at,
        },
        402,
      );
    }

    if (sourceText.replace(/\s/g, "").length < 12) {
      return json({
        mode: "text",
        needsText: true,
        sourceTitle,
        sourceProvider,
        items: [],
        message:
          "Não consegui ler o conteúdo desse link (pode ser privado ou sem legenda). Cole a legenda/descrição do post.",
      });
    }

    // Registra o uso antes de chamar o modelo de IA (inclui plano B de legenda colada).
    const { error: usageInsertErr } = await service.from("import_usage").insert({
      user_id: userId,
      source_url: url ?? null,
      kind: "text",
    });
    if (usageInsertErr) {
      console.error("import_usage text insert error", usageInsertErr);
      if (enforce && !isPremium) {
        return json({ error: "Não foi possível registrar o uso da cota." }, 500);
      }
    }

    const { titles: rawTitles, error } = await extractTitles(sourceText);

    if (error === "rate_limit") {
      return json({ error: "Muitas requisições. Tente de novo em instantes." }, 429);
    }
    if (error === "payment") {
      return json({ error: "Créditos de IA esgotados." }, 402);
    }
    if (error) {
      return json({ error: "Não consegui analisar esse conteúdo agora." }, 502);
    }

    const { items, unmatched } = await buildItems(rawTitles, sourceText);

    return json({
      mode: "text",
      needsText: false,
      sourceTitle,
      sourceProvider,
      items,
      unmatched,
      quota: {
        used: used + 1,
        limit: FREE_MONTHLY_IMPORT_LIMIT,
        resets_at: resetsAtIso,
      },
    });
  } catch (e) {
    console.error("extract-titles error", e);
    return json({ error: "Erro inesperado ao processar o conteúdo." }, 500);
  }
});

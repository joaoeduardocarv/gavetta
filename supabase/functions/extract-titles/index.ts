import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import {
  buildItems,
  extractTitles,
  resolveSource,
} from "../_shared/importCore.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

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

    // Podcast com áudio localizado: cria um job e transcreve o episódio inteiro.
    if (audio?.audioUrl) {
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
    });
  } catch (e) {
    console.error("extract-titles error", e);
    return json({ error: "Erro inesperado ao processar o conteúdo." }, 500);
  }
});

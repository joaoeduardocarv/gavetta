import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { buildItems, extractTitles, UA } from "../_shared/importCore.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

/** Limite de upload do gateway é 25 MiB; deixamos folga. ~37 min de MP3 a 64kbps. */
const CHUNK_BYTES = 18 * 1024 * 1024;
/** Segurança: no máximo ~6h de áudio. */
const MAX_CHUNKS = 12;
/** Quantos blocos processar por invocação, para caber no tempo da função. */
const CHUNKS_PER_RUN = 3;

const BodySchema = z.object({ jobId: z.string().uuid() });

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const admin = () =>
  createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

interface JobResult {
  audioUrl?: string;
  isMp3?: boolean;
  notes?: string;
  transcript?: string;
  partial?: boolean;
  items?: unknown[];
  unmatched?: string[];
}

async function updateJob(jobId: string, patch: Record<string, unknown>) {
  const { error } = await admin().from("import_jobs").update(patch).eq("id", jobId);
  if (error) console.error("job update error", error);
}

async function audioSize(url: string): Promise<number | null> {
  try {
    const res = await fetch(url, { method: "HEAD", headers: { "User-Agent": UA }, redirect: "follow" });
    const len = res.headers.get("content-length");
    const ranges = res.headers.get("accept-ranges");
    if (!len) return null;
    const size = Number(len);
    if (!Number.isFinite(size) || size <= 0) return null;
    if (ranges && ranges.toLowerCase() === "none") return -size; // sem suporte a Range
    return size;
  } catch {
    return null;
  }
}

async function fetchRange(url: string, start: number, end: number): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Range: `bytes=${start}-${end}` },
      redirect: "follow",
    });
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch (e) {
    console.error("range fetch error", e);
    return null;
  }
}

const MP3_BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const MP3_RATES = [44100, 48000, 32000];

/** Posição do primeiro frame MP3 (pulando ID3v2) e seus dados de cabeçalho. */
function firstFrame(bytes: Uint8Array) {
  let i = 0;
  if (bytes.length > 10 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    i = 10 + ((bytes[6] << 21) | (bytes[7] << 14) | (bytes[8] << 7) | bytes[9]);
  }
  while (i < bytes.length - 4 && !(bytes[i] === 0xff && (bytes[i + 1] & 0xe0) === 0xe0)) i++;
  if (i >= bytes.length - 4) return null;
  const h = bytes.subarray(i, i + 4);
  const bitrate = MP3_BITRATES[(h[2] >> 4) & 0xf] * 1000;
  const sampleRate = MP3_RATES[(h[2] >> 2) & 3];
  const padding = (h[2] >> 1) & 1;
  if (!bitrate || !sampleRate) return null;
  const frameLength = Math.floor((144 * bitrate) / sampleRate) + padding;
  return { offset: i, frameLength, bitrate };
}

/**
 * Prepara um bloco de MP3 para o modelo: remove ID3 e o header Xing/Info do
 * arquivo original (ele declara a duração TOTAL do episódio, o que faz o
 * provedor rejeitar o bloco como "corrompido") e alinha o início em um frame.
 */
function prepareMp3Chunk(bytes: Uint8Array): Uint8Array {
  const f = firstFrame(bytes);
  if (!f) return bytes;
  const head = bytes.subarray(f.offset, f.offset + f.frameLength);
  const text = new TextDecoder("latin1").decode(head);
  const hasXing = text.includes("Xing") || text.includes("Info");
  return bytes.subarray(f.offset + (hasXing ? f.frameLength : 0));
}

/** Transcreve um bloco de áudio no gateway de IA (SSE, acumulando os deltas). */
async function transcribeChunk(bytes: Uint8Array, ext: string): Promise<string> {
  if (!LOVABLE_API_KEY) throw new Error("ai_unavailable");

  const form = new FormData();
  form.append("model", "openai/gpt-4o-mini-transcribe");
  const mime = ext === "mp3" ? "audio/mpeg" : "audio/mp4";
  form.append("file", new Blob([bytes], { type: mime }), `chunk.${ext}`);
  form.append("stream", "true");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}` },
    body: form,
  });

  if (res.status === 429) throw new Error("rate_limit");
  if (res.status === 402) throw new Error("payment");
  if (!res.ok) {
    console.error("transcription error", res.status, await res.text().catch(() => ""));
    throw new Error("transcription_failed");
  }

  const reader = res.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const evt = JSON.parse(payload);
        if (evt.type === "transcript.text.delta" && typeof evt.delta === "string") {
          text += evt.delta;
        } else if (evt.type === "transcript.text.done" && typeof evt.text === "string") {
          if (!text) text = evt.text;
        }
      } catch {
        // ignora linhas parciais
      }
    }
  }

  return text.trim();
}

async function process(jobId: string) {
  const db = admin();
  const { data: job } = await db
    .from("import_jobs")
    .select("id, status, progress, total, result, source_title")
    .eq("id", jobId)
    .maybeSingle();

  if (!job) return;
  const result = (job.result ?? {}) as JobResult;
  const audioUrl = result.audioUrl;
  if (!audioUrl) {
    await updateJob(jobId, { status: "error", error: "Áudio do episódio não encontrado." });
    return;
  }
  if (job.status === "done" || job.status === "error") return;

  try {
    // Cache: mesmo episódio já transcrito antes não gasta créditos de novo.
    let transcript = result.transcript ?? "";
    let partial = result.partial ?? false;
    let doneChunks = job.progress ?? 0;

    if (!transcript) {
      const { data: cached } = await db
        .from("episode_transcripts")
        .select("transcript, partial")
        .eq("audio_url", audioUrl)
        .maybeSingle();
      if (cached?.transcript) {
        transcript = cached.transcript;
        partial = cached.partial;
        doneChunks = -1; // já completo
      }
    }

    if (doneChunks >= 0) {
      const rawSize = await audioSize(audioUrl);
      const supportsRange = rawSize === null ? false : rawSize > 0;
      const size = rawSize === null ? null : Math.abs(rawSize);
      const ext = result.isMp3 ? "mp3" : "m4a";

      // O modelo também limita a DURAÇÃO do áudio (~25 min), então o tamanho do
      // bloco respeita o bitrate real do arquivo, não só o limite de upload.
      let chunkBytes = CHUNK_BYTES;
      if (result.isMp3 && supportsRange) {
        const head = await fetchRange(audioUrl, 0, 64 * 1024);
        const f = head ? firstFrame(head) : null;
        if (f) chunkBytes = Math.min(CHUNK_BYTES, Math.floor((f.bitrate / 8) * 1150));
      }

      const totalChunks =
        size === null || !supportsRange || !result.isMp3
          ? 1
          : Math.min(Math.ceil(size / chunkBytes), MAX_CHUNKS);

      await updateJob(jobId, {
        status: "listening",
        stage: "Ouvindo o episódio",
        total: totalChunks,
      });

      const limit = Math.min(totalChunks, doneChunks + CHUNKS_PER_RUN);

      for (let i = doneChunks; i < limit; i++) {
        const start = i * chunkBytes;
        const end = Math.min(start + chunkBytes - 1, (size ?? chunkBytes) - 1);
        const raw = await fetchRange(audioUrl, start, end);
        if (!raw || raw.length === 0) {
          partial = true;
          break;
        }
        const bytes = ext === "mp3" ? prepareMp3Chunk(raw) : raw;
        const piece = await transcribeChunk(bytes, ext);
        transcript = transcript ? `${transcript}\n${piece}` : piece;
        doneChunks = i + 1;
        await updateJob(jobId, {
          progress: doneChunks,
          total: totalChunks,
          result: { ...result, transcript, partial },
        });
      }


      if (totalChunks > 1 && !result.isMp3) partial = true;
      if (size !== null && (!supportsRange || !result.isMp3) && size > CHUNK_BYTES) {
        partial = true;
      }

      // Ainda faltam blocos: encerra esta invocação e deixa o cliente retomar.
      if (doneChunks < totalChunks) {
        await updateJob(jobId, {
          status: "listening",
          stage: "Ouvindo o episódio",
          progress: doneChunks,
          total: totalChunks,
          result: { ...result, transcript, partial },
        });
        return;
      }

      if (transcript) {
        await db
          .from("episode_transcripts")
          .upsert(
            {
              audio_url: audioUrl,
              source_title: job.source_title,
              transcript,
              partial,
            },
            { onConflict: "audio_url" },
          );
      }
    }

    if (!transcript || transcript.replace(/\s/g, "").length < 40) {
      await updateJob(jobId, {
        status: "error",
        error: "Não consegui ouvir o áudio desse episódio.",
      });
      return;
    }

    await updateJob(jobId, {
      status: "extracting",
      stage: "Procurando os títulos citados",
      result: { ...result, transcript, partial },
    });

    const fullText = [result.notes ?? "", transcript].filter(Boolean).join("\n");
    const { titles, error } = await extractTitles(fullText);
    if (error === "payment") {
      await updateJob(jobId, { status: "error", error: "Créditos de IA esgotados." });
      return;
    }
    if (error === "rate_limit") {
      await updateJob(jobId, {
        status: "error",
        error: "Muitas requisições de IA agora. Tente de novo em instantes.",
      });
      return;
    }

    const { items, unmatched } = await buildItems(titles, fullText);

    await updateJob(jobId, {
      status: "done",
      stage: "Concluído",
      error: null,
      result: { ...result, transcript, partial, items, unmatched },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "erro";
    console.error("transcribe-episode error", message);
    await updateJob(jobId, {
      status: "error",
      error:
        message === "payment"
          ? "Créditos de IA esgotados."
          : message === "rate_limit"
          ? "Muitas requisições de IA agora. Tente de novo em instantes."
          : "Não consegui processar o áudio desse episódio.",
    });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) return json({ error: "Não autenticado" }, 401);

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { jobId } = parsed.data;

    // RLS garante que o usuário só enxergue os próprios jobs.
    const { data: job } = await userClient
      .from("import_jobs")
      .select("id, status")
      .eq("id", jobId)
      .maybeSingle();
    if (!job) return json({ error: "Job não encontrado" }, 404);
    if (job.status === "done") return json({ ok: true, status: "done" });

    const task = process(jobId);
    // @ts-ignore EdgeRuntime existe no runtime do Supabase
    if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(task);
    else await task;

    return json({ ok: true, status: "processing" }, 202);
  } catch (e) {
    console.error("transcribe-episode handler error", e);
    return json({ error: "Erro inesperado" }, 500);
  }
});

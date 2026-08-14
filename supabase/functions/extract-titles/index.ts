import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const TMDB_TOKEN = Deno.env.get("TMDB_TOKEN");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_HEADERS = {
  Authorization: `Bearer ${TMDB_TOKEN}`,
  Accept: "application/json",
};

const BodySchema = z.object({
  url: z.string().trim().url().max(2000).optional(),
  text: z.string().trim().max(20000).optional(),
});

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ---------------- source text resolution ----------------

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36";

function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\\n/g, "\n");
}

function metaFromHtml(html: string, keys: string[]): string | null {
  for (const key of keys) {
    const patterns = [
      new RegExp(
        `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`,
        "i",
      ),
      new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`,
        "i",
      ),
    ];
    for (const p of patterns) {
      const m = html.match(p);
      if (m?.[1]) return decodeEntities(m[1]);
    }
  }
  return null;
}

async function fetchText(url: string, timeoutMs = 12000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8" },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.text();
  } catch (_e) {
    return null;
  }
}

async function oembed(endpoint: string): Promise<Record<string, unknown> | null> {
  const raw = await fetchText(endpoint);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

interface SourceInfo {
  title: string;
  text: string;
  provider: string;
}

async function resolveSource(rawUrl: string): Promise<SourceInfo> {
  let host = "";
  try {
    host = new URL(rawUrl).hostname.replace(/^www\./, "");
  } catch {
    host = "";
  }

  const parts: string[] = [];
  let title = "";
  let provider = host || "web";

  const pushOembed = async (endpoint: string) => {
    const data = await oembed(endpoint);
    if (!data) return;
    const t = typeof data.title === "string" ? data.title : "";
    const author = typeof data.author_name === "string" ? data.author_name : "";
    const desc = typeof data.description === "string" ? data.description : "";
    if (t) {
      title ||= t;
      parts.push(t);
    }
    if (author) parts.push(`Autor: ${author}`);
    if (desc) parts.push(desc);
  };

  if (host.includes("youtube.com") || host.includes("youtu.be")) {
    provider = "YouTube";
    await pushOembed(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(rawUrl)}`,
    );
  } else if (host.includes("tiktok.com")) {
    provider = "TikTok";
    await pushOembed(`https://www.tiktok.com/oembed?url=${encodeURIComponent(rawUrl)}`);
  } else if (host.includes("spotify.com")) {
    provider = "Spotify";
    await pushOembed(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(rawUrl)}`,
    );
  } else if (host.includes("instagram.com")) {
    provider = "Instagram";
  }

  // Sempre tenta ler a página para pegar descrição/legenda mais completa
  const html = await fetchText(rawUrl);
  if (html) {
    const ogTitle = metaFromHtml(html, ["og:title", "twitter:title", "title"]);
    const ogDesc = metaFromHtml(html, [
      "og:description",
      "twitter:description",
      "description",
    ]);
    if (ogTitle) {
      title ||= ogTitle;
      parts.push(ogTitle);
    }
    if (ogDesc) parts.push(ogDesc);

    // YouTube: descrição completa fica no JSON embutido
    const short = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/);
    if (short?.[1]) parts.push(decodeEntities(short[1]));

    // Spotify: descrição do episódio embutida
    const audioDesc = html.match(/"htmlDescription":"((?:[^"\\]|\\.)*)"/);
    if (audioDesc?.[1]) {
      parts.push(decodeEntities(audioDesc[1]).replace(/<[^>]+>/g, " "));
    }
  }

  const seen = new Set<string>();
  const text = parts
    .map((p) => p.trim())
    .filter((p) => {
      if (!p || seen.has(p)) return false;
      seen.add(p);
      return true;
    })
    .join("\n")
    .slice(0, 12000);

  return { title, text, provider };
}

// ---------------- AI extraction ----------------

interface ExtractedTitle {
  title: string;
  year?: number;
  type?: "movie" | "tv";
}

const SYSTEM_PROMPT = `Você extrai nomes de filmes e séries citados em textos de redes sociais (legendas de Reels/TikTok, descrição de vídeos do YouTube, descrição de episódios de podcast).

Regras:
- Retorne SOMENTE títulos de filmes ou séries realmente citados no texto.
- Nunca invente títulos que não aparecem no texto.
- Mantenha o título como foi citado (pt-BR ou original), sem numeração, emojis ou pontuação extra.
- Ignore nomes de pessoas, canais, streamings, gêneros e podcasts.
- Se o texto indicar o ano, inclua. Se indicar claramente que é série, use type "tv"; filme, "movie".
- Se nenhum título for citado, retorne uma lista vazia.`;

async function extractTitles(sourceText: string): Promise<{
  titles: ExtractedTitle[];
  error?: "rate_limit" | "payment" | "ai_error";
}> {
  if (!LOVABLE_API_KEY) return { titles: [], error: "ai_error" };

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3.6-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: sourceText },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "registrar_titulos",
            description: "Registra os filmes e séries citados no texto.",
            parameters: {
              type: "object",
              properties: {
                titulos: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      year: { type: "number" },
                      type: { type: "string", enum: ["movie", "tv"] },
                    },
                    required: ["title"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["titulos"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "registrar_titulos" } },
    }),
  });

  if (res.status === 429) return { titles: [], error: "rate_limit" };
  if (res.status === 402) return { titles: [], error: "payment" };
  if (!res.ok) {
    console.error("AI gateway error", res.status, await res.text());
    return { titles: [], error: "ai_error" };
  }

  const data = await res.json();
  const args =
    data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments ?? "{}";
  try {
    const parsed = JSON.parse(args);
    const list = Array.isArray(parsed?.titulos) ? parsed.titulos : [];
    const out: ExtractedTitle[] = [];
    const seen = new Set<string>();
    for (const item of list) {
      const title = typeof item?.title === "string" ? item.title.trim() : "";
      if (!title) continue;
      const key = title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        title,
        year: typeof item?.year === "number" ? item.year : undefined,
        type: item?.type === "movie" || item?.type === "tv" ? item.type : undefined,
      });
      if (out.length >= 25) break;
    }
    return { titles: out };
  } catch (e) {
    console.error("AI parse error", e);
    return { titles: [], error: "ai_error" };
  }
}

// ---------------- TMDB matching ----------------

interface TmdbMatch {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  originalTitle?: string;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string;
  overview: string;
  voteAverage: number;
  genreIds: number[];
  popularity: number;
}

interface TmdbRaw {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  overview?: string;
  vote_average?: number;
  genre_ids?: number[];
  popularity?: number;
}

function toMatch(r: TmdbRaw): TmdbMatch | null {
  const mediaType = r.media_type === "movie" || r.media_type === "tv" ? r.media_type : null;
  if (!mediaType) return null;
  return {
    tmdbId: r.id,
    mediaType,
    title: r.title || r.name || "",
    originalTitle: r.original_title || r.original_name,
    posterPath: r.poster_path ?? null,
    backdropPath: r.backdrop_path ?? null,
    releaseDate: r.release_date || r.first_air_date || "",
    overview: r.overview || "",
    voteAverage: r.vote_average ?? 0,
    genreIds: r.genre_ids ?? [],
    popularity: r.popularity ?? 0,
  };
}

async function searchTmdb(item: ExtractedTitle): Promise<TmdbMatch[]> {
  const url = `${TMDB_BASE}/search/multi?query=${encodeURIComponent(item.title)}&language=pt-BR&include_adult=false&page=1`;
  const res = await fetch(url, { headers: TMDB_HEADERS });
  if (!res.ok) return [];
  const data = await res.json();
  const results: TmdbMatch[] = (data?.results ?? [])
    .map((r: TmdbRaw) => toMatch(r))
    .filter((m: TmdbMatch | null): m is TmdbMatch => m !== null && !!m.title);

  const scored = results.map((m) => {
    let score = Math.min(m.popularity, 500) / 500;
    if (item.type && m.mediaType === item.type) score += 1.5;
    if (item.year && m.releaseDate.slice(0, 4) === String(item.year)) score += 2;
    if (m.title.toLowerCase() === item.title.toLowerCase()) score += 1;
    if ((m.originalTitle ?? "").toLowerCase() === item.title.toLowerCase()) score += 1;
    if (m.posterPath) score += 0.3;
    return { m, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 5).map((s) => s.m);
}

// ---------------- handler ----------------

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

    if (url) {
      const source = await resolveSource(url);
      sourceTitle = source.title;
      sourceProvider = source.provider;
      sourceText = [source.text, text ?? ""].filter(Boolean).join("\n").trim();
    }

    if (sourceText.replace(/\s/g, "").length < 12) {
      return json({
        needsText: true,
        sourceTitle,
        sourceProvider,
        items: [],
        message:
          "Não consegui ler o conteúdo desse link (pode ser privado ou sem legenda). Cole a legenda/descrição do post.",
      });
    }

    const { titles, error } = await extractTitles(sourceText);

    if (error === "rate_limit") {
      return json({ error: "Muitas requisições. Tente de novo em instantes." }, 429);
    }
    if (error === "payment") {
      return json({ error: "Créditos de IA esgotados." }, 402);
    }
    if (error) {
      return json({ error: "Não consegui analisar esse conteúdo agora." }, 502);
    }

    const items = await Promise.all(
      titles.map(async (t) => {
        const matches = await searchTmdb(t);
        return {
          query: t.title,
          year: t.year,
          type: t.type,
          match: matches[0] ?? null,
          alternatives: matches.slice(1),
        };
      }),
    );

    return json({
      needsText: false,
      sourceTitle,
      sourceProvider,
      items: items.filter((i) => i.match !== null),
      unmatched: items.filter((i) => i.match === null).map((i) => i.query),
    });
  } catch (e) {
    console.error("extract-titles error", e);
    return json({ error: "Erro inesperado ao processar o conteúdo." }, 500);
  }
});

// Núcleo compartilhado da importação de títulos a partir de links
// (Reels/TikTok/YouTube/podcasts) — usado por `extract-titles` e `transcribe-episode`.

const TMDB_TOKEN = Deno.env.get("TMDB_TOKEN");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_HEADERS = {
  Authorization: `Bearer ${TMDB_TOKEN}`,
  Accept: "application/json",
};

export const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36";

export function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\\n/g, "\n")
    .replace(/\\u0026/g, "&")
    .replace(/\\\//g, "/");
}

export function metaFromHtml(html: string, keys: string[]): string | null {
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

export async function fetchText(
  url: string,
  timeoutMs = 12000,
): Promise<string | null> {
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

export function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

// ---------------- YouTube: legendas ----------------

/** Baixa a transcrição das legendas (inclusive automáticas) de um vídeo do YouTube. */
export async function youtubeTranscript(html: string): Promise<string | null> {
  const tracks = [...html.matchAll(/"baseUrl":"(https:\/\/www\.youtube\.com\/api\/timedtext[^"]+)"/g)]
    .map((m) => decodeEntities(m[1]));
  if (tracks.length === 0) return null;

  // Prefere português, depois inglês, depois qualquer uma.
  const pick =
    tracks.find((t) => /[?&]lang=pt/.test(t)) ??
    tracks.find((t) => /[?&]lang=en/.test(t)) ??
    tracks[0];

  const xml = await fetchText(pick, 15000);
  if (!xml) return null;
  const lines = [...xml.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)].map((m) =>
    stripTags(m[1]),
  );
  const text = lines.filter(Boolean).join(" ").trim();
  return text.length > 40 ? text : null;
}

// ---------------- Podcast: descoberta do áudio ----------------

export interface PodcastAudio {
  audioUrl: string;
  episodeTitle: string;
  notes: string;
  isMp3: boolean;
}

function looksLikeAudio(url: string): boolean {
  return /\.(mp3|m4a|aac|mp4|wav|ogg)(\?|$)/i.test(url);
}

function rssItems(xml: string): { title: string; desc: string; audio: string }[] {
  return xml
    .split(/<item[\s>]/i)
    .slice(1)
    .map((chunk) => {
      const title = chunk.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "";
      const desc =
        chunk.match(/<description>([\s\S]*?)<\/description>/i)?.[1] ??
        chunk.match(/<itunes:summary>([\s\S]*?)<\/itunes:summary>/i)?.[1] ??
        "";
      const audio = chunk.match(/<enclosure[^>]*url=["']([^"']+)["']/i)?.[1] ?? "";
      return {
        title: stripTags(title.replace(/<!\[CDATA\[|\]\]>/g, "")),
        desc: stripTags(desc.replace(/<!\[CDATA\[|\]\]>/g, "")),
        audio: decodeEntities(audio),
      };
    })
    .filter((i) => i.audio);
}

function bestEpisode(
  items: { title: string; desc: string; audio: string }[],
  episodeTitle: string,
) {
  const target = normalizeForMatch(episodeTitle);
  if (!target) return null;
  let best: { item: (typeof items)[number]; score: number } | null = null;
  for (const item of items) {
    const t = normalizeForMatch(item.title);
    if (!t) continue;
    let score = 0;
    if (t === target) score = 100;
    else if (t.includes(target) || target.includes(t)) score = 60;
    else {
      const words = new Set(target.split(" ").filter((w) => w.length > 3));
      const hits = [...words].filter((w) => t.includes(w)).length;
      score = words.size ? (hits / words.size) * 50 : 0;
    }
    if (!best || score > best.score) best = { item, score };
  }
  return best && best.score >= 40 ? best.item : null;
}

/** Tenta descobrir o MP3 do episódio a partir do link do player (Spotify/Apple/Deezer/RSS). */
export async function resolvePodcastAudio(
  rawUrl: string,
  pageTitle: string,
  pageAuthor: string,
): Promise<PodcastAudio | null> {
  // 1. Link já é o áudio
  if (looksLikeAudio(rawUrl)) {
    return {
      audioUrl: rawUrl,
      episodeTitle: pageTitle || "Episódio",
      notes: "",
      isMp3: /\.mp3(\?|$)/i.test(rawUrl),
    };
  }

  // 2. Link é um feed RSS
  const maybeXml = /\.(xml|rss)(\?|$)/i.test(rawUrl) || /\/rss/i.test(rawUrl)
    ? await fetchText(rawUrl, 20000)
    : null;
  if (maybeXml && maybeXml.includes("<item")) {
    const items = rssItems(maybeXml);
    const chosen = bestEpisode(items, pageTitle) ?? items[0];
    if (chosen) {
      return {
        audioUrl: chosen.audio,
        episodeTitle: chosen.title,
        notes: chosen.desc,
        isMp3: /\.mp3(\?|$)/i.test(chosen.audio),
      };
    }
  }

  // 3. Busca o programa no diretório público da Apple para achar o feed RSS
  const showGuess = (pageAuthor || pageTitle).slice(0, 80);
  const candidates = [showGuess, pageTitle.split(/[-–|:]/)[0]?.trim() ?? ""]
    .map((s) => s.trim())
    .filter((s) => s.length >= 3);

  for (const term of candidates) {
    const raw = await fetchText(
      `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=podcast&limit=3`,
      12000,
    );
    if (!raw) continue;
    let feeds: string[] = [];
    try {
      const data = JSON.parse(raw);
      feeds = (data?.results ?? [])
        .map((r: { feedUrl?: string }) => r.feedUrl)
        .filter((f: string | undefined): f is string => !!f);
    } catch {
      continue;
    }
    for (const feed of feeds) {
      const xml = await fetchText(feed, 25000);
      if (!xml) continue;
      const items = rssItems(xml);
      const chosen = bestEpisode(items, pageTitle);
      if (chosen) {
        return {
          audioUrl: chosen.audio,
          episodeTitle: chosen.title,
          notes: chosen.desc,
          isMp3: /\.mp3(\?|$)/i.test(chosen.audio),
        };
      }
    }
  }

  return null;
}

// ---------------- Resolução da fonte ----------------

export interface SourceInfo {
  title: string;
  text: string;
  provider: string;
  /** Áudio do episódio, quando o link é um podcast e o MP3 pôde ser localizado. */
  audio: PodcastAudio | null;
  /** true quando o texto veio de transcrição/legenda (fala real, não só descrição). */
  fromTranscript: boolean;
}

export async function resolveSource(rawUrl: string): Promise<SourceInfo> {
  let host = "";
  try {
    host = new URL(rawUrl).hostname.replace(/^www\./, "");
  } catch {
    host = "";
  }

  const parts: string[] = [];
  let title = "";
  let author = "";
  let provider = host || "web";
  let audio: PodcastAudio | null = null;
  let fromTranscript = false;

  const pushOembed = async (endpoint: string) => {
    const data = await oembed(endpoint);
    if (!data) return;
    const t = typeof data.title === "string" ? data.title : "";
    const a = typeof data.author_name === "string" ? data.author_name : "";
    const desc = typeof data.description === "string" ? data.description : "";
    if (t) {
      title ||= t;
      parts.push(t);
    }
    if (a) {
      author ||= a;
      parts.push(`Autor: ${a}`);
    }
    if (desc) parts.push(desc);
  };

  const isYouTube = host.includes("youtube.com") || host.includes("youtu.be");
  const isPodcast =
    host.includes("spotify.com") ||
    host.includes("apple.com") ||
    host.includes("deezer.com") ||
    host.includes("castbox") ||
    host.includes("pocketcasts") ||
    host.includes("anchor.fm") ||
    looksLikeAudio(rawUrl) ||
    /\.(xml|rss)(\?|$)/i.test(rawUrl);

  if (isYouTube) {
    provider = "YouTube";
    await pushOembed(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(rawUrl)}`,
    );
  } else if (host.includes("tiktok.com")) {
    provider = "TikTok";
    await pushOembed(`https://www.tiktok.com/oembed?url=${encodeURIComponent(rawUrl)}`);
  } else if (host.includes("spotify.com")) {
    provider = "Spotify";
    await pushOembed(`https://open.spotify.com/oembed?url=${encodeURIComponent(rawUrl)}`);
  } else if (host.includes("instagram.com")) {
    provider = "Instagram";
  } else if (host.includes("apple.com")) {
    provider = "Apple Podcasts";
  }

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

    const short = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/);
    if (short?.[1]) parts.push(decodeEntities(short[1]));

    const audioDesc = html.match(/"htmlDescription":"((?:[^"\\]|\\.)*)"/);
    if (audioDesc?.[1]) parts.push(stripTags(decodeEntities(audioDesc[1])));

    if (isYouTube) {
      const transcript = await youtubeTranscript(html);
      if (transcript) {
        parts.push(transcript);
        fromTranscript = true;
      }
    }
  }

  if (isPodcast) {
    audio = await resolvePodcastAudio(rawUrl, title, author).catch(() => null);
    if (audio?.notes) parts.push(audio.notes);
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
    .slice(0, 200000);

  return { title, text, provider, audio, fromTranscript };
}

// ---------------- Extração por IA ----------------

export interface ExtractedTitle {
  title: string;
  year?: number;
  type?: "movie" | "tv";
}

export type ExtractError = "rate_limit" | "payment" | "ai_error";

const SYSTEM_PROMPT = `Você extrai nomes de filmes e séries citados em textos de redes sociais e em transcrições de podcasts/vídeos.

Regras:
- Retorne SOMENTE títulos de filmes ou séries realmente citados no texto.
- Nunca invente títulos que não aparecem no texto.
- Mantenha o título como foi citado (pt-BR ou original), sem numeração, emojis ou pontuação extra.
- Ignore nomes de pessoas, canais, streamings, gêneros e podcasts.
- Em transcrições, ignore falas de patrocínio e nomes de produtos.
- Se o texto indicar o ano, inclua. Se indicar claramente que é série, use type "tv"; filme, "movie".
- Se nenhum título for citado, retorne uma lista vazia.`;

async function extractWindow(sourceText: string): Promise<{
  titles: ExtractedTitle[];
  error?: ExtractError;
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
    for (const item of list) {
      const title = typeof item?.title === "string" ? item.title.trim() : "";
      if (!title) continue;
      out.push({
        title,
        year: typeof item?.year === "number" ? item.year : undefined,
        type: item?.type === "movie" || item?.type === "tv" ? item.type : undefined,
      });
    }
    return { titles: out };
  } catch (e) {
    console.error("AI parse error", e);
    return { titles: [], error: "ai_error" };
  }
}

const WINDOW = 14000;
const OVERLAP = 800;

/** Extrai títulos de textos longos (transcrições) em janelas com sobreposição. */
export async function extractTitles(sourceText: string): Promise<{
  titles: ExtractedTitle[];
  error?: ExtractError;
}> {
  const windows: string[] = [];
  for (let start = 0; start < sourceText.length; start += WINDOW - OVERLAP) {
    windows.push(sourceText.slice(start, start + WINDOW));
    if (windows.length >= 20) break;
  }
  if (windows.length === 0) return { titles: [] };

  const merged: ExtractedTitle[] = [];
  const seen = new Set<string>();
  let lastError: ExtractError | undefined;

  for (const win of windows) {
    const { titles, error } = await extractWindow(win);
    if (error) {
      lastError = error;
      if (error !== "ai_error") break;
      continue;
    }
    for (const t of titles) {
      const key = normalizeForMatch(t.title);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(t);
      if (merged.length >= 40) break;
    }
    if (merged.length >= 40) break;
  }

  if (merged.length === 0 && lastError) return { titles: [], error: lastError };
  return { titles: merged };
}

// ---------------- TMDB ----------------

export interface TmdbMatch {
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

export async function searchTmdb(item: ExtractedTitle): Promise<TmdbMatch[]> {
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

export interface ResultItem {
  query: string;
  year?: number;
  type?: "movie" | "tv";
  context?: string;
  match: TmdbMatch | null;
  alternatives: TmdbMatch[];
}

/** Trecho do texto onde o título foi citado (para mostrar no card). */
export function contextFor(sourceText: string, title: string): string | undefined {
  const hay = normalizeForMatch(sourceText);
  const needle = normalizeForMatch(title);
  const at = hay.indexOf(needle);
  if (at < 0) return undefined;
  const ratio = sourceText.length / Math.max(hay.length, 1);
  const approx = Math.floor(at * ratio);
  const start = Math.max(0, approx - 110);
  const snippet = sourceText.slice(start, approx + needle.length * ratio + 130).trim();
  return snippet ? `…${snippet.replace(/\s+/g, " ")}…` : undefined;
}

/** Aplica a trava anti-alucinação, casa com o TMDB e monta os itens do resultado. */
export async function buildItems(
  rawTitles: ExtractedTitle[],
  sourceText: string,
): Promise<{ items: ResultItem[]; unmatched: string[] }> {
  const haystack = normalizeForMatch(sourceText);
  const titles = rawTitles.filter((t) => haystack.includes(normalizeForMatch(t.title)));

  const all: ResultItem[] = [];
  for (const t of titles) {
    const matches = await searchTmdb(t);
    all.push({
      query: t.title,
      year: t.year,
      type: t.type,
      context: contextFor(sourceText, t.title),
      match: matches[0] ?? null,
      alternatives: matches.slice(1),
    });
  }

  return {
    items: all.filter((i) => i.match !== null),
    unmatched: all.filter((i) => i.match === null).map((i) => i.query),
  };
}

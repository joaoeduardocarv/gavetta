import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useSearchParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ContentCard } from "@/components/ContentCard";
import { ImportQueueDialog } from "@/components/ImportQueueDialog";
import { Link2, Sparkles, ListChecks, AlertCircle, Headphones } from "lucide-react";
import { toast } from "sonner";
import {
  ExtractedItem,
  ImportJob,
  extractTitlesFromSource,
  fetchImportJob,
  fetchRunningImportJob,
  firstUrlFrom,
  matchToContent,
  resumeImportJob,
} from "@/lib/importFromLink";

const STALL_MS = 60_000;

export default function ImportPage() {
  const [params] = useSearchParams();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ExtractedItem[] | null>(null);
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [needsText, setNeedsText] = useState(false);
  const [sourceTitle, setSourceTitle] = useState("");
  const [queueOpen, setQueueOpen] = useState(false);
  const [queueStart, setQueueStart] = useState(0);
  const [job, setJob] = useState<ImportJob | null>(null);
  const jobIdRef = useRef<string | null>(null);

  const contents = useMemo(
    () => (items ?? []).map((i) => matchToContent(i.match)),
    [items],
  );
  const contexts = useMemo(() => (items ?? []).map((i) => i.context), [items]);

  const applyJob = useCallback((current: ImportJob) => {
    setJob(current);
    if (current.status === "done") {
      jobIdRef.current = null;
      setLoading(false);
      const found = current.result?.items ?? [];
      setItems(found);
      setUnmatched(current.result?.unmatched ?? []);
      setSourceTitle(current.source_title ?? "");
      if (found.length === 0) {
        toast.info("Ouvi o episódio, mas não identifiquei filmes ou séries citados.");
      } else if (current.result?.partial) {
        toast.info("Só consegui ouvir parte do episódio — pode faltar algum título.");
      }
    } else if (current.status === "error") {
      jobIdRef.current = null;
      setLoading(false);
      toast.error(current.error ?? "Não consegui processar esse episódio.");
    }
  }, []);

  // Acompanha o job de áudio em andamento (e retoma se ele travar).
  useEffect(() => {
    if (!job || job.status === "done" || job.status === "error") return;
    const id = job.id;
    let cancelled = false;

    const tick = async () => {
      try {
        const current = await fetchImportJob(id);
        if (cancelled || !current) return;
        applyJob(current);
        const stalled =
          Date.now() - new Date(current.updated_at).getTime() > STALL_MS &&
          current.status !== "done" &&
          current.status !== "error";
        if (stalled) void resumeImportJob(id);
      } catch {
        /* silencioso: o polling tenta de novo */
      }
    };

    const interval = setInterval(tick, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [job, applyJob]);

  const run = useCallback(
    async (raw: string) => {
      const value = raw.trim();
      if (!value) return;
      setLoading(true);
      setItems(null);
      setUnmatched([]);
      setNeedsText(false);
      setJob(null);
      try {
        const url = firstUrlFrom(value);
        const isOnlyUrl = url && value.replace(url, "").trim().length < 8;
        const res = await extractTitlesFromSource(
          isOnlyUrl ? { url } : { url: url ?? undefined, text: value },
        );
        setSourceTitle(res.sourceTitle || "");

        if (res.mode === "audio" && res.jobId) {
          jobIdRef.current = res.jobId;
          const current = await fetchImportJob(res.jobId);
          if (current) applyJob(current);
          toast.info("Episódio encontrado! A IA vai ouvir o áudio — isso leva alguns minutos.");
          return;
        }

        setNeedsText(res.needsText);
        setUnmatched(res.unmatched ?? []);
        setItems(res.items);
        if (res.needsText) {
          toast.info(res.message ?? "Cole a legenda ou descrição do conteúdo.");
        } else if (res.items.length === 0) {
          toast.info("Não encontrei filmes ou séries citados nesse conteúdo.");
        }
        setLoading(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao processar.");
        setLoading(false);
      }
    },
    [applyJob],
  );

  // Web Share Target (Android): /import?url=...&text=...&title=...
  useEffect(() => {
    const shared = [params.get("url"), params.get("text"), params.get("title")]
      .filter(Boolean)
      .join("\n")
      .trim();
    if (shared) {
      setInput(shared);
      void run(shared);
      return;
    }
    // Retoma um episódio que ficou processando em segundo plano
    void (async () => {
      const running = await fetchRunningImportJob().catch(() => null);
      if (running) {
        setLoading(true);
        applyJob(running);
        void resumeImportJob(running.id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openQueue = (start = 0) => {
    setQueueStart(start);
    setQueueOpen(true);
  };

  const listening = job && (job.status === "queued" || job.status === "listening" || job.status === "extracting");
  const progressPct =
    job && job.total && job.total > 0
      ? Math.min(100, Math.round((job.progress / job.total) * 100))
      : 5;

  return (
    <div className="min-h-screen bg-background pb-20">
      <Helmet>
        <title>Importar filmes e séries de um link · Gavetta</title>
        <meta
          name="description"
          content="Cole o link de um Reels, TikTok, vídeo do YouTube ou episódio de podcast: a IA ouve o conteúdo e adiciona todos os filmes e séries citados nas suas gavettas."
        />
        <link rel="canonical" href="https://gavetta.com.br/import" />
      </Helmet>
      <Header />

      <main className="container mx-auto max-w-lg px-4 py-6">
        <h1 className="mb-2 font-heading text-3xl font-bold text-foreground">
          Importar de um link
        </h1>
        <p className="mb-5 text-sm text-muted-foreground">
          Viu um Reels, TikTok, vídeo ou podcast citando filmes e séries? Cole o link
          (ou a legenda). Em podcasts e vídeos, a IA ouve o conteúdo inteiro e identifica
          todos os títulos citados.
        </p>

        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Cole aqui o link do post/podcast — ou a legenda com os títulos citados"
          className="min-h-[110px]"
          aria-label="Link ou texto do conteúdo"
        />

        <Button
          className="mt-3 w-full"
          size="lg"
          disabled={loading || !input.trim()}
          onClick={() => run(input)}
        >
          {loading ? (
            <>
              <Sparkles className="mr-2 h-4 w-4 animate-pulse" />
              {listening ? "Ouvindo o episódio..." : "Lendo o conteúdo..."}
            </>
          ) : (
            <>
              <Link2 className="mr-2 h-4 w-4" />
              Encontrar filmes e séries
            </>
          )}
        </Button>

        <p className="mt-2 text-xs text-muted-foreground">
          Episódios longos podem levar alguns minutos — você pode sair da tela que o
          Gavetta continua ouvindo.
        </p>

        {listening && (
          <div className="mt-5 rounded-lg border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <Headphones className="h-4 w-4 animate-pulse text-primary" />
              <span className="text-sm font-medium text-foreground">
                {job?.stage ?? "Ouvindo o episódio"}
              </span>
            </div>
            {job?.source_title && (
              <p className="mb-2 line-clamp-1 text-xs text-muted-foreground">
                {job.source_title}
              </p>
            )}
            <Progress value={progressPct} className="h-2" />
            <p className="mt-2 text-xs text-muted-foreground">
              {job?.status === "extracting"
                ? "Procurando os filmes e séries citados na transcrição..."
                : job?.total
                ? `Trecho ${Math.min(job.progress + 1, job.total)} de ${job.total}`
                : "Preparando o áudio..."}
            </p>
          </div>
        )}

        {loading && !listening && (
          <div className="mt-6 grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[2/3] w-full rounded-lg" />
            ))}
          </div>
        )}

        {needsText && !loading && (
          <div className="mt-5 flex gap-3 rounded-lg border border-border bg-card p-4">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Não consegui ler esse link (pode ser um post privado, sem legenda ou com
              áudio protegido). Copie a legenda/descrição do conteúdo e cole no campo
              acima.
            </p>
          </div>
        )}

        {items && items.length > 0 && !loading && (
          <section className="mt-6">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h2 className="font-heading text-lg font-bold text-foreground">
                  {items.length} {items.length === 1 ? "título encontrado" : "títulos encontrados"}
                </h2>
                {sourceTitle && (
                  <p className="line-clamp-1 text-xs text-muted-foreground">
                    {sourceTitle}
                  </p>
                )}
              </div>
              <Button size="sm" onClick={() => openQueue(0)}>
                <ListChecks className="mr-2 h-4 w-4" />
                Revisar um a um
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {contents.map((content, i) => (
                <ContentCard
                  key={content.id}
                  content={content}
                  onClick={() => openQueue(i)}
                />
              ))}
            </div>

            {unmatched.length > 0 && (
              <div className="mt-5">
                <p className="mb-2 text-xs text-muted-foreground">
                  Citados, mas não encontrados no catálogo:
                </p>
                <div className="flex flex-wrap gap-2">
                  {unmatched.map((u) => (
                    <Badge key={u} variant="outline">
                      {u}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {items && items.length === 0 && !needsText && !loading && (
          <p className="mt-6 text-sm text-muted-foreground">
            Nenhum filme ou série foi citado no conteúdo que consegui ler. Tente colar a
            legenda completa do post.
          </p>
        )}
      </main>

      <ImportQueueDialog
        queue={contents}
        contexts={contexts}
        startIndex={queueStart}
        open={queueOpen}
        onOpenChange={setQueueOpen}
        onFinish={() => toast.success("Fim da lista! Tudo revisado.")}
      />

      <BottomNav />
    </div>
  );
}

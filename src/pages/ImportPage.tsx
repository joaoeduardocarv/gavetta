import { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useSearchParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ContentCard } from "@/components/ContentCard";
import { ImportQueueDialog } from "@/components/ImportQueueDialog";
import { Link2, Sparkles, ListChecks, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Content } from "@/lib/mockData";
import {
  ExtractedItem,
  extractTitlesFromSource,
  firstUrlFrom,
  matchToContent,
} from "@/lib/importFromLink";

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
  const [singleContent, setSingleContent] = useState<Content | null>(null);

  const contents = useMemo(
    () => (items ?? []).map((i) => matchToContent(i.match)),
    [items],
  );

  const run = useCallback(async (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    setLoading(true);
    setItems(null);
    setUnmatched([]);
    setNeedsText(false);
    try {
      const url = firstUrlFrom(value);
      const isOnlyUrl = url && value.replace(url, "").trim().length < 8;
      const res = await extractTitlesFromSource(
        isOnlyUrl ? { url } : { url: url ?? undefined, text: value },
      );
      setSourceTitle(res.sourceTitle || "");
      setNeedsText(res.needsText);
      setUnmatched(res.unmatched ?? []);
      setItems(res.items);
      if (res.needsText) {
        toast.info(res.message ?? "Cole a legenda ou descrição do conteúdo.");
      } else if (res.items.length === 0) {
        toast.info("Não encontrei filmes ou séries citados nesse conteúdo.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao processar.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Web Share Target (Android): /import?url=...&text=...&title=...
  useEffect(() => {
    const shared = [params.get("url"), params.get("text"), params.get("title")]
      .filter(Boolean)
      .join("\n")
      .trim();
    if (shared) {
      setInput(shared);
      void run(shared);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openQueue = (start = 0) => {
    setQueueStart(start);
    setQueueOpen(true);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <Helmet>
        <title>Importar filmes e séries de um link · Gavetta</title>
        <meta
          name="description"
          content="Cole o link de um Reels, TikTok, vídeo do YouTube ou episódio de podcast e adicione todos os filmes e séries citados nas suas gavettas."
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
          (ou a legenda) e a IA do Gavetta identifica todos os títulos citados.
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
              Lendo o conteúdo...
            </>
          ) : (
            <>
              <Link2 className="mr-2 h-4 w-4" />
              Encontrar filmes e séries
            </>
          )}
        </Button>

        {loading && (
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
              Não consegui ler esse link (pode ser um post privado ou sem legenda).
              Copie a legenda/descrição do conteúdo e cole no campo acima.
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
            Nenhum filme ou série foi citado no texto que consegui ler. Tente colar a
            legenda completa do post.
          </p>
        )}
      </main>

      <ImportQueueDialog
        queue={contents}
        startIndex={queueStart}
        open={queueOpen}
        onOpenChange={setQueueOpen}
        onFinish={() => toast.success("Fim da lista! Tudo revisado.")}
      />

      <BottomNav />
    </div>
  );
}

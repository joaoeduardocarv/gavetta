import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { useDrawers } from "@/contexts/DrawerContext";
import {
  getTrendingMovies,
  getTrendingTV,
  getTMDBImageUrl,
  type TMDBMovie,
  type TMDBTVShow,
} from "@/lib/tmdb";
import { normalizeStoredContent } from "@/lib/contentNormalizer";
import { Content } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { Check, Plus, SkipForward, X, Loader2, Sparkles } from "lucide-react";

const BATCH_SIZE = 20;


function interleave(movies: Content[], series: Content[]): Content[] {
  // ~60% movies / 40% series
  const out: Content[] = [];
  const mCount = Math.round(BATCH_SIZE * 0.6);
  const sCount = BATCH_SIZE - mCount;
  const m = movies.slice(0, mCount);
  const s = series.slice(0, sCount);
  let i = 0;
  let j = 0;
  while (i < m.length || j < s.length) {
    if (i < m.length) out.push(m[i++]);
    if (j < s.length) out.push(s[j++]);
  }
  return out.slice(0, BATCH_SIZE);
}

export function QuickStartLibrary() {
  const {
    assignments,
    setDefaultDrawer,
    pendingWatchedAssignment,
  } = useDrawers();


  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Content[] | null>(null);
  const [index, setIndex] = useState(0);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Quick-start is part of first-login onboarding: only open when the tour
  // finishes (event below). Persistence lives on profiles.onboarded_at.
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("gavetta:onboarding-finished", handler);
    return () =>
      window.removeEventListener("gavetta:onboarding-finished", handler);
  }, []);


  // Fetch trending titles once when opened
  useEffect(() => {
    if (!open || items !== null) return;
    let cancelled = false;
    (async () => {
      try {
        const [movies, tv] = await Promise.all([
          getTrendingMovies("week"),
          getTrendingTV("week"),
        ]);

        const taken = new Set(assignments.map((a) => a.contentId));

        const toContent = (
          raw: TMDBMovie | TMDBTVShow,
          type: "movie" | "tv",
        ): Content =>
          normalizeStoredContent(raw as unknown, {
            productionId: `${type}-${raw.id}`,
            productionType: type,
          });

        const mList = (movies || [])
          .map((m) => toContent(m, "movie"))
          .filter((c) => !taken.has(c.id) && c.posterUrl !== "/placeholder.svg");
        const sList = (tv || [])
          .map((t) => toContent(t, "tv"))
          .filter((c) => !taken.has(c.id) && c.posterUrl !== "/placeholder.svg");

        const merged = interleave(mList, sList);
        if (!cancelled) setItems(merged);
      } catch (err) {
        console.error("QuickStart trending fetch failed", err);
        if (!cancelled) setFetchError("Não foi possível carregar populares.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, items, assignments]);

  const finish = () => {
    setOpen(false);
  };


  const advance = () => {
    if (!items) return;
    if (index + 1 >= items.length) {
      finish();
    } else {
      setIndex((i) => i + 1);
    }
  };

  const handleWatched = async () => {
    if (!items) return;
    const content = items[index];
    setBusy(true);
    try {
      await setDefaultDrawer(content, "watched");
    } finally {
      setBusy(false);
      advance();
    }
  };

  const handleToWatch = async () => {
    if (!items) return;
    const content = items[index];
    setBusy(true);
    try {
      await setDefaultDrawer(content, "to-watch");
    } finally {
      setBusy(false);
      advance();
    }
  };

  if (!open) return null;

  // While the rating modal is up, step out of the way so it can be used.
  const hiddenForRating = !!pendingWatchedAssignment;

  const current = items?.[index];
  const total = items?.length ?? 0;
  const progress = total > 0 ? ((index + 1) / total) * 100 : 0;

  return createPortal(
    <div
      className={`fixed inset-0 z-[90] bg-background/95 backdrop-blur transition-opacity ${
        hiddenForRating ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="Monte sua estante"
    >
      <div className="flex h-full max-h-screen flex-col mx-auto max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>
              {total > 0 ? `${index + 1} de ${total}` : "Monte sua estante"}
            </span>
          </div>
          <button
            type="button"
            onClick={finish}
            aria-label="Encerrar"
            className="rounded-full p-2 text-muted-foreground hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-4 pt-2">
          <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {!items && !fetchError && (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {fetchError && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <p className="text-muted-foreground">{fetchError}</p>
              <Button onClick={finish} variant="outline">
                Fechar
              </Button>
            </div>
          )}

          {items && items.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <Sparkles className="h-10 w-10 text-primary" />
              <h2 className="font-heading text-xl">Sua estante já tem tudo!</h2>
              <p className="text-sm text-muted-foreground">
                Não encontramos populares novos para sugerir agora.
              </p>
              <Button onClick={finish}>Começar a usar</Button>
            </div>
          )}

          {current && (
            <div className="flex flex-col items-center gap-4">
              <div className="text-center">
                <h2 className="font-heading text-2xl leading-tight">
                  Vamos montar sua estante
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Já viu este? Quer assistir? Ou pula para o próximo.
                </p>
              </div>

              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-md">
                <img
                  src={
                    current.posterUrl?.startsWith("http")
                      ? current.posterUrl
                      : getTMDBImageUrl(current.posterUrl ?? null, "w500")
                  }
                  alt={current.title}
                  className="h-[44vh] w-auto max-w-full object-cover"
                  loading="eager"
                />
              </div>

              <div className="w-full text-center">
                <div className="flex items-center justify-center gap-2">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {current.type === "movie" ? "Filme" : "Série"}
                  </span>
                  {current.releaseDate && (
                    <span className="text-xs text-muted-foreground">
                      {current.releaseDate.slice(0, 4)}
                    </span>
                  )}
                </div>
                <h3 className="mt-1 font-heading text-xl">{current.title}</h3>
                {current.synopsis && (
                  <p className="mt-1.5 line-clamp-3 text-sm text-muted-foreground">
                    {current.synopsis}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        {current && (
          <div className="border-t border-border bg-background px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-3">
            <div className="flex flex-col gap-2">
              <Button
                size="lg"
                onClick={handleWatched}
                disabled={busy}
                className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <Check className="h-4 w-4" />
                Já vi — avaliar
              </Button>
              <Button
                size="lg"
                onClick={handleToWatch}
                disabled={busy}
                className="w-full"
              >
                <Plus className="h-4 w-4" />
                Quero ver
              </Button>
              <Button
                size="lg"
                onClick={advance}
                disabled={busy}
                variant="ghost"
                className="w-full text-muted-foreground"
              >
                <SkipForward className="h-4 w-4" />
                Pular
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

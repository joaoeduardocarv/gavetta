import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Loader2, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { searchAll, getTMDBImageUrl, getTrendingMovies, getMovieDetails, getTVDetails } from "@/lib/tmdb";
import { trackEvent } from "@/hooks/useAnalytics";
import { formatRuntime } from "@/lib/utils";

interface Item {
  id: number;
  type: "movie" | "tv";
  title: string;
  poster: string | null;
  year: string;
  rating: number;
  runtime?: number;
}

/** Preenche a duração em segundo plano (filme = runtime; série = média por episódio). */
async function enrichRuntimes(list: Item[]): Promise<Item[]> {
  return Promise.all(
    list.map(async (item) => {
      try {
        if (item.type === "movie") {
          const d = await getMovieDetails(item.id);
          return { ...item, runtime: d?.runtime };
        }
        const d = await getTVDetails(item.id);
        const runtimes = (d?.episode_run_time || []).filter((t: number) => t > 0);
        return {
          ...item,
          runtime: runtimes.length
            ? Math.round(runtimes.reduce((a: number, b: number) => a + b, 0) / runtimes.length)
            : undefined,
        };
      } catch {
        return item;
      }
    })
  );
}

/**
 * Amostra pública: qualquer visitante pode buscar filmes e séries direto
 * na landing. A conta só é pedida quando ele tenta guardar um título.
 */
export function LandingTryIt() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadedTrending, setLoadedTrending] = useState(false);
  const reqRef = useRef(0);

  // Cartazes iniciais: em alta hoje
  useEffect(() => {
    let active = true;
    getTrendingMovies("day")
      .then((movies) => {
        if (!active) return;
        setItems(
          movies.slice(0, 8).map((m) => ({
            id: m.id,
            type: "movie" as const,
            title: m.title,
            poster: m.poster_path,
            year: (m.release_date ?? "").slice(0, 4),
            rating: m.vote_average ?? 0,
          }))
        );
        setLoadedTrending(true);
      })
      .catch(() => setLoadedTrending(true));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return;
    const id = ++reqRef.current;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const { movies, tvShows } = await searchAll(term);
        if (reqRef.current !== id) return;
        const mapped: Item[] = [
          ...movies.map((m) => ({
            id: m.id,
            type: "movie" as const,
            title: m.title,
            poster: m.poster_path,
            year: (m.release_date ?? "").slice(0, 4),
            rating: m.vote_average ?? 0,
          })),
          ...tvShows.map((t) => ({
            id: t.id,
            type: "tv" as const,
            title: t.name,
            poster: t.poster_path,
            year: (t.first_air_date ?? "").slice(0, 4),
            rating: t.vote_average ?? 0,
          })),
        ]
          .filter((i) => i.poster)
          .sort((a, b) => b.rating - a.rating)
          .slice(0, 8);
        setItems(mapped);
        // Duração chega depois, sem bloquear a exibição dos cartazes
        enrichRuntimes(mapped).then((enriched) => {
          if (reqRef.current === id) setItems(enriched);
        });
      } finally {
        if (reqRef.current === id) setLoading(false);
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [query]);

  const goToSignup = (item?: Item) => {
    trackEvent("landing_try_it_add", {
      title: item?.title ?? "sem_titulo",
      search: query.trim() || "trending",
    });
    const next = item ? `/${item.type === "movie" ? "m" : "s"}/${item.id}` : "/";
    navigate(`/auth?tab=signup&next=${encodeURIComponent(next)}`);
  };

  return (
    <section className="border-y border-border/40 bg-card/30 py-16 md:py-24">
      <div className="container mx-auto max-w-5xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Experimente agora — sem criar conta
          </h2>
          <p className="mt-3 text-muted-foreground">
            Busque qualquer filme ou série. A conta só entra quando você quiser
            guardar o título numa gavetta.
          </p>
        </div>

        <div className="relative mx-auto mt-8 max-w-xl">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ex.: Ainda Estou Aqui, The Last of Us..."
            aria-label="Buscar filme ou série"
            className="h-14 rounded-full pl-12 pr-12 text-base"
          />
          {loading && (
            <Loader2 className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {items.map((item) => (
            <button
              key={`${item.type}-${item.id}`}
              type="button"
              onClick={() => goToSignup(item)}
              className="group overflow-hidden rounded-xl border border-border/50 bg-background/60 text-left transition-all hover:border-primary/50 hover:shadow-glow"
            >
              <img
                src={getTMDBImageUrl(item.poster, "w300")}
                alt={item.title}
                loading="lazy"
                className="aspect-[2/3] w-full object-cover"
              />
              <div className="p-3">
                <div className="line-clamp-1 text-sm font-medium">{item.title}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {item.year || "—"} · {item.type === "movie" ? "Filme" : "Série"}
                  {formatRuntime(item.runtime) ? ` · ${formatRuntime(item.runtime)}` : ""}
                </div>
                <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
                  <Plus className="h-3.5 w-3.5" /> Adicionar à gavetta
                </span>
              </div>
            </button>
          ))}
          {!items.length && loadedTrending && !loading && (
            <p className="col-span-full text-center text-sm text-muted-foreground">
              Nada encontrado. Tente outro título.
            </p>
          )}
        </div>

        <div className="mt-8 text-center">
          <Button size="lg" className="shadow-glow" onClick={() => goToSignup()}>
            Criar minha gavetta grátis
          </Button>
        </div>
      </div>
    </section>
  );
}

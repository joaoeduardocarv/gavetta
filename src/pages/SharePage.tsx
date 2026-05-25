import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  getMovieDetails,
  getTVDetails,
  getMovieCredits,
  getTVCredits,
  getMovieWatchProviders,
  getTVWatchProviders,
  getTMDBImageUrl,
  getTMDBProfileUrl,
  extractStreamingLogos,
  type TMDBMovieDetails,
  type TMDBTVDetails,
  type TMDBCastMember,
  type TMDBCrewMember,
  type TMDBWatchProvidersResult,
  type TMDBOfferType,
} from "@/lib/tmdb";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Film, Star, Tv } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { SignupPromptOverlay } from "@/components/SignupPromptOverlay";


type ShareType = "movie" | "tv";

interface LoadedData {
  type: ShareType;
  title: string;
  originalTitle?: string;
  releaseYear?: string;
  rating?: number;
  synopsis: string;
  posterPath: string | null;
  backdropPath: string | null;
  genres: string[];
  director?: { id: number; name: string; profile_path: string | null };
  cast: TMDBCastMember[];
  providers: TMDBWatchProvidersResult | null;
}

async function loadMovie(id: number): Promise<LoadedData> {
  const [details, credits, providers] = await Promise.all([
    getMovieDetails(id),
    getMovieCredits(id).catch(() => ({ cast: [], crew: [] as TMDBCrewMember[] })),
    getMovieWatchProviders(id).catch(() => null),
  ]);
  const director = credits.crew.find((c) => c.job === "Director");
  return {
    type: "movie",
    title: details.title,
    originalTitle: (details as unknown as { original_title?: string }).original_title,
    releaseYear: details.release_date ? new Date(details.release_date).getFullYear().toString() : undefined,
    rating: details.vote_average ? Math.round(details.vote_average * 10) / 10 : undefined,
    synopsis: details.overview || "Sem sinopse disponível.",
    posterPath: details.poster_path,
    backdropPath: details.backdrop_path,
    genres: details.genres?.map((g) => g.name) ?? [],
    director: director ? { id: director.id, name: director.name, profile_path: director.profile_path } : undefined,
    cast: credits.cast.slice(0, 12),
    providers,
  };
}

async function loadTV(id: number): Promise<LoadedData> {
  const [details, credits, providers] = await Promise.all([
    getTVDetails(id),
    getTVCredits(id).catch(() => ({ cast: [], crew: [] as TMDBCrewMember[] })),
    getTVWatchProviders(id).catch(() => null),
  ]);
  const creator = (details as TMDBTVDetails).created_by?.[0];
  return {
    type: "tv",
    title: details.name,
    originalTitle: (details as unknown as { original_name?: string }).original_name,
    releaseYear: details.first_air_date ? new Date(details.first_air_date).getFullYear().toString() : undefined,
    rating: details.vote_average ? Math.round(details.vote_average * 10) / 10 : undefined,
    synopsis: details.overview || "Sem sinopse disponível.",
    posterPath: details.poster_path,
    backdropPath: details.backdrop_path,
    genres: details.genres?.map((g) => g.name) ?? [],
    director: creator ? { id: creator.id, name: creator.name, profile_path: null } : undefined,
    cast: credits.cast.slice(0, 12),
    providers,
  };
}

const SECTION_LABELS: Record<TMDBOfferType, string> = {
  flatrate: "Incluso na assinatura",
  free: "Grátis",
  ads: "Grátis com anúncios",
  rent: "Alugar",
  buy: "Comprar",
};

export default function SharePage() {
  const { type, tmdbId } = useParams<{ type: ShareType; tmdbId: string }>();
  const { user } = useAuth();
  
  const [data, setData] = useState<LoadedData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    const id = Number(tmdbId);
    if (!id || (type !== "movie" && type !== "tv")) {
      setError("Link inválido.");
      return;
    }
    const loader = type === "movie" ? loadMovie(id) : loadTV(id);
    loader
      .then(setData)
      .catch((e) => {
        console.error("SharePage load error:", e);
        setError("Não foi possível carregar este conteúdo.");
      });
  }, [type, tmdbId]);

  const pageTitle = data ? `${data.title}${data.releaseYear ? ` (${data.releaseYear})` : ""} · Gavetta` : "Gavetta";
  const pageDesc = data ? data.synopsis.slice(0, 155) : "Compartilhado via Gavetta — organize seus filmes e séries.";
  const ogImage = data?.backdropPath
    ? getTMDBImageUrl(data.backdropPath, "original")
    : data?.posterPath
    ? getTMDBImageUrl(data.posterPath, "w500")
    : undefined;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDesc} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDesc} />
        <meta property="og:type" content="video.movie" />
        {ogImage && <meta property="og:image" content={ogImage} />}
        <meta name="twitter:card" content="summary_large_image" />
      </Helmet>

      {/* Top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b bg-background/80 px-4 py-3 backdrop-blur">
        <Link to="/" className="font-heading text-lg font-bold">
          Gavetta
        </Link>
        {user ? (
          <Button asChild size="sm" variant="outline">
            <Link to="/">Meu app</Link>
          </Button>
        ) : (
          <Button asChild size="sm">
            <Link to="/auth">Criar conta grátis</Link>
          </Button>
        )}
      </header>

      {error && (
        <div className="mx-auto max-w-2xl p-6 text-center">
          <h1 className="font-heading text-2xl">{error}</h1>
          <p className="mt-2 text-muted-foreground">Verifique se o link está correto.</p>
          <Button asChild className="mt-6">
            <Link to="/">Voltar para Gavetta</Link>
          </Button>
        </div>
      )}

      {!data && !error && <LoadingSkeleton />}

      {data && (
        <article className="mx-auto max-w-3xl pb-16">
          {/* Backdrop */}
          {data.backdropPath && (
            <div className="relative h-56 w-full overflow-hidden sm:h-72 md:h-96">
              <img
                src={getTMDBImageUrl(data.backdropPath, "original")}
                alt=""
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
            </div>
          )}

          <div className="space-y-6 p-4 sm:p-6">
            {/* Header */}
            <div className="flex gap-4">
              <Avatar className="h-36 w-24 flex-shrink-0 rounded-lg sm:h-44 sm:w-32">
                <AvatarImage
                  src={getTMDBImageUrl(data.posterPath, "w500")}
                  alt={data.title}
                  className="object-cover"
                />
                <AvatarFallback className="rounded-lg">{data.title[0]}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 space-y-2">
                <h1 className="font-heading text-2xl font-bold sm:text-3xl">
                  {data.title}
                </h1>
                {data.originalTitle && data.originalTitle !== data.title && (
                  <p className="text-sm italic text-muted-foreground">
                    {data.originalTitle}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="gap-1">
                    {data.type === "movie" ? <Film className="h-3.5 w-3.5" /> : <Tv className="h-3.5 w-3.5" />}
                    {data.type === "movie" ? "Filme" : "Série"}
                  </Badge>
                  {data.releaseYear && (
                    <Badge variant="outline" className="gap-1">
                      <Calendar className="h-3 w-3" />
                      {data.releaseYear}
                    </Badge>
                  )}
                  {data.rating && (
                    <Badge variant="outline" className="gap-1">
                      <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                      {data.rating}/10
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {data.director && (
              <section>
                <h2 className="text-sm font-semibold">
                  {data.type === "movie" ? "Diretor" : "Criador"}
                </h2>
                <div className="mt-2 flex items-center gap-3 rounded-lg p-2">
                  <Avatar className="h-12 w-12">
                    <AvatarImage
                      src={data.director.profile_path ? getTMDBProfileUrl(data.director.profile_path) : undefined}
                      alt={data.director.name}
                      className="object-cover"
                    />
                    <AvatarFallback>{data.director.name[0]}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{data.director.name}</span>
                </div>
              </section>
            )}

            {data.cast.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold">Elenco</h2>
                <div className="-mx-4 mt-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
                  <div className="flex gap-3 pb-2">
                    {data.cast.map((p) => (
                      <div key={p.id} className="flex w-20 flex-shrink-0 flex-col items-center gap-2 p-2">
                        <Avatar className="h-14 w-14">
                          <AvatarImage
                            src={p.profile_path ? getTMDBProfileUrl(p.profile_path) : undefined}
                            alt={p.name}
                            className="object-cover"
                          />
                          <AvatarFallback>{p.name[0]}</AvatarFallback>
                        </Avatar>
                        <span className="line-clamp-2 w-full text-center text-xs">{p.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {data.genres.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold">Gêneros</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  {data.genres.map((g) => (
                    <Badge key={g} variant="secondary">{g}</Badge>
                  ))}
                </div>
              </section>
            )}

            <ProvidersBlock providers={data.providers} />

            <section>
              <h2 className="text-sm font-semibold">Sinopse</h2>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
                {data.synopsis}
              </p>
            </section>

            {/* Bottom CTA always visible */}
            <Separator />
            <div className="rounded-xl border bg-card p-6 text-center">
              <h3 className="font-heading text-xl font-bold">
                Quer organizar tudo que você assiste?
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                No Gavetta você cria gavetas, acompanha episódios e descobre o que seus amigos estão vendo.
              </p>
              <Button asChild size="lg" className="mt-4 w-full sm:w-auto">
                <Link to={user ? "/" : "/auth"}>
                  {user ? "Abrir Gavetta" : "Criar conta grátis"}
                </Link>
              </Button>
            </div>
          </div>
        </article>
      )}

      {/* Conversion popup only for non-authenticated visitors */}
      {!user && <SignupPromptOverlay delaySeconds={60} scrollThreshold={0.5} />}
    </div>
  );
}

function ProvidersBlock({ providers }: { providers: TMDBWatchProvidersResult | null }) {
  const logos = extractStreamingLogos(providers);
  if (logos.length === 0) return null;

  const sections: { key: TMDBOfferType; label: string; items: typeof logos }[] = (
    ["flatrate", "free", "ads", "rent", "buy"] as TMDBOfferType[]
  )
    .map((key) => ({
      key,
      label: SECTION_LABELS[key],
      items: logos.filter((l) => l.offerTypes.includes(key)),
    }))
    .filter((s) => s.items.length > 0);

  if (sections.length === 0) return null;

  return (
    <section>
      <h2 className="text-sm font-semibold">Onde assistir</h2>
      <div className="mt-2 space-y-2.5">
        {sections.map(({ key, label, items }) => (
          <div key={key}>
            <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
            <div className="flex flex-wrap gap-2">
              {items.map((l) => (
                <div
                  key={l.name}
                  className="flex items-center gap-1.5 rounded-md border bg-card px-2 py-1"
                  title={`${l.name} · ${label}`}
                >
                  <img
                    src={getTMDBImageUrl(l.logoPath, "w200")}
                    alt={l.name}
                    className="h-5 w-5 rounded-sm object-cover"
                    loading="lazy"
                  />
                  <span className="text-xs">{l.name}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        <p className="pt-1 text-[11px] text-muted-foreground">
          Disponibilidade no Brasil via JustWatch.
        </p>
      </div>
    </section>
  );
}

function LoadingSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <Skeleton className="h-56 w-full" />
      <div className="flex gap-4">
        <Skeleton className="h-36 w-24 rounded-lg" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

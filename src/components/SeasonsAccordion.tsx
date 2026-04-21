import { useEffect, useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Check, CheckCheck } from "lucide-react";
import { getTVDetails, getSeasonEpisodes, type TMDBEpisode, type TMDBSeason } from "@/lib/tmdb";
import { useWatchedEpisodes } from "@/hooks/useWatchedEpisodes";
import { cn } from "@/lib/utils";

interface SeasonsAccordionProps {
  tmdbTvId: number;
  /** Called whenever total watched count changes; lets parent detect "all watched". */
  onProgressChange?: (info: { totalEpisodes: number; totalWatched: number }) => void;
}

function formatEpisodeAirDate(airDate: string | null | undefined): { label: string; isFuture: boolean } | null {
  if (!airDate) return null;
  const ep = new Date(airDate + "T00:00:00");
  if (isNaN(ep.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = ep.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  const isFuture = diffDays > 0;
  if (diffDays === 0) return { label: "Hoje", isFuture: true };
  if (diffDays === 1) return { label: "Amanhã", isFuture: true };
  if (diffDays > 1 && diffDays <= 30) return { label: `Em ${diffDays} dias`, isFuture: true };
  const formatted = ep.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  return { label: formatted, isFuture };
}

export function SeasonsAccordion({ tmdbTvId, onProgressChange }: SeasonsAccordionProps) {
  const [seasons, setSeasons] = useState<TMDBSeason[]>([]);
  const [totalEpisodes, setTotalEpisodes] = useState(0);
  const [isLoadingSeasons, setIsLoadingSeasons] = useState(true);
  const [episodesBySeason, setEpisodesBySeason] = useState<Record<number, TMDBEpisode[]>>({});
  const [loadingSeason, setLoadingSeason] = useState<number | null>(null);

  const {
    isWatched,
    toggleEpisode,
    markSeason,
    markAllSeasons,
    unmarkSeason,
    watchedCountForSeason,
    totalWatched,
  } = useWatchedEpisodes(tmdbTvId);

  // Load season list
  useEffect(() => {
    let cancelled = false;
    setIsLoadingSeasons(true);
    getTVDetails(tmdbTvId)
      .then((details) => {
        if (cancelled) return;
        // Hide season 0 (specials) by default unless it's the only one
        const filtered = details.seasons.filter((s) => s.season_number > 0);
        const list = filtered.length > 0 ? filtered : details.seasons;
        setSeasons(list);
        setTotalEpisodes(details.number_of_episodes ?? list.reduce((sum, s) => sum + (s.episode_count ?? 0), 0));
      })
      .catch((err) => console.error("Error loading TV details:", err))
      .finally(() => {
        if (!cancelled) setIsLoadingSeasons(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tmdbTvId]);

  // Notify parent when progress changes
  useEffect(() => {
    if (totalEpisodes > 0) {
      onProgressChange?.({ totalEpisodes, totalWatched });
    }
  }, [totalWatched, totalEpisodes, onProgressChange]);

  const handleAccordionChange = async (value: string) => {
    if (!value) return;
    const seasonNumber = Number(value.replace("season-", ""));
    if (Number.isNaN(seasonNumber)) return;
    if (episodesBySeason[seasonNumber]) return; // already loaded
    setLoadingSeason(seasonNumber);
    try {
      const eps = await getSeasonEpisodes(tmdbTvId, seasonNumber);
      setEpisodesBySeason((prev) => ({ ...prev, [seasonNumber]: eps }));
    } catch (err) {
      console.error("Error loading episodes:", err);
    } finally {
      setLoadingSeason(null);
    }
  };

  if (isLoadingSeasons) {
    return (
      <div className="flex items-center justify-center py-6 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        <span className="text-sm">Carregando temporadas...</span>
      </div>
    );
  }

  if (seasons.length === 0) return null;

  const overallPercent = totalEpisodes > 0 ? Math.round((totalWatched / totalEpisodes) * 100) : 0;

  return (
    <div className="space-y-3">
      {/* Overall progress */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">Progresso</span>
          <span className="text-muted-foreground">
            {totalWatched} / {totalEpisodes} episódios
          </span>
        </div>
        <Progress value={overallPercent} className="h-2" />
      </div>

      <Accordion type="single" collapsible onValueChange={handleAccordionChange}>
        {seasons.map((season) => {
          const watchedCount = watchedCountForSeason(season.season_number);
          const epCount = season.episode_count ?? 0;
          const allWatched = epCount > 0 && watchedCount >= epCount;
          const year = season.air_date ? new Date(season.air_date).getFullYear() : null;
          const episodes = episodesBySeason[season.season_number];
          const isLoadingEps = loadingSeason === season.season_number;

          return (
            <AccordionItem key={season.id} value={`season-${season.season_number}`}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3 flex-1 min-w-0 text-left">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground">{season.name}</span>
                      {year && (
                        <Badge variant="outline" className="text-xs">
                          {year}
                        </Badge>
                      )}
                      {allWatched && (
                        <Badge variant="secondary" className="gap-1 text-xs bg-primary/10 text-primary border-primary/20">
                          <Check className="h-3 w-3" />
                          Completo
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {watchedCount} / {epCount} episódios
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pt-1">
                  {/* Season-level actions */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={allWatched ? "outline" : "default"}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (allWatched) {
                          unmarkSeason(season.season_number);
                        } else if (episodes) {
                          markSeason(season.season_number, episodes.map((ep) => ep.episode_number));
                        }
                      }}
                      disabled={!episodes}
                      className="flex-1"
                    >
                      {allWatched ? "Desmarcar temporada" : "Marcar temporada inteira"}
                    </Button>
                  </div>

                  {/* Episodes */}
                  {isLoadingEps ? (
                    <div className="flex items-center justify-center py-4 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      <span className="text-sm">Carregando episódios...</span>
                    </div>
                  ) : episodes ? (
                    <ul className="space-y-2">
                      {episodes.map((ep) => {
                        const watched = isWatched(season.season_number, ep.episode_number);
                        const airInfo = formatEpisodeAirDate(ep.air_date);
                        return (
                          <li
                            key={ep.id}
                            className={cn(
                              "flex items-start gap-3 p-2 rounded-md border border-border/50 transition-colors",
                              watched && "bg-muted/50"
                            )}
                          >
                            <Checkbox
                              checked={watched}
                              disabled={airInfo?.isFuture && airInfo.label !== "Hoje"}
                              onCheckedChange={() => toggleEpisode(season.season_number, ep.episode_number)}
                              className="mt-0.5"
                              aria-label={`Marcar episódio ${ep.episode_number} como assistido`}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={cn("text-sm font-medium", watched && "text-muted-foreground line-through")}>
                                  {ep.episode_number}. {ep.name}
                                </span>
                                {ep.runtime > 0 && (
                                  <span className="text-xs text-muted-foreground">{ep.runtime} min</span>
                                )}
                                {airInfo && (
                                  <Badge
                                    variant={airInfo.isFuture ? "default" : "outline"}
                                    className={cn(
                                      "text-xs",
                                      airInfo.isFuture && "bg-accent/20 text-accent-foreground border-accent/30"
                                    )}
                                  >
                                    {airInfo.isFuture ? "Em breve · " : ""}
                                    {airInfo.label}
                                  </Badge>
                                )}
                              </div>
                              {ep.overview && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{ep.overview}</p>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}

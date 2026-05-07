import { useEffect, useRef, useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Check, CheckCheck, AlertTriangle } from "lucide-react";
import { getTVDetails, getSeasonEpisodes, type TMDBEpisode, type TMDBSeason } from "@/lib/tmdb";
import { useWatchedEpisodes } from "@/hooks/useWatchedEpisodes";
import { useEpisodeRatings } from "@/hooks/useEpisodeRatings";
import { RatingPicker } from "@/components/RatingPicker";
import { useDrawers } from "@/contexts/DrawerContext";
import type { Content } from "@/lib/mockData";
import { cn } from "@/lib/utils";

interface SeasonsAccordionProps {
  tmdbTvId: number;
  /** Series TMDB status (e.g. "Ended", "Returning Series"). Used to warn when offering to move to "Assistido". */
  seriesStatus?: string;
  /** Series content (used to move into the "Assistido" drawer when prompted). */
  content?: Content;
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

export function SeasonsAccordion({ tmdbTvId, seriesStatus, content, onProgressChange }: SeasonsAccordionProps) {
  const [seasons, setSeasons] = useState<TMDBSeason[]>([]);
  const [totalEpisodes, setTotalEpisodes] = useState(0);
  const [isLoadingSeasons, setIsLoadingSeasons] = useState(true);
  const [episodesBySeason, setEpisodesBySeason] = useState<Record<number, TMDBEpisode[]>>({});
  const [loadingSeason, setLoadingSeason] = useState<number | null>(null);
  /** Key "season:episode" of the rating picker that should be auto-opened (just-watched episode). */
  const [autoOpenRatingKey, setAutoOpenRatingKey] = useState<string | null>(null);
  /** Whether the "move to Assistido" prompt is open. */
  const [showMoveToWatchedPrompt, setShowMoveToWatchedPrompt] = useState(false);
  /** Avoid re-prompting in the same view session. */
  const promptShownRef = useRef(false);

  const { setDefaultDrawer, getContentDrawers } = useDrawers();
  const isAlreadyWatched = content
    ? getContentDrawers(content.id).defaultDrawer === "watched"
    : false;
  const isOngoingSeries = !!seriesStatus && seriesStatus !== "Ended" && seriesStatus !== "Canceled";

  const {
    isWatched,
    toggleEpisode,
    markSeason,
    markAllSeasons,
    unmarkSeason,
    watchedCountForSeason,
    totalWatched,
  } = useWatchedEpisodes(tmdbTvId);

  const {
    getStoredEpisodeRating,
    getEffectiveEpisodeRating,
    getEffectiveSeasonRating,
    getEffectiveSeriesRating,
    setEpisodeRating,
    setSeasonRating,
    setSeriesRating,
  } = useEpisodeRatings(tmdbTvId);

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

  /** True if an episode has already aired (air date <= today) or has no date. */
  const hasAired = (airDate: string | null | undefined): boolean => {
    if (!airDate) return false; // unknown date → treat as not yet aired (safer)
    const ep = new Date(airDate + "T00:00:00");
    if (isNaN(ep.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return ep.getTime() <= today.getTime();
  };

  const handleMarkAllAired = async () => {
    // Ensure every season's episodes are loaded so we can filter by air date
    const missing = seasons.filter((s) => !episodesBySeason[s.season_number]);
    let loaded = episodesBySeason;
    if (missing.length > 0) {
      try {
        const results = await Promise.all(
          missing.map((s) =>
            getSeasonEpisodes(tmdbTvId, s.season_number).then((eps) => ({
              season: s.season_number,
              eps,
            }))
          )
        );
        loaded = { ...episodesBySeason };
        results.forEach(({ season, eps }) => {
          loaded[season] = eps;
        });
        setEpisodesBySeason(loaded);
      } catch (err) {
        console.error("Error loading episodes for mark-all:", err);
        return;
      }
    }

    // Build list of aired episodes per season and mark each
    for (const s of seasons) {
      const eps = loaded[s.season_number];
      if (!eps) continue;
      const airedNumbers = eps.filter((ep) => hasAired(ep.air_date)).map((ep) => ep.episode_number);
      if (airedNumbers.length > 0) {
        await markSeason(s.season_number, airedNumbers);
      }
    }
  };

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
  const seriesRating = getEffectiveSeriesRating(seasons.map((s) => s.season_number));

  return (
    <div className="space-y-3">
      {/* Overall progress + series-level rating */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm gap-2">
          <span className="font-medium text-foreground">Progresso</span>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs">
              {totalWatched} / {totalEpisodes} eps
            </span>
            <RatingPicker
              value={seriesRating.value}
              isAverage={seriesRating.isAverage}
              label="Sua nota para a série inteira"
              size="default"
              onChange={(v) => setSeriesRating(v)}
            />
          </div>
        </div>
        <Progress value={overallPercent} className="h-2" />
      </div>

      {/* Mark whole series as watched (skips unreleased episodes) */}
      {totalEpisodes > 0 && totalWatched < totalEpisodes && (
        <Button
          size="sm"
          variant="default"
          className="w-full gap-2"
          onClick={handleMarkAllAired}
        >
          <CheckCheck className="h-4 w-4" />
          Marcar episódios já lançados como assistidos
        </Button>
      )}

      <Accordion type="single" collapsible onValueChange={handleAccordionChange}>
        {seasons.map((season) => {
          const episodes = episodesBySeason[season.season_number];
          const isLoadingEps = loadingSeason === season.season_number;
          // Use only aired episodes for accurate counts when episode list is loaded.
          const airedEpisodes = episodes?.filter((ep) => hasAired(ep.air_date));
          const epCount = airedEpisodes ? airedEpisodes.length : season.episode_count ?? 0;
          const watchedCount = airedEpisodes
            ? airedEpisodes.filter((ep) => isWatched(season.season_number, ep.episode_number)).length
            : watchedCountForSeason(season.season_number);
          const allWatched = epCount > 0 && watchedCount >= epCount;
          const year = season.air_date ? new Date(season.air_date).getFullYear() : null;
          const seasonRating = getEffectiveSeasonRating(season.season_number);
          // "Em breve" se a data de estreia da temporada é futura, ou se episódios já carregados nenhum lançou.
          const seasonAirInfo = formatEpisodeAirDate(season.air_date);
          const isUpcomingSeason =
            (seasonAirInfo?.isFuture ?? false) ||
            (episodes != null && episodes.length > 0 && episodes.every((ep) => !hasAired(ep.air_date)));

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
                      {isUpcomingSeason && (
                        <Badge className="gap-1 text-xs bg-accent/20 text-accent-foreground border border-accent/30">
                          Em breve{seasonAirInfo ? ` · ${seasonAirInfo.label}` : ""}
                        </Badge>
                      )}
                      {!isUpcomingSeason && allWatched && (
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
                  {/* Season rating chip — stops trigger toggle on click */}
                  <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                    <RatingPicker
                      value={seasonRating.value}
                      isAverage={seasonRating.isAverage}
                      label={`Sua nota para ${season.name}`}
                      onChange={(v) => setSeasonRating(season.season_number, v)}
                    />
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
                          const aired = episodes
                            .filter((ep) => hasAired(ep.air_date))
                            .map((ep) => ep.episode_number);
                          if (aired.length > 0) {
                            markSeason(season.season_number, aired);
                          }
                        }
                      }}
                      disabled={!episodes}
                      className="flex-1"
                    >
                      {allWatched ? "Desmarcar temporada" : "Marcar episódios lançados"}
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
                        const aired = hasAired(ep.air_date);
                        // Never treat unreleased episodes as watched, even if stored.
                        const watched = aired && isWatched(season.season_number, ep.episode_number);
                        const airInfo = formatEpisodeAirDate(ep.air_date);
                        const epRating = getEffectiveEpisodeRating(season.season_number, ep.episode_number);
                        const epStored = getStoredEpisodeRating(season.season_number, ep.episode_number);
                        return (
                          <li
                            key={ep.id}
                            className={cn(
                              "flex items-start gap-3 p-2 rounded-md border border-border/50 transition-colors",
                              watched && "bg-muted/50",
                              !aired && "opacity-60"
                            )}
                          >
                            <Checkbox
                              checked={watched}
                              disabled={!aired}
                              onCheckedChange={async () => {
                                if (!aired) return;
                                const wasWatched = watched;
                                await toggleEpisode(season.season_number, ep.episode_number);
                                // After marking as watched, auto-open the rating picker
                                if (!wasWatched) {
                                  setAutoOpenRatingKey(`${season.season_number}:${ep.episode_number}`);
                                }
                              }}
                              className="mt-0.5"
                              aria-label={
                                aired
                                  ? `Marcar episódio ${ep.episode_number} como assistido`
                                  : `Episódio ${ep.episode_number} ainda não lançado`
                              }
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
                            {/* Episode rating — only enabled if watched */}
                            <div className="shrink-0 mt-0.5">
                              {(() => {
                                const epKey = `${season.season_number}:${ep.episode_number}`;
                                const isAutoOpen = autoOpenRatingKey === epKey;
                                return (
                                  <RatingPicker
                                    value={epRating.value}
                                    isAverage={epRating.isAverage}
                                    disabled={!watched && epStored == null && epRating.value == null}
                                    label={
                                      watched
                                        ? `Sua nota para o episódio ${ep.episode_number}`
                                        : epRating.value != null
                                        ? `Média herdada: ${epRating.value}`
                                        : "Marque como assistido para avaliar"
                                    }
                                    open={isAutoOpen ? true : undefined}
                                    onOpenChange={(o) => {
                                      if (!o && isAutoOpen) setAutoOpenRatingKey(null);
                                    }}
                                    onChange={(v) => {
                                      setEpisodeRating(season.season_number, ep.episode_number, v);
                                      if (isAutoOpen) setAutoOpenRatingKey(null);
                                    }}
                                  />
                                );
                              })()}
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

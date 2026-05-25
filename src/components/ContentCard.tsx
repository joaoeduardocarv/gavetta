import { Star, Film, Tv, Check, Clock, Play, Bell, Clapperboard } from "lucide-react";
import { GavetaIcon } from "@/components/GavetaIcon";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { cn, formatRelativeDate } from "@/lib/utils";
import type { Content } from "@/lib/mockData";
import { DrawerPickerPopover } from "./DrawerPickerPopover";
import { useDrawers } from "@/contexts/DrawerContext";
import { getTMDBImageUrl } from "@/lib/tmdb";
import { useContentNotifications } from "@/hooks/useContentNotifications";
import { useSeriesEpisodeProgress } from "@/hooks/useWatchedEpisodes";
import { extractTmdbInfoFromId } from "@/lib/contentNormalizer";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "./ui/tooltip";
import { useTitleLanguage } from "@/hooks/useTitleLanguage";

interface ContentCardProps {
  content: Content;
  onClick?: () => void;
}

const typeLabels: Record<string, string> = {
  movie: 'Filme',
  series: 'Série',
  tv: 'Série',
};

const statusIcons = {
  watched: Check,
  watching: Play,
  to_watch: Clock,
};

const statusColors = {
  watched: 'text-green-500',
  watching: 'text-blue-500',
  to_watch: 'text-yellow-500',
};

const typeIcons: Record<string, typeof Film> = {
  movie: Film,
  series: Tv,
  tv: Tv,
};


export function ContentCard({ content, onClick }: ContentCardProps) {
  const Icon = typeIcons[content.type] || Film;
  const StatusIcon = content.status ? statusIcons[content.status] : null;
  const { getContentDrawers } = useDrawers();
  const { getContentNotification } = useContentNotifications();
  const { resolveTitle } = useTitleLanguage();

  const { defaultDrawer, customDrawers } = getContentDrawers(content.id);
  const isInAnyDrawer = defaultDrawer !== null || customDrawers.length > 0;
  const contentNotif = getContentNotification(content.id);

  // Episode-watched progress (series only)
  const isSeries = content.type === 'series' || content.type === 'tv';
  const parsedTmdb = isSeries ? extractTmdbInfoFromId(content.id) : null;
  const tmdbTvId = parsedTmdb?.mediaType === 'tv' ? parsedTmdb.tmdbId : null;
  const { watched: watchedEpCount, total: totalEpCount } = useSeriesEpisodeProgress(tmdbTvId);

  const posterSrc =
    typeof content.posterUrl === "string"
      ? content.posterUrl.startsWith("http") || content.posterUrl.startsWith("/placeholder")
        ? content.posterUrl
        : getTMDBImageUrl(content.posterUrl)
      : undefined;

  const safeTitle = resolveTitle(content);

  const safeGenres = (Array.isArray(content.genres) ? content.genres : [])
    .map((genre) => {
      if (typeof genre === "string") return genre;
      if (genre && typeof genre === "object" && "name" in genre) {
        return String((genre as { name?: unknown }).name ?? "");
      }
      return "";
    })
    .filter((genre) => Boolean(genre));

  const providerLogos = (content.watchProviderLogos || []).slice(0, 5);
  const hasLogos = providerLogos.length > 0;
  const extraCount = (content.watchProviderLogos?.length || 0) - 5;
  
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-4 p-4 bg-card rounded-lg border border-border transition-all duration-200 hover:bg-accent/5 hover:border-accent/50 active:scale-[0.98]"
    >
      <div className="relative flex-shrink-0">
        <Avatar className="h-14 w-14 rounded-lg">
          {content.posterUrl && (
            <AvatarImage 
              src={posterSrc} 
              alt={safeTitle}
              className="object-cover"
            />
          )}
          <AvatarFallback className="rounded-lg bg-muted">
            <Icon className="h-7 w-7 text-muted-foreground" />
          </AvatarFallback>
        </Avatar>
        {contentNotif && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="absolute -top-1.5 -right-1.5 bg-accent text-accent-foreground rounded-full p-0.5 shadow-md animate-pulse">
                  <Bell className="h-3 w-3" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[200px] text-xs">
                <p>{formatRelativeDate(contentNotif.message || contentNotif.title)}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-heading font-bold text-foreground line-clamp-1">
            {safeTitle}
          </h3>
          <DrawerPickerPopover content={content}>
            <button 
              className="p-1 -m-1 hover:bg-accent/10 rounded transition-colors"
              onClick={(e) => e.stopPropagation()}
              aria-label={isInAnyDrawer ? `${safeTitle} está em uma gavetta — alterar` : `Adicionar ${safeTitle} a uma gavetta`}
            >
              <GavetaIcon className={cn(
                "h-4 w-4 flex-shrink-0 transition-opacity",
                isInAnyDrawer ? "opacity-100" : "opacity-40"
              )} />
            </button>
          </DrawerPickerPopover>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <Badge variant="secondary" className="text-xs">
            {typeLabels[content.type] || 'Filme'}
          </Badge>
          {StatusIcon && (
            <StatusIcon className={cn("h-3.5 w-3.5", content.status && statusColors[content.status])} />
          )}
          {content.rating && (
            <div className="flex items-center gap-1 text-accent">
              <Star className="h-3 w-3 fill-accent" />
              <span className="text-xs font-semibold">{content.rating.toFixed(1)}</span>
            </div>
          )}
          {isSeries && watchedEpCount > 0 && (() => {
            const isComplete = totalEpCount > 0 && watchedEpCount >= totalEpCount;
            const Icon = isComplete ? Check : Play;
            return (
              <Badge
                variant="outline"
                className={cn(
                  "gap-1 text-xs",
                  isComplete
                    ? "border-primary/30 text-primary"
                    : "border-accent/40 text-accent"
                )}
              >
                <Icon className="h-3 w-3" />
                {watchedEpCount}{totalEpCount > 0 ? `/${totalEpCount}` : ''} eps
              </Badge>
            );
          })()}
        </div>
        
        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
          {safeGenres.join(" • ")}
        </p>

        {/* Plataformas de streaming com logos */}
        {(hasLogos || content.isInTheaters || (content.availableOn && content.availableOn.length > 0)) && (
          <div className="flex items-center gap-1.5 mt-1.5">
            {content.isInTheaters && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-sm bg-accent/15 text-accent flex-shrink-0"
                      aria-label="Nos cinemas"
                    >
                      <Clapperboard className="h-3 w-3" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    <p>Em exibição nos cinemas</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {hasLogos ? (
              <>
                {providerLogos.map((provider, i) => {
                  const offers = ((provider as any).offerTypes ?? []) as string[];
                  const hasFlat = offers.includes('flatrate') || offers.includes('free') || offers.includes('ads');
                  const isPaidOnly = offers.length > 0 && !hasFlat;
                  const name = String((provider as any).name || (provider as any).provider_name || 'Streaming');
                  const titleSuffix = isPaidOnly
                    ? ' · Aluguel/Compra'
                    : offers.includes('flatrate')
                      ? ' · Incluso na assinatura'
                      : '';
                  return (
                    <span key={i} className="relative flex-shrink-0">
                      <img
                        src={getTMDBImageUrl((provider as any).logoPath || (provider as any).logo_path, 'w200')}
                        alt={name}
                        title={`${name}${titleSuffix}`}
                        className={cn(
                          "h-5 w-5 rounded-sm object-cover",
                          isPaidOnly && "opacity-80"
                        )}
                        loading="lazy"
                      />
                      {isPaidOnly && (
                        <span
                          className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-accent text-accent-foreground text-[8px] font-bold leading-3 text-center ring-1 ring-background"
                          aria-label="Apenas aluguel ou compra"
                        >
                          $
                        </span>
                      )}
                    </span>
                  );
                })}
                {extraCount > 0 && (
                  <span className="text-[10px] text-muted-foreground ml-0.5">+{extraCount}</span>
                )}
              </>
            ) : content.availableOn && content.availableOn.length > 0 ? (
              <span className="text-xs text-muted-foreground line-clamp-1">
                {content.availableOn.slice(0, 3).join(" • ")}
                {content.availableOn.length > 3 && ` +${content.availableOn.length - 3}`}
              </span>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

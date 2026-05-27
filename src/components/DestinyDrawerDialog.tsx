import { useState, useEffect, useCallback } from "react";
import { Sparkles, Loader2, RefreshCw, Plus, Star, Film, Tv } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GavetaIcon } from "@/components/GavetaIcon";
import { useDrawers } from "@/contexts/DrawerContext";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { pickDestinyContent, buildDestinyMessage, DestinyPick } from "@/lib/destinyDrawer";
import { ContentDetailDialog } from "@/components/ContentDetailDialog";
import type { Content } from "@/lib/mockData";

interface DestinyDrawerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MIN_RATINGS = 3;

export function DestinyDrawerDialog({ open, onOpenChange }: DestinyDrawerDialogProps) {
  const { user } = useAuth();
  const { assignments, setDefaultDrawer, getContentDrawers } = useDrawers();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [pick, setPick] = useState<DestinyPick | null>(null);
  const [shownIds, setShownIds] = useState<Set<string>>(new Set());
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailContent, setDetailContent] = useState<Content | null>(null);
  const [empty, setEmpty] = useState(false);
  const [noMore, setNoMore] = useState(false);
  const [addingToWatchlist, setAddingToWatchlist] = useState(false);

  const ratedCount = assignments.filter(a => a.rating != null && a.rating >= 7).length;

  const reveal = useCallback(async (excludeCurrent: boolean) => {
    setLoading(true);
    setNoMore(false);
    try {
      const nextShown = new Set(shownIds);
      if (excludeCurrent && pick) nextShown.add(pick.content.id);

      const result = await pickDestinyContent(assignments, nextShown);
      if (!result) {
        setNoMore(true);
        setPick(null);
      } else {
        setPick(result);
        setShownIds(new Set([...nextShown, result.content.id]));
      }
    } catch (e) {
      console.error('[DestinyDrawer] erro:', e);
      toast({ title: 'Erro ao revelar', description: 'Tente novamente em instantes.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [assignments, pick, shownIds]);

  // Inicializa quando o dialog abre
  useEffect(() => {
    if (!open) return;
    // Reset state on open
    setPick(null);
    setShownIds(new Set());
    setNoMore(false);
    setDetailOpen(false);
    setDetailContent(null);

    if (!user) {
      setEmpty(true);
      return;
    }
    if (ratedCount < MIN_RATINGS) {
      setEmpty(true);
      return;
    }
    setEmpty(false);
    reveal(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleAddToWatchlist = async () => {
    if (!pick) return;
    setAddingToWatchlist(true);
    try {
      await setDefaultDrawer(pick.content, 'to-watch');
      toast({ title: 'Adicionado à watchlist', description: pick.content.title });
    } catch (e) {
      toast({ title: 'Erro ao adicionar', variant: 'destructive' });
    } finally {
      setAddingToWatchlist(false);
    }
  };

  const isInWatchlist = pick ? getContentDrawers(pick.content.id).defaultDrawer === 'to-watch' : false;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="z-[60] max-w-md p-0 overflow-hidden border-destiny-gold">
          <DialogTitle className="sr-only">Gaveta do Destino</DialogTitle>

          {/* Header dourado */}
          <div className="bg-gradient-destiny p-5 text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-30">
              <Sparkles className="absolute top-3 left-6 w-3 h-3 text-white animate-gold-shimmer" style={{ animationDelay: '0.2s' }} />
              <Sparkles className="absolute top-8 right-8 w-4 h-4 text-white animate-gold-shimmer" style={{ animationDelay: '0.6s' }} />
              <Sparkles className="absolute bottom-3 left-12 w-3 h-3 text-white animate-gold-shimmer" style={{ animationDelay: '1s' }} />
              <Sparkles className="absolute bottom-6 right-5 w-3 h-3 text-white animate-gold-shimmer" style={{ animationDelay: '0.4s' }} />
            </div>
            <div className="relative">
              <div className="flex items-center justify-center gap-2 mb-1">
                <GavetaIcon className="w-7 h-7 brightness-0 invert" />
                <h2 className="font-heading font-bold text-xl text-white">Gaveta do Destino</h2>
              </div>
              <p className="text-xs text-white/85">Uma escolha feita especialmente pra você</p>
            </div>
          </div>

          <div className="p-5 min-h-[280px] flex flex-col">
            {/* Estado: vazio (poucas avaliações) */}
            {empty && (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-8 gap-3">
                <Sparkles className="w-10 h-10 text-destiny-gold animate-gold-shimmer" />
                <p className="text-sm text-foreground font-medium px-4">
                  Avalie pelo menos {MIN_RATINGS} títulos para a Gaveta do Destino te conhecer melhor.
                </p>
                <p className="text-xs text-muted-foreground">
                  Você tem {ratedCount} {ratedCount === 1 ? 'avaliação' : 'avaliações'} com nota 7+.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => { onOpenChange(false); navigate('/'); }}
                >
                  Avaliar títulos
                </Button>
              </div>
            )}

            {/* Estado: carregando */}
            {!empty && loading && (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-8 gap-4">
                <div className="relative">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-destiny shadow-destiny animate-gold-pulse-glow flex items-center justify-center animate-drawer-open">
                    <GavetaIcon className="w-10 h-10 brightness-0 invert" />
                  </div>
                  <Sparkles className="absolute -top-2 -right-2 w-5 h-5 text-destiny-gold animate-gold-shimmer" />
                  <Sparkles className="absolute -bottom-2 -left-2 w-4 h-4 text-destiny-gold animate-gold-shimmer" style={{ animationDelay: '0.8s' }} />
                </div>
                <p className="text-sm text-muted-foreground">Abrindo sua gaveta...</p>
              </div>
            )}

            {/* Estado: sem mais picks */}
            {!empty && !loading && noMore && (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-8 gap-3">
                <p className="text-sm text-foreground">Esgotamos as sugestões por agora.</p>
                <Button variant="outline" size="sm" onClick={() => { setShownIds(new Set()); reveal(false); }}>
                  Recomeçar
                </Button>
              </div>
            )}

            {/* Estado: resultado */}
            {!empty && !loading && !noMore && pick && (
              <div className="flex-1 flex flex-col gap-4 animate-fade-in">
                {/* Card do conteúdo */}
                <button
                  type="button"
                  onClick={() => { setDetailContent(pick.content); setDetailOpen(true); }}
                  className="flex gap-3 text-left hover:opacity-90 transition-opacity"
                >
                  <div className="relative shrink-0 w-24 h-36 rounded-lg overflow-hidden bg-muted border border-destiny-gold shadow-destiny">
                    {pick.content.posterUrl ? (
                      <img src={pick.content.posterUrl} alt={pick.content.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        {pick.content.type === 'movie' ? <Film className="w-8 h-8" /> : <Tv className="w-8 h-8" />}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1 text-xs text-muted-foreground">
                      {pick.content.type === 'movie' ? <Film className="w-3 h-3" /> : <Tv className="w-3 h-3" />}
                      <span>{pick.content.type === 'movie' ? 'Filme' : 'Série'}</span>
                      {pick.content.releaseDate && <span>· {pick.content.releaseDate.slice(0, 4)}</span>}
                    </div>
                    <h3 className="font-heading font-bold text-base text-foreground line-clamp-2 mb-1.5">
                      {pick.content.title}
                    </h3>
                    {typeof pick.content.rating === 'number' && pick.content.rating > 0 && (
                      <div className="flex items-center gap-1 text-xs text-foreground mb-1.5">
                        <Star className="w-3.5 h-3.5 fill-destiny-gold text-destiny-gold" />
                        <span className="font-semibold">{pick.content.rating.toFixed(1)}</span>
                        <span className="text-muted-foreground">TMDB</span>
                      </div>
                    )}
                    {pick.content.genres && pick.content.genres.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-1.5">
                        {pick.content.genres.slice(0, 2).map(g => (
                          <Badge key={g} variant="secondary" className="text-[10px] px-1.5 py-0">{g}</Badge>
                        ))}
                      </div>
                    )}
                    {pick.content.watchProviderLogos && pick.content.watchProviderLogos.length > 0 && (
                      <div className="flex items-center gap-1 mt-1">
                        {pick.content.watchProviderLogos.slice(0, 4).map(p => (
                          <img
                            key={p.name}
                            src={`https://image.tmdb.org/t/p/w92${p.logoPath}`}
                            alt={p.name}
                            title={p.name}
                            className="w-5 h-5 rounded object-cover"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </button>

                {/* Mensagem personalizada */}
                <p className="text-sm text-center text-muted-foreground italic px-2">
                  ✨ {buildDestinyMessage(pick.topGenres)}
                </p>

                {/* Ações */}
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => reveal(true)}
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    Revelar outro
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 bg-gradient-destiny text-white border-0 hover:opacity-90 shadow-destiny"
                    onClick={handleAddToWatchlist}
                    disabled={addingToWatchlist || isInWatchlist}
                  >
                    {addingToWatchlist ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Plus className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    {isInWatchlist ? 'Na watchlist' : 'À watchlist'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {detailContent && (
        <ContentDetailDialog
          content={detailContent}
          open={detailOpen}
          onOpenChange={setDetailOpen}
          onContentChange={setDetailContent}
        />
      )}
    </>
  );
}

import { useState, useEffect, useCallback } from "react";
import { Sparkles, Loader2, RefreshCw, Plus, Star, Film, Tv, Wand2, SlidersHorizontal, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GavetaIcon } from "@/components/GavetaIcon";
import { DrawerPickerPopover } from "@/components/DrawerPickerPopover";
import { useDrawers } from "@/contexts/DrawerContext";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { pickDestinyContent, buildDestinyMessage, DestinyPick, DestinyFilters } from "@/lib/destinyDrawer";
import { ContentDetailDialog } from "@/components/ContentDetailDialog";
import { MOVIE_GENRES, TV_GENRES, BR_STREAMING_PROVIDERS } from "@/lib/tmdb";
import type { Content } from "@/lib/mockData";

interface DestinyDrawerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MIN_RATINGS = 10;
const MIN_LOADING_MS = 2200; // delay artificial para parecer "pensando"

// Lista única de gêneros (movies + tv, sem duplicatas por nome)
const ALL_GENRES = (() => {
  const seen = new Set<string>();
  const out: { name: string }[] = [];
  [...MOVIE_GENRES, ...TV_GENRES].forEach(g => {
    if (!seen.has(g.name)) {
      seen.add(g.name);
      out.push({ name: g.name });
    }
  });
  return out.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
})();

export function DestinyDrawerDialog({ open, onOpenChange }: DestinyDrawerDialogProps) {
  const { user } = useAuth();
  const { assignments } = useDrawers();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [pick, setPick] = useState<DestinyPick | null>(null);
  const [shownIds, setShownIds] = useState<Set<string>>(new Set());
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailContent, setDetailContent] = useState<Content | null>(null);
  const [empty, setEmpty] = useState(false);
  const [noMore, setNoMore] = useState(false);

  // Filtros
  const [showFilters, setShowFilters] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'movie' | 'series'>('all');
  const [filterGenre, setFilterGenre] = useState<string>('all');
  const [filterProvider, setFilterProvider] = useState<string>('all');

  const ratedCount = assignments.filter(a => a.rating != null && a.rating >= 7).length;

  const reveal = useCallback(async (excludeCurrent: boolean) => {
    setLoading(true);
    setNoMore(false);
    const startedAt = Date.now();
    try {
      const nextShown = new Set(shownIds);
      if (excludeCurrent && pick) nextShown.add(pick.content.id);

      const filters: DestinyFilters = {
        type: filterType,
        genreName: filterGenre !== 'all' ? filterGenre : null,
        watchProviderId: filterProvider !== 'all' ? parseInt(filterProvider) : null,
      };

      const result = await pickDestinyContent(assignments, nextShown, filters);

      // Garante delay mínimo para sensação de "buscando"
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_LOADING_MS) {
        await new Promise(r => setTimeout(r, MIN_LOADING_MS - elapsed));
      }

      if (!result) {
        setNoMore(true);
        setPick(null);
      } else {
        setPick(result);
        setShownIds(new Set([...nextShown, result.content.id]));
      }
    } catch (e) {
      console.error('[GavettaMagica] erro:', e);
      toast({ title: 'Erro ao revelar', description: 'Tente novamente em instantes.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [assignments, pick, shownIds, filterType, filterGenre, filterProvider]);

  // Inicializa quando o dialog abre
  useEffect(() => {
    if (!open) return;
    setPick(null);
    setShownIds(new Set());
    setNoMore(false);
    setDetailOpen(false);
    setDetailContent(null);
    setShowFilters(false);
    setFilterType('all');
    setFilterGenre('all');
    setFilterProvider('all');

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

  const hasActiveFilters = filterType !== 'all' || filterGenre !== 'all' || filterProvider !== 'all';

  const clearFilters = () => {
    setFilterType('all');
    setFilterGenre('all');
    setFilterProvider('all');
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="z-[60] max-w-md p-0 overflow-hidden border-destiny-gold max-h-[90vh] overflow-y-auto">
          <DialogTitle className="sr-only">Gavetta Mágica</DialogTitle>

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
                <Wand2 className="w-6 h-6 text-white" />
                <h2 className="font-heading font-bold text-xl text-white">Gavetta Mágica</h2>
              </div>
              <p className="text-xs text-white/85">Uma escolha feita especialmente pra você</p>
            </div>
          </div>

          <div className="p-5 min-h-[280px] flex flex-col">
            {/* Filtros — visível quando não vazio/loading */}
            {!empty && (
              <div className="mb-4">
                <button
                  type="button"
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  Filtros
                  {hasActiveFilters && (
                    <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">
                      ativo
                    </Badge>
                  )}
                </button>

                {showFilters && (
                  <div className="mt-3 grid grid-cols-1 gap-2 animate-fade-in">
                    <Select value={filterType} onValueChange={(v) => setFilterType(v as 'all' | 'movie' | 'series')}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
                      <SelectContent className="z-[70]">
                        <SelectItem value="all">Filmes e séries</SelectItem>
                        <SelectItem value="movie">Apenas filmes</SelectItem>
                        <SelectItem value="series">Apenas séries</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={filterProvider} onValueChange={setFilterProvider}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Disponível em" /></SelectTrigger>
                      <SelectContent className="z-[70]">
                        <SelectItem value="all">Qualquer streaming</SelectItem>
                        {BR_STREAMING_PROVIDERS.map(p => (
                          <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={filterGenre} onValueChange={setFilterGenre}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Gênero" /></SelectTrigger>
                      <SelectContent className="z-[70] max-h-72">
                        <SelectItem value="all">Baseado no meu gosto</SelectItem>
                        {ALL_GENRES.map(g => (
                          <SelectItem key={g.name} value={g.name}>{g.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="flex gap-2 mt-1">
                      {hasActiveFilters && (
                        <Button variant="ghost" size="sm" className="flex-1 h-8 text-xs" onClick={clearFilters}>
                          <X className="w-3 h-3 mr-1" /> Limpar
                        </Button>
                      )}
                      <Button
                        size="sm"
                        className="flex-1 h-8 text-xs bg-gradient-destiny text-white border-0 hover:opacity-90"
                        onClick={() => { setShownIds(new Set()); reveal(false); }}
                        disabled={loading}
                      >
                        Aplicar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Estado: vazio (poucas avaliações) */}
            {empty && (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-8 gap-3">
                <Sparkles className="w-10 h-10 text-destiny-gold animate-gold-shimmer" />
                <p className="text-sm text-foreground font-medium px-4">
                  Avalie pelo menos {MIN_RATINGS} títulos para a Gavetta Mágica te conhecer melhor.
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
              <div className="flex-1 flex flex-col items-center justify-center text-center py-10 gap-4">
                <div className="relative">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-destiny shadow-destiny animate-gold-pulse-glow flex items-center justify-center animate-drawer-open">
                    <GavetaIcon className="w-10 h-10 brightness-0 invert" />
                  </div>
                  <Sparkles className="absolute -top-2 -right-2 w-5 h-5 text-destiny-gold animate-gold-shimmer" />
                  <Sparkles className="absolute -bottom-2 -left-2 w-4 h-4 text-destiny-gold animate-gold-shimmer" style={{ animationDelay: '0.8s' }} />
                  <Sparkles className="absolute top-1/2 -right-4 w-3 h-3 text-destiny-gold animate-gold-shimmer" style={{ animationDelay: '1.2s' }} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-foreground font-medium">Consultando suas gavetas...</p>
                  <p className="text-xs text-muted-foreground">Analisando o seu gosto</p>
                </div>
              </div>
            )}

            {/* Estado: sem mais picks */}
            {!empty && !loading && noMore && (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-8 gap-3">
                <p className="text-sm text-foreground">
                  {hasActiveFilters
                    ? 'Nenhum título encontrado com esses filtros.'
                    : 'Esgotamos as sugestões por agora.'}
                </p>
                <Button variant="outline" size="sm" onClick={() => { setShownIds(new Set()); reveal(false); }}>
                  Tentar de novo
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
                  <DrawerPickerPopover content={pick.content}>
                    <Button
                      size="sm"
                      className="flex-1 bg-gradient-destiny text-white border-0 hover:opacity-90 shadow-destiny"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1.5" />
                      Adicionar à gavetta
                    </Button>
                  </DrawerPickerPopover>
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

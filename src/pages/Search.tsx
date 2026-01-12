import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search as SearchIcon, Film, Tv, Loader2, X } from "lucide-react";
import { ContentCard } from "@/components/ContentCard";
import { ContentDetailDialog } from "@/components/ContentDetailDialog";
import { Content } from "@/lib/mockData";
import { 
  searchAll, 
  getTMDBImageUrl, 
  TMDBMovie, 
  TMDBTVShow,
  getMovieWatchProviders,
  getTVWatchProviders,
  extractStreamingNames,
  getMovieDetails,
  getTVDetails,
  getMovieCredits,
  getTVCredits,
  discoverMovies,
  discoverTVShows,
  MOVIE_GENRES
} from "@/lib/tmdb";

type FilterType = 'all' | 'movies' | 'series' | 'genre';

interface ActiveFilter {
  type: FilterType;
  genreId?: number;
  genreName?: string;
}

// Converter resultado TMDB Movie para o formato Content (com popularity para ordenação)
function tmdbMovieToContent(movie: TMDBMovie): Content & { popularity: number } {
  return {
    id: `movie-${movie.id}`,
    title: movie.title,
    type: 'movie',
    posterUrl: getTMDBImageUrl(movie.poster_path),
    backdropUrl: movie.backdrop_path ? getTMDBImageUrl(movie.backdrop_path, 'original') : undefined,
    rating: movie.vote_average,
    releaseDate: movie.release_date || '',
    genres: [],
    synopsis: movie.overview,
    isInDrawer: false,
    popularity: movie.popularity,
  };
}

// Converter resultado TMDB TV Show para o formato Content (com popularity para ordenação)
function tmdbTVToContent(tvShow: TMDBTVShow): Content & { popularity: number } {
  return {
    id: `tv-${tvShow.id}`,
    title: tvShow.name,
    type: 'series',
    posterUrl: getTMDBImageUrl(tvShow.poster_path),
    backdropUrl: tvShow.backdrop_path ? getTMDBImageUrl(tvShow.backdrop_path, 'original') : undefined,
    rating: tvShow.vote_average,
    releaseDate: tvShow.first_air_date || '',
    genres: [],
    synopsis: tvShow.overview,
    isInDrawer: false,
    popularity: tvShow.popularity,
  };
}

export default function Search() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<Content[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingProviders, setIsLoadingProviders] = useState(false);
  const [activeFilter, setActiveFilter] = useState<ActiveFilter | null>(null);
  const [showGenres, setShowGenres] = useState(false);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      // Se não há busca mas há filtro ativo, mantém os resultados do filtro
      if (!activeFilter) {
        setSearchResults([]);
      }
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsLoading(true);
      try {
        const { movies, tvShows } = await searchAll(searchQuery);
        let movieResults = movies.map(tmdbMovieToContent);
        let tvResults = tvShows.map(tmdbTVToContent);
        
        // Aplica filtro de tipo se ativo
        if (activeFilter?.type === 'movies') {
          // Ordena por popularidade (maior primeiro)
          setSearchResults(movieResults.sort((a, b) => b.popularity - a.popularity));
        } else if (activeFilter?.type === 'series') {
          // Ordena por popularidade (maior primeiro)
          setSearchResults(tvResults.sort((a, b) => b.popularity - a.popularity));
        } else {
          // Combina e ordena por popularidade (maior primeiro)
          const combined = [...movieResults, ...tvResults].sort((a, b) => b.popularity - a.popularity);
          setSearchResults(combined);
        }
      } catch (error) {
        console.error('Erro ao buscar conteúdo:', error);
        setSearchResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, activeFilter]);

  // Carregar conteúdo quando filtro muda (sem busca)
  useEffect(() => {
    if (searchQuery.trim()) return; // Se há busca, ignora
    
    if (!activeFilter) {
      setSearchResults([]);
      return;
    }

    const loadFilteredContent = async () => {
      setIsLoading(true);
      try {
        if (activeFilter.type === 'movies') {
          const movies = await discoverMovies();
          setSearchResults(movies.map(tmdbMovieToContent));
        } else if (activeFilter.type === 'series') {
          const tvShows = await discoverTVShows();
          setSearchResults(tvShows.map(tmdbTVToContent));
        } else if (activeFilter.type === 'genre' && activeFilter.genreId) {
          const [movies, tvShows] = await Promise.all([
            discoverMovies({ genreId: activeFilter.genreId }),
            discoverTVShows({ genreId: activeFilter.genreId })
          ]);
          const movieResults = movies.map(tmdbMovieToContent);
          const tvResults = tvShows.map(tmdbTVToContent);
          // Intercala filmes e séries para variedade
          const combined: Content[] = [];
          const maxLen = Math.max(movieResults.length, tvResults.length);
          for (let i = 0; i < maxLen; i++) {
            if (movieResults[i]) combined.push(movieResults[i]);
            if (tvResults[i]) combined.push(tvResults[i]);
          }
          setSearchResults(combined);
        }
      } catch (error) {
        console.error('Erro ao carregar conteúdo filtrado:', error);
        setSearchResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadFilteredContent();
  }, [activeFilter, searchQuery]);

  const handleFilterClick = (type: FilterType, genreId?: number, genreName?: string) => {
    if (type === 'genre' && !genreId) {
      // Toggle mostrar gêneros
      setShowGenres(!showGenres);
      return;
    }
    
    // Se clicar no mesmo filtro, desativa
    if (activeFilter?.type === type && 
        (type !== 'genre' || activeFilter.genreId === genreId)) {
      setActiveFilter(null);
      setShowGenres(false);
    } else {
      setActiveFilter({ type, genreId, genreName });
      if (type === 'genre') {
        setShowGenres(false);
      }
    }
  };

  const clearFilter = () => {
    setActiveFilter(null);
    setShowGenres(false);
  };

  const handleCardClick = async (content: Content) => {
    // Buscar detalhes completos, créditos e watch providers
    setIsLoadingProviders(true);
    setSelectedContent(content);
    setIsDialogOpen(true);

    try {
      const tmdbId = parseInt(content.id.split('-')[1]);
      
      if (content.type === 'movie') {
        const [details, credits, providers] = await Promise.all([
          getMovieDetails(tmdbId),
          getMovieCredits(tmdbId),
          getMovieWatchProviders(tmdbId)
        ]);
        
        const director = credits.crew.find(c => c.job === 'Director');
        const streamingNames = extractStreamingNames(providers);
        
        setSelectedContent({
          ...content,
          genres: details.genres.map(g => g.name),
          director: director?.name,
          cast: credits.cast.slice(0, 10).map(c => c.name),
          availableOn: streamingNames.length > 0 ? streamingNames : undefined
        });
      } else {
        const [details, credits, providers] = await Promise.all([
          getTVDetails(tmdbId),
          getTVCredits(tmdbId),
          getTVWatchProviders(tmdbId)
        ]);
        
        const streamingNames = extractStreamingNames(providers);
        
        setSelectedContent({
          ...content,
          genres: details.genres.map(g => g.name),
          director: details.created_by?.[0]?.name,
          cast: credits.cast.slice(0, 10).map(c => c.name),
          availableOn: streamingNames.length > 0 ? streamingNames : undefined
        });
      }
    } catch (error) {
      console.error('Erro ao buscar detalhes:', error);
    } finally {
      setIsLoadingProviders(false);
    }
  };

  const handleContentChange = (newContent: Content) => {
    setSelectedContent(newContent);
    setIsDialogOpen(true);
  };

  const isFilterActive = (type: FilterType, genreId?: number) => {
    if (!activeFilter) return false;
    if (type === 'genre') {
      return activeFilter.type === 'genre' && activeFilter.genreId === genreId;
    }
    return activeFilter.type === type;
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      
      <main className="container mx-auto px-4 py-6 max-w-lg">
        <h2 className="font-heading text-3xl font-bold text-foreground mb-6">
          Buscar
        </h2>

        {/* Campo de Busca */}
        <div className="relative mb-6">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar filmes e séries..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Filtro ativo */}
        {activeFilter && (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm text-muted-foreground">Filtrando por:</span>
            <Badge 
              variant="default"
              className="px-3 py-1 cursor-pointer flex items-center gap-1"
              onClick={clearFilter}
            >
              {activeFilter.type === 'movies' && 'Filmes'}
              {activeFilter.type === 'series' && 'Séries'}
              {activeFilter.type === 'genre' && activeFilter.genreName}
              <X className="h-3 w-3" />
            </Badge>
          </div>
        )}

        {/* Navegação Rápida - esconde quando há busca ativa */}
        {!searchQuery.trim() && (
          <div className="mb-6">
            <h3 className="font-heading text-lg font-semibold text-foreground mb-4">
              Navegação Rápida
            </h3>
            <div className="flex flex-wrap gap-2">
              <Badge
                variant={isFilterActive('movies') ? 'default' : 'outline'}
                className="px-4 py-2 cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                onClick={() => handleFilterClick('movies')}
              >
                <Film className="h-4 w-4 mr-2" />
                Filmes
              </Badge>
              <Badge
                variant={isFilterActive('series') ? 'default' : 'outline'}
                className="px-4 py-2 cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                onClick={() => handleFilterClick('series')}
              >
                <Tv className="h-4 w-4 mr-2" />
                Séries
              </Badge>
            </div>
            
            {/* Gêneros expandidos */}
            <div className="mt-4">
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Gêneros</h4>
              <div className="flex flex-wrap gap-2">
                {MOVIE_GENRES.map((genre) => (
                  <Badge
                    key={genre.id}
                    variant={isFilterActive('genre', genre.id) ? 'default' : 'outline'}
                    className="px-3 py-1.5 cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors text-xs"
                    onClick={() => handleFilterClick('genre', genre.id, genre.name)}
                  >
                    {genre.name}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* Resultados */}
        {!isLoading && searchResults.length > 0 && (
          <div>
            <h3 className="font-heading text-lg font-semibold text-foreground mb-4">
              {searchQuery ? `Resultados (${searchResults.length})` : `Populares (${searchResults.length})`}
            </h3>
            <div className="space-y-3">
              {searchResults.map((content) => (
                <ContentCard
                  key={content.id}
                  content={content}
                  onClick={() => handleCardClick(content)}
                />
              ))}
            </div>
          </div>
        )}

        {!isLoading && searchResults.length === 0 && (searchQuery || activeFilter) && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Nenhum resultado encontrado</p>
          </div>
        )}
      </main>

      <BottomNav />
      
      {selectedContent && (
        <ContentDetailDialog
          content={selectedContent}
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          onContentChange={handleContentChange}
        />
      )}
    </div>
  );
}

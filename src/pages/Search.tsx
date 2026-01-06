import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search as SearchIcon, Film, Tv, Globe, Palette, Radio, Loader2 } from "lucide-react";
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
  getTVCredits
} from "@/lib/tmdb";

const clusters = [
  { id: "movies", label: "Filmes", icon: Film },
  { id: "series", label: "Séries", icon: Tv },
  { id: "genres", label: "Gêneros", icon: Palette },
  { id: "countries", label: "Países", icon: Globe },
  { id: "streaming", label: "Streamings", icon: Radio },
];

// Converter resultado TMDB Movie para o formato Content
function tmdbMovieToContent(movie: TMDBMovie): Content {
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
  };
}

// Converter resultado TMDB TV Show para o formato Content
function tmdbTVToContent(tvShow: TMDBTVShow): Content {
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
  };
}

export default function Search() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<Content[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingProviders, setIsLoadingProviders] = useState(false);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsLoading(true);
      try {
        const { movies, tvShows } = await searchAll(searchQuery);
        const movieResults = movies.map(tmdbMovieToContent);
        const tvResults = tvShows.map(tmdbTVToContent);
        setSearchResults([...movieResults, ...tvResults]);
      } catch (error) {
        console.error('Erro ao buscar conteúdo:', error);
        setSearchResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

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

        {/* Clusters */}
        {!searchQuery && (
          <div className="mb-8">
            <h3 className="font-heading text-lg font-semibold text-foreground mb-4">
              Navegação Rápida
            </h3>
            <div className="flex flex-wrap gap-2">
              {clusters.map((cluster) => {
                const Icon = cluster.icon;
                return (
                  <Badge
                    key={cluster.id}
                    variant="outline"
                    className="px-4 py-2 cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {cluster.label}
                  </Badge>
                );
              })}
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
        {searchQuery && !isLoading && searchResults.length > 0 && (
          <div>
            <h3 className="font-heading text-lg font-semibold text-foreground mb-4">
              Resultados ({searchResults.length})
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

        {searchQuery && !isLoading && searchResults.length === 0 && (
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

import { useState, useEffect, useRef, useCallback } from "react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search as SearchIcon, Film, Tv, Loader2, X, User } from "lucide-react";
import { ContentCard } from "@/components/ContentCard";
import { ContentDetailDialog } from "@/components/ContentDetailDialog";
import { Content } from "@/lib/mockData";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { 
  searchAll, 
  getTMDBImageUrl, 
  getTMDBProfileUrl,
  TMDBMovie, 
  TMDBTVShow,
  TMDBPersonCredit,
  getMovieWatchProviders,
  getTVWatchProviders,
  extractStreamingNames,
  getMovieDetails,
  getTVDetails,
  getMovieCredits,
  getTVCredits,
  discoverMovies,
  discoverTVShows,
  MOVIE_GENRES,
  searchPerson,
  getPersonCredits,
  mapGenreIdsToNames,
} from "@/lib/tmdb";

type FilterType = 'all' | 'movies' | 'series' | 'genre';
type SearchMode = 'title' | 'person';

interface ActiveFilter {
  type: FilterType;
  genreId?: number;
  genreName?: string;
}

interface PersonResult {
  id: number;
  name: string;
  profile_path: string | null;
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
    genres: mapGenreIdsToNames(movie.genre_ids || []),
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
    genres: mapGenreIdsToNames(tvShow.genre_ids || []),
    synopsis: tvShow.overview,
    isInDrawer: false,
    popularity: tvShow.popularity,
  };
}

// Converter crédito de pessoa para Content
function personCreditToContent(credit: TMDBPersonCredit): Content & { popularity: number } {
  return {
    id: `${credit.media_type === 'movie' ? 'movie' : 'tv'}-${credit.id}`,
    title: credit.title || credit.name || '',
    type: credit.media_type === 'movie' ? 'movie' : 'series',
    posterUrl: getTMDBImageUrl(credit.poster_path),
    backdropUrl: credit.backdrop_path ? getTMDBImageUrl(credit.backdrop_path, 'original') : undefined,
    rating: credit.vote_average,
    releaseDate: credit.release_date || credit.first_air_date || '',
    genres: mapGenreIdsToNames(credit.genre_ids || []),
    synopsis: credit.overview || '',
    isInDrawer: false,
    popularity: credit.popularity ?? 0,
  };
}

export default function Search() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>('title');
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<Content[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingProviders, setIsLoadingProviders] = useState(false);
  const [activeFilter, setActiveFilter] = useState<ActiveFilter | null>(null);
  const [showGenres, setShowGenres] = useState(false);

  // Person search state
  const [personMatches, setPersonMatches] = useState<PersonResult[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<PersonResult | null>(null);
  const [showPersonPicker, setShowPersonPicker] = useState(false);

  // Reset person state when mode changes
  useEffect(() => {
    setPersonMatches([]);
    setSelectedPerson(null);
    setShowPersonPicker(false);
    setSearchResults([]);
    setSearchQuery("");
    setActiveFilter(null);
  }, [searchMode]);

  // Debounced search — title mode
  useEffect(() => {
    if (searchMode !== 'title') return;

    if (!searchQuery.trim()) {
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
        
        if (activeFilter?.type === 'movies') {
          setSearchResults(movieResults.sort((a, b) => b.popularity - a.popularity));
        } else if (activeFilter?.type === 'series') {
          setSearchResults(tvResults.sort((a, b) => b.popularity - a.popularity));
        } else {
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
  }, [searchQuery, activeFilter, searchMode]);

  // Debounced search — person mode
  useEffect(() => {
    if (searchMode !== 'person') return;

    if (!searchQuery.trim()) {
      setPersonMatches([]);
      setSelectedPerson(null);
      setShowPersonPicker(false);
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsLoading(true);
      setSelectedPerson(null);
      setSearchResults([]);
      try {
        const people = await searchPerson(searchQuery);
        setPersonMatches(people);
        
        if (people.length === 1) {
          // Auto-select if single result
          await selectPerson(people[0]);
        } else if (people.length > 1) {
          setShowPersonPicker(true);
          setIsLoading(false);
        } else {
          setShowPersonPicker(false);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Erro ao buscar pessoa:', error);
        setPersonMatches([]);
        setIsLoading(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, searchMode]);

  const selectPerson = async (person: PersonResult) => {
    setSelectedPerson(person);
    setShowPersonPicker(false);
    setIsLoading(true);
    try {
      const credits = await getPersonCredits(person.id);
      const filtered = credits
        .filter(c => c.poster_path)
        .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
      
      // Dedupe by id+media_type
      const seen = new Set<string>();
      const deduped = filtered.filter(c => {
        const key = `${c.media_type}-${c.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setSearchResults(deduped.map(personCreditToContent));
    } catch (error) {
      console.error('Erro ao buscar créditos:', error);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Carregar conteúdo quando filtro muda (sem busca) — title mode only
  useEffect(() => {
    if (searchMode !== 'title') return;
    if (searchQuery.trim()) return;
    
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
  }, [activeFilter, searchQuery, searchMode]);

  // Enriquecer resultados com streaming providers em lotes
  const enrichmentRef = useRef(0);
  const lastEnrichedKey = useRef('');
  useEffect(() => {
    if (searchResults.length === 0) return;
    const key = searchResults.map(r => r.id).join(',');
    if (searchResults.every(r => r.availableOn !== undefined)) return;
    if (lastEnrichedKey.current === key) return;
    lastEnrichedKey.current = key;

    const batchId = ++enrichmentRef.current;
    const enrichResults = async () => {
      const batchSize = 5;
      const updated = [...searchResults];
      
      for (let i = 0; i < updated.length; i += batchSize) {
        if (enrichmentRef.current !== batchId) return;
        const batch = updated.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (item, idx) => {
          if (item.availableOn !== undefined) return;
          try {
            const tmdbId = parseInt(item.id.split('-')[1]);
            const providers = item.type === 'movie'
              ? await getMovieWatchProviders(tmdbId)
              : await getTVWatchProviders(tmdbId);
            updated[i + idx] = { ...updated[i + idx], availableOn: extractStreamingNames(providers) };
          } catch { /* skip */ }
        }));
        
        if (enrichmentRef.current !== batchId) return;
        setSearchResults([...updated]);
      }
    };

    enrichResults();
  }, [searchResults]);

  const handleFilterClick = (type: FilterType, genreId?: number, genreName?: string) => {
    if (type === 'genre' && !genreId) {
      setShowGenres(!showGenres);
      return;
    }
    
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

        {/* Toggle: Título / Pessoa */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setSearchMode('title')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              searchMode === 'title'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent/10'
            }`}
          >
            <Film className="h-4 w-4 inline mr-2" />
            Título
          </button>
          <button
            onClick={() => setSearchMode('person')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              searchMode === 'person'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent/10'
            }`}
          >
            <User className="h-4 w-4 inline mr-2" />
            Pessoa
          </button>
        </div>

        {/* Campo de Busca */}
        <div className="relative mb-6">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchMode === 'title' ? "Buscar filmes e séries..." : "Buscar ator ou diretor..."}
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Person picker — multiple matches */}
        {searchMode === 'person' && showPersonPicker && personMatches.length > 1 && (
          <div className="mb-6 space-y-2">
            <p className="text-sm text-muted-foreground">Selecione a pessoa:</p>
            {personMatches.map((person) => (
              <button
                key={person.id}
                onClick={() => selectPerson(person)}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent/5 transition-colors text-left"
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={getTMDBProfileUrl(person.profile_path)} alt={person.name} />
                  <AvatarFallback><User className="h-5 w-5" /></AvatarFallback>
                </Avatar>
                <span className="font-medium text-foreground">{person.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Person header — selected person */}
        {searchMode === 'person' && selectedPerson && (
          <div className="flex items-center gap-4 mb-6 p-4 rounded-lg bg-card border border-border">
            <Avatar className="h-16 w-16 rounded-lg">
              <AvatarImage 
                src={getTMDBProfileUrl(selectedPerson.profile_path)} 
                alt={selectedPerson.name}
                className="object-cover"
              />
              <AvatarFallback className="rounded-lg"><User className="h-8 w-8" /></AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm text-muted-foreground">Filmes e séries com</p>
              <h3 className="font-heading text-xl font-bold text-foreground">{selectedPerson.name}</h3>
            </div>
          </div>
        )}

        {/* Filtro ativo — title mode only */}
        {searchMode === 'title' && activeFilter && (
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

        {/* Navegação Rápida — title mode only */}
        {searchMode === 'title' && (
          <div 
            className={`mb-6 transition-all duration-300 ease-out overflow-hidden ${
              searchQuery.trim() 
                ? 'opacity-0 max-h-0 mb-0' 
                : 'opacity-100 max-h-[500px]'
            }`}
          >
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
              {searchMode === 'person' && selectedPerson
                ? `Resultados (${searchResults.length})`
                : searchQuery 
                  ? `Resultados (${searchResults.length})` 
                  : `Populares (${searchResults.length})`
              }
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

        {!isLoading && searchResults.length === 0 && !showPersonPicker && (searchQuery || activeFilter) && (
          searchMode === 'person' && personMatches.length === 0 && searchQuery.trim() ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Nenhuma pessoa encontrada</p>
            </div>
          ) : searchMode === 'title' ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Nenhum resultado encontrado</p>
            </div>
          ) : null
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

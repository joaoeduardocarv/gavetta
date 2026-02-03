import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContentDetailDialog } from "@/components/ContentDetailDialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Film, Tv, Newspaper, ExternalLink, Loader2, Star, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Content } from "@/lib/mockData";
import { supabase } from "@/integrations/supabase/client";
import { getTrendingMovies, getTrendingTV, getTMDBImageUrl, TMDBMovie, TMDBTVShow } from "@/lib/tmdb";
import { useDrawers } from "@/contexts/DrawerContext";
import { DrawerPickerPopover } from "@/components/DrawerPickerPopover";

interface NewsItem {
  id: string;
  title: string;
  description: string;
  published: string;
  url: string;
  image: string | null;
  author: string;
}

function TrendingContentCard({ 
  item, 
  type, 
  onClick 
}: { 
  item: TMDBMovie | TMDBTVShow; 
  type: 'movie' | 'series';
  onClick: () => void;
}) {
  const { getContentDrawers } = useDrawers();
  
  const title = type === 'movie' ? (item as TMDBMovie).title : (item as TMDBTVShow).name;
  const releaseDate = type === 'movie' 
    ? (item as TMDBMovie).release_date 
    : (item as TMDBTVShow).first_air_date;
  const year = releaseDate ? new Date(releaseDate).getFullYear() : null;

  // Create Content object for drawer picker
  const content: Content = {
    id: String(item.id),
    type,
    title,
    originalTitle: title,
    releaseDate: releaseDate || '',
    synopsis: item.overview,
    posterUrl: getTMDBImageUrl(item.poster_path, 'w500'),
    backdropUrl: getTMDBImageUrl(item.backdrop_path, 'w500'),
    genres: [],
    rating: item.vote_average,
  };

  const { defaultDrawer, customDrawers } = getContentDrawers(content.id);
  const isInDrawer = defaultDrawer !== null || customDrawers.length > 0;

  return (
    <div 
      className="flex gap-3 p-3 bg-card rounded-lg border cursor-pointer hover:bg-accent/5 transition-colors"
      onClick={onClick}
    >
      <img
        src={getTMDBImageUrl(item.poster_path, 'w200')}
        alt={title}
        className="w-16 h-24 object-cover rounded-md flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-medium text-foreground line-clamp-2">{title}</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
              {year && <span>{year}</span>}
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                {item.vote_average.toFixed(1)}
              </span>
            </div>
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <DrawerPickerPopover content={content}>
              <button 
                className={cn(
                  "p-2 rounded-full transition-colors",
                  isInDrawer 
                    ? "bg-primary/10 text-primary" 
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                <Plus className="h-4 w-4" />
              </button>
            </DrawerPickerPopover>
          </div>
        </div>
        {item.overview && (
          <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
            {item.overview}
          </p>
        )}
      </div>
    </div>
  );
}

export default function Trending() {
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // News state
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoadingNews, setIsLoadingNews] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);
  
  // Trending state
  const [trendingMovies, setTrendingMovies] = useState<TMDBMovie[]>([]);
  const [trendingSeries, setTrendingSeries] = useState<TMDBTVShow[]>([]);
  const [isLoadingMovies, setIsLoadingMovies] = useState(true);
  const [isLoadingSeries, setIsLoadingSeries] = useState(true);
  const [moviesError, setMoviesError] = useState<string | null>(null);
  const [seriesError, setSeriesError] = useState<string | null>(null);

  const fetchTrendingMovies = async () => {
    setIsLoadingMovies(true);
    setMoviesError(null);
    try {
      const movies = await getTrendingMovies('day');
      setTrendingMovies(movies.slice(0, 10));
    } catch (err) {
      console.error('Error fetching trending movies:', err);
      setMoviesError('Erro ao carregar filmes em alta');
    } finally {
      setIsLoadingMovies(false);
    }
  };

  const fetchTrendingSeries = async () => {
    setIsLoadingSeries(true);
    setSeriesError(null);
    try {
      const series = await getTrendingTV('day');
      setTrendingSeries(series.slice(0, 10));
    } catch (err) {
      console.error('Error fetching trending series:', err);
      setSeriesError('Erro ao carregar séries em alta');
    } finally {
      setIsLoadingSeries(false);
    }
  };

  const fetchNews = async () => {
    setIsLoadingNews(true);
    setNewsError(null);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gnews?action=movies&lang=pt&country=br&max=10`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const data = await response.json();

      if (data?.news) {
        setNews(data.news);
      } else if (data?.error) {
        setNewsError(data.error);
      }
    } catch (err) {
      console.error('Error fetching news:', err);
      setNewsError('Erro ao carregar notícias');
    } finally {
      setIsLoadingNews(false);
    }
  };

  useEffect(() => {
    fetchTrendingMovies();
    fetchTrendingSeries();
    fetchNews();
  }, []);

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffHours < 1) return 'Agora';
      if (diffHours < 24) return `Há ${diffHours}h`;
      if (diffDays < 7) return `Há ${diffDays}d`;
      return date.toLocaleDateString('pt-BR');
    } catch {
      return dateString;
    }
  };

  const handleMovieClick = (movie: TMDBMovie) => {
    const content: Content = {
      id: String(movie.id),
      type: 'movie',
      title: movie.title,
      originalTitle: movie.title,
      releaseDate: movie.release_date || '',
      synopsis: movie.overview,
      posterUrl: getTMDBImageUrl(movie.poster_path, 'w500'),
      backdropUrl: getTMDBImageUrl(movie.backdrop_path, 'w500'),
      genres: [],
      rating: movie.vote_average,
    };
    setSelectedContent(content);
    setIsDialogOpen(true);
  };

  const handleSeriesClick = (series: TMDBTVShow) => {
    const content: Content = {
      id: String(series.id),
      type: 'series',
      title: series.name,
      originalTitle: series.name,
      releaseDate: series.first_air_date || '',
      synopsis: series.overview,
      posterUrl: getTMDBImageUrl(series.poster_path, 'w500'),
      backdropUrl: getTMDBImageUrl(series.backdrop_path, 'w500'),
      genres: [],
      rating: series.vote_average,
    };
    setSelectedContent(content);
    setIsDialogOpen(true);
  };

  const handleContentChange = (newContent: Content) => {
    setSelectedContent(newContent);
    setIsDialogOpen(true);
  };

  const handleNewsClick = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      
      <main className="container mx-auto px-4 py-6 max-w-lg">
        <h2 className="font-heading text-3xl font-bold text-foreground mb-6">
          Em Alta
        </h2>

        <Tabs defaultValue="movies" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="movies" className="gap-2">
              <Film className="h-4 w-4" />
              Filmes
            </TabsTrigger>
            <TabsTrigger value="series" className="gap-2">
              <Tv className="h-4 w-4" />
              Séries
            </TabsTrigger>
            <TabsTrigger value="news" className="gap-2">
              <Newspaper className="h-4 w-4" />
              Notícias
            </TabsTrigger>
          </TabsList>

          <TabsContent value="movies" className="space-y-4">
            <div className="mb-4">
              <p className="text-sm text-muted-foreground">
                Filmes em alta hoje no TMDB
              </p>
            </div>
            
            {isLoadingMovies ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : moviesError ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>{moviesError}</p>
                <button 
                  onClick={fetchTrendingMovies}
                  className="mt-2 text-primary hover:underline"
                >
                  Tentar novamente
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {trendingMovies.map((movie) => (
                  <TrendingContentCard
                    key={movie.id}
                    item={movie}
                    type="movie"
                    onClick={() => handleMovieClick(movie)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="series" className="space-y-4">
            <div className="mb-4">
              <p className="text-sm text-muted-foreground">
                Séries em alta hoje no TMDB
              </p>
            </div>
            
            {isLoadingSeries ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : seriesError ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>{seriesError}</p>
                <button 
                  onClick={fetchTrendingSeries}
                  className="mt-2 text-primary hover:underline"
                >
                  Tentar novamente
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {trendingSeries.map((series) => (
                  <TrendingContentCard
                    key={series.id}
                    item={series}
                    type="series"
                    onClick={() => handleSeriesClick(series)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="news" className="space-y-4">
            <div className="mb-4">
              <p className="text-sm text-muted-foreground">
                Últimas notícias de entretenimento
              </p>
            </div>
            
            {isLoadingNews ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Carregando notícias...</p>
              </div>
            ) : newsError ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="mb-2">{newsError}</p>
                <p className="text-xs mb-3">A API de notícias pode estar temporariamente indisponível.</p>
                <button 
                  onClick={fetchNews}
                  className="text-primary hover:underline"
                >
                  Tentar novamente
                </button>
              </div>
            ) : news.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhuma notícia encontrada</p>
              </div>
            ) : (
              <div className="space-y-3">
                {news.map((item) => (
                  <Card 
                    key={item.id} 
                    className="cursor-pointer hover:bg-accent/5 transition-colors"
                    onClick={() => handleNewsClick(item.url)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base leading-tight line-clamp-2">
                          {item.title}
                        </CardTitle>
                        <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                      </div>
                      {item.description && (
                        <CardDescription className="line-clamp-2 text-sm">
                          {item.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{formatDate(item.published)}</span>
                        {item.author && (
                          <span className="truncate max-w-[150px]">{item.author}</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
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

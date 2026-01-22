import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContentCard } from "@/components/ContentCard";
import { ContentDetailDialog } from "@/components/ContentDetailDialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Film, Tv, Newspaper, ExternalLink, Loader2 } from "lucide-react";
import { mockContent, Content } from "@/lib/mockData";
import { supabase } from "@/integrations/supabase/client";

interface NewsItem {
  id: string;
  title: string;
  description: string;
  published: string;
  url: string;
  image: string | null;
  author: string;
}

export default function Trending() {
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoadingNews, setIsLoadingNews] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);

  const trendingMovies = mockContent.filter((item) => item.type === "movie").slice(0, 6);
  const trendingSeries = mockContent.filter((item) => item.type === "series").slice(0, 6);

  const fetchNews = async () => {
    setIsLoadingNews(true);
    setNewsError(null);
    try {
      const { data, error } = await supabase.functions.invoke('currents-news', {
        body: null,
      });

      if (error) {
        console.error('Error fetching news:', error);
        setNewsError('Erro ao carregar notícias');
        return;
      }

      if (data?.news) {
        setNews(data.news.slice(0, 10));
      }
    } catch (err) {
      console.error('Error:', err);
      setNewsError('Erro ao carregar notícias');
    } finally {
      setIsLoadingNews(false);
    }
  };

  useEffect(() => {
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

  const handleCardClick = (content: Content) => {
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
                Filmes com mais atividades nas últimas 20h
              </p>
            </div>
            <div className="space-y-3">
              {trendingMovies.map((content) => (
                <ContentCard
                  key={content.id}
                  content={content}
                  onClick={() => handleCardClick(content)}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="series" className="space-y-4">
            <div className="mb-4">
              <p className="text-sm text-muted-foreground">
                Séries com mais atividades nas últimas 20h
              </p>
            </div>
            <div className="space-y-3">
              {trendingSeries.map((content) => (
                <ContentCard
                  key={content.id}
                  content={content}
                  onClick={() => handleCardClick(content)}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="news" className="space-y-4">
            <div className="mb-4">
              <p className="text-sm text-muted-foreground">
                Últimas notícias de entretenimento
              </p>
            </div>
            
            {isLoadingNews ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : newsError ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>{newsError}</p>
                <button 
                  onClick={fetchNews}
                  className="mt-2 text-primary hover:underline"
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

import { useState } from "react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContentCard } from "@/components/ContentCard";
import { ContentDetailDialog } from "@/components/ContentDetailDialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Film, Tv, Newspaper } from "lucide-react";
import { mockContent, Content } from "@/lib/mockData";

const mockNews = [
  {
    id: 1,
    title: "Duna: Parte 3 confirmado para 2026",
    description: "Denis Villeneuve anuncia continuação da saga",
    date: "Há 2 horas",
  },
  {
    id: 2,
    title: "Breaking Bad ganhará spin-off focado em Jesse Pinkman",
    description: "Aaron Paul retorna ao papel icônico",
    date: "Há 5 horas",
  },
  {
    id: 3,
    title: "Christopher Nolan inicia produção de novo thriller",
    description: "Elenco estelar já foi confirmado",
    date: "Há 1 dia",
  },
];

export default function Trending() {
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const trendingMovies = mockContent.filter((item) => item.type === "movie").slice(0, 6);
  const trendingSeries = mockContent.filter((item) => item.type === "series").slice(0, 6);

  const handleCardClick = (content: Content) => {
    setSelectedContent(content);
    setIsDialogOpen(true);
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
            <div className="grid grid-cols-2 gap-4">
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
            <div className="grid grid-cols-2 gap-4">
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
            {mockNews.map((news) => (
              <Card key={news.id} className="cursor-pointer hover:bg-accent/5 transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg">{news.title}</CardTitle>
                    <Newspaper className="h-5 w-5 text-primary flex-shrink-0" />
                  </div>
                  <CardDescription>{news.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">{news.date}</p>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </main>

      <BottomNav />
      
      {selectedContent && (
        <ContentDetailDialog
          content={selectedContent}
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
        />
      )}
    </div>
  );
}

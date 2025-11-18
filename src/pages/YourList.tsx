import { useState } from "react";
import { ContentCard } from "@/components/ContentCard";
import { ContentDetailDialog } from "@/components/ContentDetailDialog";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { mockContent, type Content } from "@/lib/mockData";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Star, Heart, Clock } from "lucide-react";

export default function YourList() {
  const [filter, setFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("recent");
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleContentClick = (content: Content) => {
    setSelectedContent(content);
    setDialogOpen(true);
  };

  const filteredContent = mockContent.filter((item) => {
    if (filter === "all") return true;
    return item.type === filter;
  });

  const watchedContent = mockContent.filter((item) => item.status === "watched");
  const favorites = mockContent.filter((item) => item.isFavorite);
  const ranking = [...mockContent]
    .filter((item) => item.rating)
    .sort((a, b) => (b.rating || 0) - (a.rating || 0));

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      
      <main className="container mx-auto px-4 py-6 max-w-lg">
        <div className="mb-6">
          <h2 className="font-heading text-3xl font-bold text-foreground mb-1">
            Sua Lista
          </h2>
          <p className="text-sm text-muted-foreground">
            Organize e avalie seu universo cultural
          </p>
        </div>

        <Tabs defaultValue="all" className="mb-6">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="recent">Recentes</TabsTrigger>
            <TabsTrigger value="favorites">Favoritos</TabsTrigger>
            <TabsTrigger value="ranking">Top</TabsTrigger>
          </TabsList>

          <div className="mb-4 flex flex-col gap-3">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Tipo de conteúdo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="movie">Filmes</SelectItem>
                <SelectItem value="series">Séries</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Mais recentes</SelectItem>
                <SelectItem value="oldest">Mais antigos</SelectItem>
                <SelectItem value="rating">Melhor avaliados</SelectItem>
                <SelectItem value="title">Título A-Z</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <TabsContent value="all" className="mt-0">
            <div className="space-y-2">
              {filteredContent.map((content) => (
                <ContentCard 
                  key={content.id} 
                  content={content} 
                  onClick={() => handleContentClick(content)}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="recent" className="mt-0">
            <div className="mb-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <h3 className="font-heading text-xl font-bold">Vistos Recentemente</h3>
              </div>
            </div>
            <div className="space-y-2">
              {watchedContent.map((content) => (
                <ContentCard 
                  key={content.id} 
                  content={content}
                  onClick={() => handleContentClick(content)}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="favorites" className="mt-0">
            <div className="mb-4">
              <div className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-accent" />
                <h3 className="font-heading text-xl font-bold">Seus Favoritos</h3>
              </div>
            </div>
            <div className="space-y-2">
              {favorites.map((content) => (
                <ContentCard 
                  key={content.id} 
                  content={content}
                  onClick={() => handleContentClick(content)}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="ranking" className="mt-0">
            <div className="mb-4">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-accent fill-accent" />
                <h3 className="font-heading text-xl font-bold">Seu Ranking</h3>
              </div>
            </div>
            <div className="space-y-2">
              {ranking.map((content, index) => (
                <div
                  key={content.id}
                  onClick={() => handleContentClick(content)}
                  className="flex items-center gap-3 rounded-lg bg-card border border-border p-4 cursor-pointer hover:bg-accent/5 hover:border-accent/50 transition-all duration-200 active:scale-[0.98]"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 font-heading text-sm font-bold text-primary flex-shrink-0">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-heading font-bold text-foreground line-clamp-1">
                      {content.title}
                    </h4>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {content.genres.join(" • ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-accent flex-shrink-0">
                    <Star className="h-4 w-4 fill-accent" />
                    <span className="font-heading text-lg font-bold">
                      {content.rating?.toFixed(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <ContentDetailDialog 
        content={selectedContent}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />

      <BottomNav />
    </div>
  );
}

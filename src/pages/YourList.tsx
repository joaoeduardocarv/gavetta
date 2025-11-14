import { useState } from "react";
import { ContentCard } from "@/components/ContentCard";
import { Header } from "@/components/Header";
import { mockContent } from "@/lib/mockData";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Star, Heart, Clock } from "lucide-react";

export default function YourList() {
  const [filter, setFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("recent");

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
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="font-heading text-4xl font-bold text-foreground mb-2">
            Sua Lista
          </h2>
          <p className="text-muted-foreground">
            Organize e avalie seu universo cultural
          </p>
        </div>

        <Tabs defaultValue="all" className="mb-8">
          <TabsList className="mb-6">
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="recent">Recentes</TabsTrigger>
            <TabsTrigger value="favorites">Favoritos</TabsTrigger>
            <TabsTrigger value="ranking">Ranking</TabsTrigger>
          </TabsList>

          <div className="mb-6 flex flex-wrap gap-4">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Tipo de conteúdo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="movie">Filmes</SelectItem>
                <SelectItem value="series">Séries</SelectItem>
                <SelectItem value="book">Livros</SelectItem>
                <SelectItem value="podcast">Podcasts</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[200px]">
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
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {filteredContent.map((content) => (
                <ContentCard key={content.id} content={content} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="recent" className="mt-0">
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="h-5 w-5 text-primary" />
                <h3 className="font-heading text-2xl font-bold">Vistos Recentemente</h3>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {watchedContent.map((content) => (
                <ContentCard key={content.id} content={content} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="favorites" className="mt-0">
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Heart className="h-5 w-5 text-accent" />
                <h3 className="font-heading text-2xl font-bold">Seus Favoritos</h3>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {favorites.map((content) => (
                <ContentCard key={content.id} content={content} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="ranking" className="mt-0">
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Star className="h-5 w-5 text-accent fill-accent" />
                <h3 className="font-heading text-2xl font-bold">Seu Ranking</h3>
              </div>
            </div>
            <div className="space-y-4">
              {ranking.map((content, index) => (
                <div
                  key={content.id}
                  className="flex items-center gap-4 rounded-lg bg-card p-4 transition-colors hover:bg-secondary"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-heading text-lg font-bold text-primary">
                    {index + 1}
                  </div>
                  <img
                    src={content.posterUrl}
                    alt={content.title}
                    className="h-20 w-14 rounded object-cover"
                  />
                  <div className="flex-1">
                    <h4 className="font-heading font-bold text-foreground">
                      {content.title}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {content.genres.join(", ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-accent">
                    <Star className="h-5 w-5 fill-accent" />
                    <span className="font-heading text-xl font-bold">
                      {content.rating?.toFixed(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

import { useState } from "react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search as SearchIcon, Film, Tv, Globe, Palette, Radio } from "lucide-react";
import { ContentCard } from "@/components/ContentCard";
import { ContentDetailDialog } from "@/components/ContentDetailDialog";
import { mockContent, Content } from "@/lib/mockData";

const clusters = [
  { id: "movies", label: "Filmes", icon: Film },
  { id: "series", label: "Séries", icon: Tv },
  { id: "genres", label: "Gêneros", icon: Palette },
  { id: "countries", label: "Países", icon: Globe },
  { id: "streaming", label: "Streamings", icon: Radio },
];

export default function Search() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const filteredContent = mockContent.filter((item) =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCardClick = (content: Content) => {
    setSelectedContent(content);
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

        {/* Resultados */}
        {searchQuery && (
          <div>
            <h3 className="font-heading text-lg font-semibold text-foreground mb-4">
              Resultados ({filteredContent.length})
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {filteredContent.map((content) => (
                <ContentCard
                  key={content.id}
                  content={content}
                  onClick={() => handleCardClick(content)}
                />
              ))}
            </div>
          </div>
        )}

        {searchQuery && filteredContent.length === 0 && (
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
        />
      )}
    </div>
  );
}

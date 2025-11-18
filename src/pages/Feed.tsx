import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { ContentCard } from "@/components/ContentCard";
import { ContentDetailDialog } from "@/components/ContentDetailDialog";
import { mockContent, type Content } from "@/lib/mockData";
import { useState } from "react";
import { Users, TrendingUp, Clock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Feed() {
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleContentClick = (content: Content) => {
    setSelectedContent(content);
    setDialogOpen(true);
  };

  // Simulando atividades recentes
  const recentActivities = mockContent.filter(item => item.watchedDate).slice(0, 3);
  
  // Simulando indicações
  const recommendations = mockContent.filter(item => item.rating && item.rating >= 9).slice(0, 4);

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      
      <main className="container mx-auto px-4 py-6 max-w-lg">
        <div className="mb-6">
          <h2 className="font-heading text-3xl font-bold text-foreground mb-1">
            Feed
          </h2>
          <p className="text-sm text-muted-foreground">
            Atividades e indicações da sua rede
          </p>
        </div>

        <Tabs defaultValue="activities" className="mb-6">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="activities">Atividades</TabsTrigger>
            <TabsTrigger value="recommendations">Indicações</TabsTrigger>
            <TabsTrigger value="trending">Em Alta</TabsTrigger>
          </TabsList>

          <TabsContent value="activities" className="mt-0">
            <div className="mb-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <h3 className="font-heading text-xl font-bold">Últimas Atividades</h3>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                O que seus amigos estão assistindo
              </p>
            </div>
            
            <div className="space-y-4">
              {recentActivities.map((content) => (
                <div key={content.id} className="space-y-2">
                  <div className="flex items-center gap-2 px-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      <span className="font-semibold text-foreground">Você</span> assistiu
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {content.watchedDate && new Date(content.watchedDate).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <ContentCard 
                    content={content}
                    onClick={() => handleContentClick(content)}
                  />
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="recommendations" className="mt-0">
            <div className="mb-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-accent" />
                <h3 className="font-heading text-xl font-bold">Indicações</h3>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                O que seus amigos recomendam
              </p>
            </div>
            
            <div className="space-y-4">
              {recommendations.map((content) => (
                <div key={content.id} className="space-y-2">
                  <div className="flex items-center gap-2 px-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      <span className="font-semibold text-foreground">Você</span> recomenda
                    </span>
                  </div>
                  <ContentCard 
                    content={content}
                    onClick={() => handleContentClick(content)}
                  />
                  {content.drawerComment && (
                    <div className="ml-4 p-3 bg-muted/30 rounded-lg border-l-2 border-accent">
                      <p className="text-xs text-muted-foreground italic">
                        "{content.drawerComment}"
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="trending" className="mt-0">
            <div className="mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <h3 className="font-heading text-xl font-bold">Em Alta</h3>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Mais populares no Gavetta
              </p>
            </div>
            
            <div className="space-y-2">
              {mockContent.slice(0, 5).map((content) => (
                <ContentCard 
                  key={content.id}
                  content={content}
                  onClick={() => handleContentClick(content)}
                />
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

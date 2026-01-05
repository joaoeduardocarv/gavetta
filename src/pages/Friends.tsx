import { useState } from "react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Search, UserPlus, Film, ThumbsUp, MessageCircle } from "lucide-react";
import { ContentCard } from "@/components/ContentCard";
import { ContentDetailDialog } from "@/components/ContentDetailDialog";
import { mockContent, Content } from "@/lib/mockData";

const mockFriends = [
  {
    id: 1,
    name: "Ana Silva",
    username: "@anasilva",
    avatar: "",
    recentActivity: "Assistiu Duna: Parte Dois",
    mutualDrawers: 12,
  },
  {
    id: 2,
    name: "João Santos",
    username: "@joaosantos",
    avatar: "",
    recentActivity: "Adicionou Breaking Bad à gaveta",
    mutualDrawers: 8,
  },
  {
    id: 3,
    name: "Maria Costa",
    username: "@mariacosta",
    avatar: "",
    recentActivity: "Avaliou Parasita com 10 estrelas",
    mutualDrawers: 15,
  },
];

const mockActivities = [
  {
    id: 1,
    friend: mockFriends[0],
    action: "assistiu",
    content: mockContent[0],
    rating: 9,
    comment: "Que filme incrível! A fotografia é espetacular.",
    time: "Há 2 horas",
  },
  {
    id: 2,
    friend: mockFriends[1],
    action: "adicionou à gaveta",
    content: mockContent[1],
    time: "Há 5 horas",
  },
  {
    id: 3,
    friend: mockFriends[2],
    action: "avaliou",
    content: mockContent[2],
    rating: 10,
    time: "Há 1 dia",
  },
];

const mockRecommendations = [
  {
    id: 1,
    friend: mockFriends[0],
    content: mockContent[0],
    comment: "Você precisa assistir! É simplesmente espetacular.",
    time: "Há 3 horas",
  },
  {
    id: 2,
    friend: mockFriends[1],
    content: mockContent[1],
    comment: "Melhor filme que vi este ano!",
    time: "Há 1 dia",
  },
];

export default function Friends() {
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleCardClick = (content: Content) => {
    setSelectedContent(content);
    setIsDialogOpen(true);
  };

  const handleContentChange = (newContent: Content) => {
    setSelectedContent(newContent);
    setIsDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      
      <main className="container mx-auto px-4 py-6 max-w-lg">
        <div className="mb-6">
          <h2 className="font-heading text-3xl font-bold text-foreground mb-1">
            Meus Amigos
          </h2>
          <p className="text-sm text-muted-foreground">
            Conecte-se e descubra novas indicações
          </p>
        </div>

        <Tabs defaultValue="activities" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="activities">Atividades</TabsTrigger>
            <TabsTrigger value="recommendations">Indicações</TabsTrigger>
            <TabsTrigger value="friends">Amigos</TabsTrigger>
          </TabsList>

          {/* Últimas Atividades */}
          <TabsContent value="activities" className="space-y-4">
            {mockActivities.map((activity) => (
              <Card key={activity.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={activity.friend.avatar} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {activity.friend.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{activity.friend.name}</p>
                      <p className="text-xs text-muted-foreground">{activity.time}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm">
                    {activity.action} <span className="font-semibold">{activity.content.title}</span>
                    {activity.rating && ` com ${activity.rating} estrelas`}
                  </p>
                  {activity.comment && (
                    <p className="text-sm text-muted-foreground italic">"{activity.comment}"</p>
                  )}
                  <div className="flex gap-4 pt-2">
                    <Button variant="ghost" size="sm" className="gap-2">
                      <ThumbsUp className="h-4 w-4" />
                      Curtir
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-2">
                      <MessageCircle className="h-4 w-4" />
                      Comentar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Indicações */}
          <TabsContent value="recommendations" className="space-y-4">
            {mockRecommendations.map((rec) => (
              <Card key={rec.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={rec.friend.avatar} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {rec.friend.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{rec.friend.name} indicou para você</p>
                      <p className="text-xs text-muted-foreground">{rec.time}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div 
                    className="cursor-pointer"
                    onClick={() => handleCardClick(rec.content)}
                  >
                    <ContentCard content={rec.content} />
                  </div>
                  <p className="text-sm text-muted-foreground italic">"{rec.comment}"</p>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Lista de Amigos */}
          <TabsContent value="friends" className="space-y-4">
            <div className="mb-4">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar amigos..." 
                  className="pl-10"
                />
              </div>
              
              <Button className="w-full" variant="outline">
                <UserPlus className="h-4 w-4 mr-2" />
                Adicionar Amigos
              </Button>
            </div>

            <h3 className="font-heading text-lg font-semibold text-foreground">
              Seus Amigos ({mockFriends.length})
            </h3>
            
            {mockFriends.map((friend) => (
              <div
                key={friend.id}
                className="flex items-center gap-3 p-4 bg-card rounded-lg border border-border hover:bg-accent/5 hover:border-accent/50 transition-all duration-200 cursor-pointer"
              >
                <Avatar className="h-12 w-12 flex-shrink-0">
                  <AvatarImage src={friend.avatar} alt={friend.name} />
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {friend.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-heading font-bold text-foreground text-sm">
                      {friend.name}
                    </h4>
                    <span className="text-xs text-muted-foreground">
                      {friend.username}
                    </span>
                  </div>
                  
                  <p className="text-xs text-muted-foreground line-clamp-1 mb-1.5">
                    {friend.recentActivity}
                  </p>
                  
                  <Badge variant="secondary" className="text-xs">
                    <Film className="h-3 w-3 mr-1" />
                    {friend.mutualDrawers} gavettas em comum
                  </Badge>
                </div>
              </div>
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
          onContentChange={handleContentChange}
        />
      )}
    </div>
  );
}

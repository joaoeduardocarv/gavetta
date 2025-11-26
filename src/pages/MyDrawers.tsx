import { useState } from "react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { ContentCard } from "@/components/ContentCard";
import { ContentDetailDialog } from "@/components/ContentDetailDialog";
import { CreateDrawerDialog } from "@/components/CreateDrawerDialog";
import { mockContent, Content } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Play, Eye, CheckCircle, Star, GripVertical, Heart, Bookmark, Clock, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Drawer {
  id: string;
  name: string;
  icon: any;
  color: string;
  count: number;
}

const defaultDrawers: Drawer[] = [
  {
    id: "to-watch",
    name: "Para Assistir",
    icon: Play,
    color: "text-blue-500",
    count: 8,
  },
  {
    id: "watching",
    name: "Assistindo",
    icon: Eye,
    color: "text-yellow-500",
    count: 3,
  },
  {
    id: "watched",
    name: "Assistidos",
    icon: CheckCircle,
    color: "text-green-500",
    count: 15,
  },
  {
    id: "ranking",
    name: "Ranking",
    icon: Star,
    color: "text-purple-500",
    count: 12,
  },
];

const iconMap: Record<string, any> = {
  Play,
  Eye,
  CheckCircle,
  Star,
  Heart,
  Bookmark,
  Clock,
  Sparkles,
};

interface SortableContentCardProps {
  content: Content;
  onClick: () => void;
}

function SortableContentCard({ content, onClick }: SortableContentCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: content.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <div className="flex items-center gap-2">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-2 hover:bg-accent/10 rounded transition-colors"
        >
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex-1">
          <ContentCard content={content} onClick={onClick} />
        </div>
      </div>
    </div>
  );
}

export default function MyDrawers() {
  const { toast } = useToast();
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedDrawer, setSelectedDrawer] = useState<string | null>(null);
  const [customDrawers, setCustomDrawers] = useState<Drawer[]>([]);
  const [drawerContent, setDrawerContent] = useState<Content[]>(
    mockContent.filter(item => item.isInDrawer)
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleCardClick = (content: Content) => {
    setSelectedContent(content);
    setIsDialogOpen(true);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setDrawerContent((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleCreateDrawer = (drawer: { name: string; icon: string; color: string; contentIds: string[] }) => {
    const newDrawer: Drawer = {
      id: `custom-${Date.now()}`,
      name: drawer.name,
      icon: iconMap[drawer.icon] || Star,
      color: drawer.color,
      count: drawer.contentIds.length,
    };
    
    setCustomDrawers((prev) => [...prev, newDrawer]);
    toast({
      title: "Gavetta criada!",
      description: `"${drawer.name}" foi criada com sucesso.`,
    });
  };

  const allDrawers = [...defaultDrawers, ...customDrawers];

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      
      <main className="container mx-auto px-4 py-6 max-w-lg">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-heading text-3xl font-bold text-foreground">
            Minhas Gavettas
          </h2>
          <Button size="sm" variant="outline" onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova
          </Button>
        </div>

        {!selectedDrawer ? (
          <div className="space-y-3">
            <h3 className="font-heading text-lg font-semibold text-foreground mb-4">
              Gavetas Padrão
            </h3>
            
            {defaultDrawers.map((drawer) => {
              const Icon = drawer.icon;
              return (
                <button
                  key={drawer.id}
                  onClick={() => setSelectedDrawer(drawer.id)}
                  className="w-full flex items-center justify-between p-4 bg-card rounded-lg border border-border hover:bg-accent/5 hover:border-accent/50 transition-all duration-200"
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`h-6 w-6 ${drawer.color}`} />
                    <div className="text-left">
                      <h4 className="font-heading font-bold text-foreground">
                        {drawer.name}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {drawer.count} {drawer.count === 1 ? 'item' : 'itens'}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary">{drawer.count}</Badge>
                </button>
              );
            })}

            {customDrawers.length > 0 && (
              <div className="pt-6">
                <h3 className="font-heading text-lg font-semibold text-foreground mb-4">
                  Gavetas Personalizadas
                </h3>
                
                {customDrawers.map((drawer) => {
                  const Icon = drawer.icon;
                  return (
                    <button
                      key={drawer.id}
                      onClick={() => setSelectedDrawer(drawer.id)}
                      className="w-full flex items-center justify-between p-4 bg-card rounded-lg border border-border hover:bg-accent/5 hover:border-accent/50 transition-all duration-200 mb-3"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`h-6 w-6 ${drawer.color}`} />
                        <div className="text-left">
                          <h4 className="font-heading font-bold text-foreground">
                            {drawer.name}
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            {drawer.count} {drawer.count === 1 ? 'item' : 'itens'}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary">{drawer.count}</Badge>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <div className="space-y-4">
              <Button 
                variant="ghost" 
                onClick={() => setSelectedDrawer(null)}
                className="mb-2"
              >
                ← Voltar
              </Button>
              
              <h3 className="font-heading text-xl font-bold text-foreground mb-4">
                {allDrawers.find(d => d.id === selectedDrawer)?.name}
              </h3>

              <SortableContext
                items={drawerContent.map(c => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {drawerContent.map((content) => (
                    <SortableContentCard
                      key={content.id}
                      content={content}
                      onClick={() => handleCardClick(content)}
                    />
                  ))}
                </div>
              </SortableContext>

              {drawerContent.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Nenhum conteúdo nesta gaveta</p>
                </div>
              )}
            </div>
          </DndContext>
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

      <CreateDrawerDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreateDrawer={handleCreateDrawer}
      />
    </div>
  );
}

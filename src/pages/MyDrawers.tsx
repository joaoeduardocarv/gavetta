import { useState } from "react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { ContentCard } from "@/components/ContentCard";
import { ContentDetailDialog } from "@/components/ContentDetailDialog";
import { mockContent, Content } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Play, Eye, CheckCircle, Star, GripVertical } from "lucide-react";
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

const defaultDrawers = [
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
      <div
        {...attributes}
        {...listeners}
        className="absolute left-2 top-1/2 -translate-y-1/2 z-10 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity touch-none"
      >
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="pl-8">
        <ContentCard content={content} onClick={onClick} />
      </div>
    </div>
  );
}

export default function MyDrawers() {
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDrawer, setSelectedDrawer] = useState<string | null>(null);
  const [drawerContent, setDrawerContent] = useState<Content[]>(
    mockContent.filter(item => item.isInDrawer)
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 1000,
        tolerance: 5,
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

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      
      <main className="container mx-auto px-4 py-6 max-w-lg">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-heading text-3xl font-bold text-foreground">
            Minhas Gavettas
          </h2>
          <Button size="sm" variant="outline">
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

            <div className="pt-6">
              <h3 className="font-heading text-lg font-semibold text-foreground mb-4">
                Gavetas Personalizadas
              </h3>
              
              <button className="w-full flex items-center justify-center gap-2 p-6 bg-card rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-accent/5 transition-all duration-200">
                <Plus className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground font-medium">
                  Criar Gaveta Personalizada
                </span>
              </button>
            </div>
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
                {defaultDrawers.find(d => d.id === selectedDrawer)?.name}
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
    </div>
  );
}

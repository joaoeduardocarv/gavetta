import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { mockContent } from "@/lib/mockData";
import { Play, Eye, CheckCircle, Star, Heart, Bookmark, Clock, Sparkles } from "lucide-react";
import { useDrawers } from "@/contexts/DrawerContext";

interface CreateDrawerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateDrawer: (drawer: { name: string; icon: string; color: string; contentIds: string[] }) => void;
}

const iconOptions = [
  { value: "Play", icon: Play, label: "Play" },
  { value: "Eye", icon: Eye, label: "Olho" },
  { value: "CheckCircle", icon: CheckCircle, label: "Check" },
  { value: "Star", icon: Star, label: "Estrela" },
  { value: "Heart", icon: Heart, label: "Coração" },
  { value: "Bookmark", icon: Bookmark, label: "Bookmark" },
  { value: "Clock", icon: Clock, label: "Relógio" },
  { value: "Sparkles", icon: Sparkles, label: "Brilho" },
];

const colorOptions = [
  { value: "text-blue-500", label: "Azul" },
  { value: "text-yellow-500", label: "Amarelo" },
  { value: "text-green-500", label: "Verde" },
  { value: "text-purple-500", label: "Roxo" },
  { value: "text-red-500", label: "Vermelho" },
  { value: "text-pink-500", label: "Rosa" },
  { value: "text-orange-500", label: "Laranja" },
  { value: "text-cyan-500", label: "Ciano" },
];

export function CreateDrawerDialog({ open, onOpenChange, onCreateDrawer }: CreateDrawerDialogProps) {
  const { addToCustomDrawer } = useDrawers();
  const [drawerName, setDrawerName] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("Star");
  const [selectedColor, setSelectedColor] = useState("text-purple-500");
  const [selectedContentIds, setSelectedContentIds] = useState<string[]>([]);

  const handleContentToggle = (contentId: string) => {
    setSelectedContentIds((prev) =>
      prev.includes(contentId)
        ? prev.filter((id) => id !== contentId)
        : [...prev, contentId]
    );
  };

  const handleCreate = () => {
    if (drawerName.trim()) {
      // Criar a gaveta primeiro
      onCreateDrawer({
        name: drawerName,
        icon: selectedIcon,
        color: selectedColor,
        contentIds: selectedContentIds,
      });
      
      // Reset form
      setDrawerName("");
      setSelectedIcon("Star");
      setSelectedColor("text-purple-500");
      setSelectedContentIds([]);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">Criar Nova Gavetta</DialogTitle>
          <DialogDescription>
            Configure sua gaveta personalizada com nome, ícone e conteúdos
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 flex-1 overflow-y-auto px-1">
          {/* Nome da Gaveta */}
          <div className="space-y-2">
            <Label htmlFor="drawer-name" className="text-sm font-semibold">
              Nome da Gavetta
            </Label>
            <Input
              id="drawer-name"
              placeholder="Ex: Meus Favoritos"
              value={drawerName}
              onChange={(e) => setDrawerName(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Seleção de Ícone */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Escolha um Ícone</Label>
            <div className="grid grid-cols-4 gap-2">
              {iconOptions.map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  onClick={() => setSelectedIcon(value)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                    selectedIcon === value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <Icon className="h-6 w-6" />
                  <span className="text-xs">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Seleção de Cor */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Escolha uma Cor</Label>
            <div className="grid grid-cols-4 gap-2">
              {colorOptions.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setSelectedColor(value)}
                  className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                    selectedColor === value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className={`h-4 w-4 rounded-full ${value.replace('text-', 'bg-')}`} />
                  <span className="text-xs">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Seleção de Conteúdos */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">
              Adicionar Conteúdos ({selectedContentIds.length} selecionados)
            </Label>
            <ScrollArea className="h-[300px] rounded-lg border p-4">
              <div className="space-y-3">
                {mockContent.map((content) => (
                  <div
                    key={content.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/5 transition-colors"
                  >
                    <Checkbox
                      id={`content-${content.id}`}
                      checked={selectedContentIds.includes(content.id)}
                      onCheckedChange={() => handleContentToggle(content.id)}
                    />
                    <label
                      htmlFor={`content-${content.id}`}
                      className="flex-1 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={content.posterUrl}
                          alt={content.title}
                          className="w-12 h-12 rounded object-cover"
                        />
                        <div>
                          <p className="font-semibold text-sm">{content.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {content.type === "movie" ? "Filme" : "Série"}
                          </p>
                        </div>
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={!drawerName.trim()} className="flex-1">
            Criar Gavetta
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

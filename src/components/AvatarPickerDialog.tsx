import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import avatarSheet1 from "@/assets/avatars/avatars-1.png";
import avatarSheet2 from "@/assets/avatars/avatars-2.png";

// Definir os avatares com posições no sprite sheet
// Primeira imagem: 4 linhas x 3 colunas
const avatarsSheet1 = [
  { id: "marty", name: "Marty McFly", row: 0, col: 0 },
  { id: "apollo", name: "Apollo Creed", row: 0, col: 1 },
  { id: "terminator", name: "Terminator", row: 0, col: 2 },
  { id: "thanos", name: "Thanos", row: 1, col: 0 },
  { id: "joker", name: "Coringa", row: 1, col: 1 },
  { id: "rocky", name: "Rocky", row: 1, col: 2 },
  { id: "furiosa", name: "Furiosa", row: 2, col: 0 },
  { id: "aang", name: "Aang", row: 2, col: 1 },
  { id: "john-wick", name: "John Wick", row: 2, col: 2 },
  { id: "black-panther", name: "Pantera Negra", row: 3, col: 0 },
  { id: "anton", name: "Anton Chigurh", row: 3, col: 1 },
  { id: "mufasa", name: "Mufasa", row: 3, col: 2 },
];

// Segunda imagem: 3 linhas x 3 colunas + 1
const avatarsSheet2 = [
  { id: "bride", name: "A Noiva", row: 0, col: 0 },
  { id: "demogorgon", name: "Demogorgon", row: 0, col: 1 },
  { id: "godfather", name: "O Poderoso Chefão", row: 0, col: 2 },
  { id: "legolas", name: "Legolas", row: 1, col: 0 },
  { id: "gandalf", name: "Gandalf", row: 1, col: 1 },
  { id: "heisenberg", name: "Heisenberg", row: 1, col: 2 },
  { id: "iron-man", name: "Homem de Ferro", row: 2, col: 0 },
  { id: "batman", name: "Batman", row: 2, col: 1 },
  { id: "neytiri", name: "Neytiri", row: 2, col: 2 },
  { id: "neo", name: "Neo", row: 3, col: 0 },
];

interface AvatarOption {
  id: string;
  sheet: string;
  row: number;
  col: number;
  name: string;
  totalRows: number;
  totalCols: number;
}

const allAvatars: AvatarOption[] = [
  ...avatarsSheet1.map(a => ({ ...a, sheet: avatarSheet1, totalRows: 4, totalCols: 3 })),
  ...avatarsSheet2.map(a => ({ ...a, sheet: avatarSheet2, totalRows: 4, totalCols: 3 })),
];

interface AvatarPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentAvatar: string;
  onSelectAvatar: (avatarId: string) => void;
}

export function AvatarPickerDialog({ 
  open, 
  onOpenChange, 
  currentAvatar, 
  onSelectAvatar 
}: AvatarPickerDialogProps) {
  const [selectedId, setSelectedId] = useState(currentAvatar);

  const handleSelect = (avatar: AvatarOption) => {
    setSelectedId(avatar.id);
    onSelectAvatar(avatar.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Escolha seu Avatar</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-[400px] pr-4">
          <div className="grid grid-cols-4 gap-3">
            {allAvatars.map((avatar) => (
              <button
                key={avatar.id}
                onClick={() => handleSelect(avatar)}
                className={cn(
                  "relative aspect-square rounded-full overflow-hidden border-2 transition-all duration-200 hover:scale-105",
                  selectedId === avatar.id
                    ? "border-primary ring-2 ring-primary/50"
                    : "border-transparent hover:border-muted-foreground/30"
                )}
                title={avatar.name}
              >
                <div
                  className="w-full h-full"
                  style={{
                    backgroundImage: `url(${avatar.sheet})`,
                    backgroundSize: `${avatar.totalCols * 100}% ${avatar.totalRows * 100}%`,
                    backgroundPosition: `${(avatar.col / (avatar.totalCols - 1)) * 100}% ${(avatar.row / (avatar.totalRows - 1)) * 100}%`,
                  }}
                />
              </button>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// Helper para obter a URL do avatar baseado no ID
export function getAvatarStyle(avatarId: string): React.CSSProperties | null {
  const avatar = allAvatars.find(a => a.id === avatarId);
  if (!avatar) return null;
  
  return {
    backgroundImage: `url(${avatar.sheet})`,
    backgroundSize: `${avatar.totalCols * 100}% ${avatar.totalRows * 100}%`,
    backgroundPosition: `${(avatar.col / (avatar.totalCols - 1)) * 100}% ${(avatar.row / (avatar.totalRows - 1)) * 100}%`,
  };
}

export { allAvatars };

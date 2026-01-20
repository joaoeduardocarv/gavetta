import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// Import all avatar images
import aang from "@/assets/avatars/aang.png";
import anton from "@/assets/avatars/anton.png";
import apollo from "@/assets/avatars/apollo.png";
import batman from "@/assets/avatars/batman.png";
import blackPanther from "@/assets/avatars/black-panther.png";
import bride from "@/assets/avatars/bride.png";
import demogorgon from "@/assets/avatars/demogorgon.png";
import eleven from "@/assets/avatars/eleven.png";
import furiosa from "@/assets/avatars/furiosa.png";
import gandalf from "@/assets/avatars/gandalf.png";
import godfather from "@/assets/avatars/godfather.png";
import heisenberg from "@/assets/avatars/heisenberg.png";
import ironMan from "@/assets/avatars/iron-man.png";
import johnWick from "@/assets/avatars/john-wick.png";
import joker from "@/assets/avatars/joker.png";
import legolas from "@/assets/avatars/legolas.png";
import neytiri from "@/assets/avatars/neytiri.png";
import rocky from "@/assets/avatars/rocky.png";
import simba from "@/assets/avatars/simba.png";
import terminator from "@/assets/avatars/terminator.png";
import thanos from "@/assets/avatars/thanos.png";
import trinity from "@/assets/avatars/trinity.png";

export interface AvatarOption {
  id: string;
  name: string;
  src: string;
}

export const allAvatars: AvatarOption[] = [
  { id: "aang", name: "Aang", src: aang },
  { id: "anton", name: "Anton Chigurh", src: anton },
  { id: "apollo", name: "Apollo Creed", src: apollo },
  { id: "batman", name: "Batman", src: batman },
  { id: "black-panther", name: "Pantera Negra", src: blackPanther },
  { id: "bride", name: "A Noiva", src: bride },
  { id: "demogorgon", name: "Demogorgon", src: demogorgon },
  { id: "eleven", name: "Eleven", src: eleven },
  { id: "furiosa", name: "Furiosa", src: furiosa },
  { id: "gandalf", name: "Gandalf", src: gandalf },
  { id: "godfather", name: "O Poderoso Chefão", src: godfather },
  { id: "heisenberg", name: "Heisenberg", src: heisenberg },
  { id: "iron-man", name: "Homem de Ferro", src: ironMan },
  { id: "john-wick", name: "John Wick", src: johnWick },
  { id: "joker", name: "Coringa", src: joker },
  { id: "legolas", name: "Legolas", src: legolas },
  { id: "neytiri", name: "Neytiri", src: neytiri },
  { id: "rocky", name: "Rocky", src: rocky },
  { id: "simba", name: "Simba", src: simba },
  { id: "terminator", name: "Terminator", src: terminator },
  { id: "thanos", name: "Thanos", src: thanos },
  { id: "trinity", name: "Trinity", src: trinity },
];

// Helper to get avatar source by ID
export function getAvatarById(avatarId: string): AvatarOption | undefined {
  return allAvatars.find(a => a.id === avatarId);
}

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
                <img
                  src={avatar.src}
                  alt={avatar.name}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

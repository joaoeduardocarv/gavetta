import { Archive, Clock, Play, Check, Plus } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useDrawers, DEFAULT_DRAWER_IDS, DefaultDrawerId } from "@/contexts/DrawerContext";
import { cn } from "@/lib/utils";
import type { Content } from "@/lib/mockData";
import { useState } from "react";

interface DrawerPickerPopoverProps {
  content: Content;
  children: React.ReactNode;
}

const defaultDrawerConfig: Record<DefaultDrawerId, { label: string; icon: typeof Clock; color: string }> = {
  'to-watch': { label: 'Quero Ver', icon: Clock, color: 'text-yellow-500' },
  'watching': { label: 'Assistindo', icon: Play, color: 'text-blue-500' },
  'watched': { label: 'Assistido', icon: Check, color: 'text-green-500' },
};

export function DrawerPickerPopover({ content, children }: DrawerPickerPopoverProps) {
  const [open, setOpen] = useState(false);
  const { 
    customDrawers, 
    getContentDrawers, 
    setDefaultDrawer, 
    addToCustomDrawer, 
    removeFromCustomDrawer,
    isInCustomDrawer
  } = useDrawers();

  const { defaultDrawer, customDrawers: contentCustomDrawers } = getContentDrawers(content.id);

  const handleDefaultDrawerClick = async (drawerId: DefaultDrawerId) => {
    if (defaultDrawer === drawerId) {
      await setDefaultDrawer(content, null);
    } else {
      await setDefaultDrawer(content, drawerId);
    }
  };

  const handleCustomDrawerClick = async (drawerId: string) => {
    if (isInCustomDrawer(content.id, drawerId)) {
      await removeFromCustomDrawer(content.id, drawerId);
    } else {
      await addToCustomDrawer(content, drawerId);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
        {children}
      </PopoverTrigger>
      <PopoverContent 
        className="w-56 p-2 z-50 bg-popover border border-border shadow-lg" 
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground px-2 py-1">
            Gavettas Padrão
          </p>
          {DEFAULT_DRAWER_IDS.map((id) => {
            const config = defaultDrawerConfig[id];
            const Icon = config.icon;
            const isSelected = defaultDrawer === id;
            
            return (
              <button
                key={id}
                onClick={() => handleDefaultDrawerClick(id)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors",
                  "hover:bg-accent/10",
                  isSelected && "bg-accent/20"
                )}
              >
                <Icon className={cn("h-4 w-4", config.color)} />
                <span className="flex-1 text-left">{config.label}</span>
                {isSelected && <Check className="h-4 w-4 text-accent" />}
              </button>
            );
          })}

          {customDrawers.length > 0 && (
            <>
              <div className="border-t border-border my-2" />
              <p className="text-xs font-medium text-muted-foreground px-2 py-1">
                Gavettas Personalizadas
              </p>
              {customDrawers.map((drawer) => {
                const isSelected = contentCustomDrawers.includes(drawer.id);
                
                return (
                  <button
                    key={drawer.id}
                    onClick={() => handleCustomDrawerClick(drawer.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors",
                      "hover:bg-accent/10",
                      isSelected && "bg-accent/20"
                    )}
                  >
                    <Archive className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 text-left">{drawer.name}</span>
                    {isSelected && <Check className="h-4 w-4 text-accent" />}
                  </button>
                );
              })}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

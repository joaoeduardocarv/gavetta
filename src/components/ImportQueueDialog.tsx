import { useEffect, useState } from "react";
import { ContentDetailDialog } from "@/components/ContentDetailDialog";
import { Content } from "@/lib/mockData";

interface ImportQueueDialogProps {
  queue: Content[];
  startIndex?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFinish?: () => void;
}

/**
 * Mostra os conteúdos encontrados um a um: ao fechar o card atual,
 * avança automaticamente para o próximo da fila.
 */
export function ImportQueueDialog({
  queue,
  startIndex = 0,
  open,
  onOpenChange,
  onFinish,
}: ImportQueueDialogProps) {
  const [index, setIndex] = useState(startIndex);
  const [current, setCurrent] = useState<Content | null>(queue[startIndex] ?? null);

  // Reset completo ao (re)abrir — evita vazar estado entre execuções
  useEffect(() => {
    if (open) {
      setIndex(startIndex);
      setCurrent(queue[startIndex] ?? null);
    } else {
      setCurrent(null);
    }
  }, [open, startIndex, queue]);

  if (!open || !current) return null;

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) return;
    const nextIndex = index + 1;
    if (nextIndex < queue.length) {
      setCurrent(null);
      // pequeno delay para o diálogo fechar antes de reabrir com o próximo
      setTimeout(() => {
        setIndex(nextIndex);
        setCurrent(queue[nextIndex]);
      }, 180);
    } else {
      onOpenChange(false);
      onFinish?.();
    }
  };

  return (
    <>
      <div className="fixed left-1/2 top-3 z-[70] -translate-x-1/2 rounded-full border border-border bg-background/95 px-3 py-1 text-xs font-medium text-foreground shadow-lg backdrop-blur">
        {index + 1} de {queue.length} · feche o card para ir ao próximo
      </div>
      <ContentDetailDialog
        content={current}
        open={!!current}
        onOpenChange={handleOpenChange}
        onContentChange={setCurrent}
      />
    </>
  );
}

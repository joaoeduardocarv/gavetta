import { useEffect, useState } from "react";
import { ContentDetailDialog } from "@/components/ContentDetailDialog";
import { Content } from "@/lib/mockData";

interface ImportQueueDialogProps {
  queue: Content[];
  /** Trecho onde cada título foi citado (mesma ordem da fila). */
  contexts?: (string | undefined)[];
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
  contexts,
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

  const context = contexts?.[index];

  return (
    <>
      <div className="fixed left-1/2 top-3 z-[70] flex max-w-[92vw] -translate-x-1/2 flex-col items-center gap-1 rounded-2xl border border-border bg-background/95 px-3 py-1.5 text-xs font-medium text-foreground shadow-lg backdrop-blur">
        <span>{index + 1} de {queue.length} · feche o card para ir ao próximo</span>
        {context && (
          <span className="line-clamp-2 max-w-full text-center font-normal italic text-muted-foreground">
            {context}
          </span>
        )}
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

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ContentCard } from "@/components/ContentCard";
import type { Content } from "@/lib/mockData";
import { cn } from "@/lib/utils";

interface SortableContentCardProps {
  content: Content;
  onClick?: () => void;
  disabled?: boolean;
}

export function SortableContentCard({ content, onClick, disabled }: SortableContentCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: content.id,
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        touchAction: disabled ? undefined : "manipulation",
      }}
      className={cn(
        "relative",
        isDragging && "z-50 opacity-90 shadow-xl rounded-lg scale-[1.02]"
      )}
      {...attributes}
      {...listeners}
    >
      <ContentCard content={content} onClick={onClick} />
    </div>
  );
}

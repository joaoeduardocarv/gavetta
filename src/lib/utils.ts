import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Replaces %%YYYY-MM-DD%% markers in notification messages with relative dates
 * like "hoje", "amanhã", "em 2 dias", etc.
 */
export function formatRelativeDate(message: string): string {
  return message.replace(/%%(\d{4}-\d{2}-\d{2})%%/g, (_match, dateStr: string) => {
    const target = new Date(dateStr + 'T00:00:00');
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return new Date(dateStr).toLocaleDateString('pt-BR');
    if (diffDays === 0) return 'hoje';
    if (diffDays === 1) return 'amanhã';
    if (diffDays <= 7) return `${diffDays} dias`;
    return new Date(dateStr).toLocaleDateString('pt-BR');
  });
}

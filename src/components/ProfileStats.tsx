import { Eye, CheckCircle, Play, Archive } from "lucide-react";
import { useDrawers } from "@/contexts/DrawerContext";

export function ProfileStats() {
  const { assignments, customDrawers, getDrawerContents } = useDrawers();

  const toWatchCount = getDrawerContents("to-watch").length;
  const watchingCount = getDrawerContents("watching").length;
  const watchedCount = getDrawerContents("watched").length;
  const totalCustom = customDrawers.reduce((acc, d) => acc + getDrawerContents(d.id).length, 0);

  const stats = [
    { label: "Quero Ver", value: toWatchCount, icon: Play, color: "text-blue-500" },
    { label: "Assistindo", value: watchingCount, icon: Eye, color: "text-yellow-500" },
    { label: "Assistidos", value: watchedCount, icon: CheckCircle, color: "text-green-500" },
    { label: "Personalizadas", value: totalCustom, icon: Archive, color: "text-primary" },
  ];

  // Calculate average rating
  const ratedItems = assignments.filter((a) => a.rating !== null && a.rating !== undefined);
  const avgRating = ratedItems.length > 0
    ? (ratedItems.reduce((sum, a) => sum + (a.rating || 0), 0) / ratedItems.length).toFixed(1)
    : "—";

  return (
    <div className="bg-card rounded-lg p-6 space-y-4">
      <h3 className="font-heading font-bold text-foreground">Minhas Estatísticas</h3>

      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-muted/50 rounded-lg p-3 flex items-center gap-3">
              <Icon className={`h-5 w-5 ${stat.color}`} />
              <div>
                <p className="text-lg font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Nota média</span>
        </div>
        <span className="text-lg font-bold text-accent">⭐ {avgRating}</span>
      </div>

      <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
        <span className="text-sm text-muted-foreground">Total de títulos</span>
        <span className="text-lg font-bold text-foreground">{toWatchCount + watchingCount + watchedCount + totalCustom}</span>
      </div>
    </div>
  );
}

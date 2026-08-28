import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FEATURE_LABELS, DRAWER_LABELS } from "@/components/admin/featureLabels";

interface DayEntry {
  day: string;
  actions: number;
  by_feature: Record<string, number>;
  items: { feature: string; label: string | null; detail: string | null; at: string }[];
}

interface ActivityPayload {
  profile: { username: string | null; handle: string | null; avatar_url: string | null; created_at: string } | null;
  daily: DayEntry[];
  totals: Record<string, number>;
}

function formatDay(day: string) {
  const [y, m, d] = day.split("-");
  return `${d}/${m}`;
}

export function UserActivityDialog({
  userId,
  open,
  onOpenChange,
}: {
  userId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [days, setDays] = useState(30);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-user-activity", userId, days],
    enabled: open && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_user_activity", {
        _user_id: userId!,
        _days: days,
      });
      if (error) throw error;
      return data as unknown as ActivityPayload;
    },
  });

  const daily = data?.daily ?? [];
  const max = Math.max(1, ...daily.map((d) => d.actions));
  const selected = daily.find((d) => d.day === selectedDay) ?? null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setSelectedDay(null);
        onOpenChange(v);
      }}
    >
      <DialogContent className="z-[60] max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarImage src={data?.profile?.avatar_url ?? undefined} />
              <AvatarFallback>{(data?.profile?.username ?? "?").slice(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="truncate">
              {data?.profile?.username ?? "Usuário"}
              {data?.profile?.handle && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">@{data.profile.handle}</span>
              )}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          {[30, 90].map((d) => (
            <Button key={d} size="sm" variant={days === d ? "default" : "outline"} onClick={() => setDays(d)}>
              {d} dias
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ScrollArea className="flex-1 pr-3">
            <div className="space-y-5 py-2">
              <div>
                <p className="text-sm font-medium mb-2">Ações por dia</p>
                <div className="flex items-end gap-[3px] h-28">
                  {daily.map((d) => (
                    <button
                      key={d.day}
                      onClick={() => setSelectedDay(d.day === selectedDay ? null : d.day)}
                      title={`${formatDay(d.day)} — ${d.actions} ações`}
                      aria-label={`${formatDay(d.day)}: ${d.actions} ações`}
                      className={`flex-1 min-w-[4px] rounded-t transition-colors ${
                        d.day === selectedDay ? "bg-accent" : d.actions > 0 ? "bg-primary" : "bg-muted"
                      }`}
                      style={{ height: `${Math.max(4, (d.actions / max) * 100)}%` }}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>{daily[0] ? formatDay(daily[0].day) : ""}</span>
                  <span>{daily.length ? formatDay(daily[daily.length - 1].day) : ""}</span>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Totais no período</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(data?.totals ?? {}).length === 0 && (
                    <span className="text-sm text-muted-foreground">Nenhuma atividade no período.</span>
                  )}
                  {Object.entries(data?.totals ?? {}).map(([k, v]) => (
                    <Badge key={k} variant="secondary">
                      {FEATURE_LABELS[k] ?? k}: {v}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">
                  {selected ? `Detalhe de ${formatDay(selected.day)}` : "Últimas ações"}
                </p>
                <div className="space-y-2">
                  {(selected
                    ? selected.items
                    : daily
                        .slice()
                        .reverse()
                        .flatMap((d) => d.items)
                        .slice(0, 25)
                  ).map((item, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 bg-muted/50 rounded-lg px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm truncate">{item.label ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          {FEATURE_LABELS[item.feature] ?? item.feature}
                          {item.detail ? ` · ${DRAWER_LABELS[item.detail] ?? item.detail}` : ""}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {new Date(item.at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                      </span>
                    </div>
                  ))}
                  {(selected ? selected.items.length : daily.reduce((a, d) => a + d.items.length, 0)) === 0 && (
                    <p className="text-sm text-muted-foreground">Nada registrado.</p>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}

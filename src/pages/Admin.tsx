import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Users, Activity, Sparkles, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserActivityDialog } from "@/components/admin/UserActivityDialog";
import { FEATURE_LABELS, DRAWER_LABELS } from "@/components/admin/featureLabels";

interface Metrics {
  overview: {
    total_users: number;
    new_users_7d: number;
    new_users_30d: number;
    onboarded_users: number;
    public_profiles: number;
    active_1d: number;
    active_7d: number;
    active_30d: number;
  };
  features: {
    feature: string;
    total: number;
    users_all: number;
    total_7d: number;
    users_7d: number;
    total_30d: number;
    users_30d: number;
  }[];
  daily: { day: string; active_users: number; actions: number; signups: number }[];
  drawers: { drawer_id: string; total: number; users: number }[];
  imports: { total: number; completed: number; failed: number };
  notifications: { total: number; read: number };
}

interface UserRow {
  id: string;
  username: string | null;
  handle: string | null;
  avatar_url: string | null;
  created_at: string;
  onboarded: boolean;
  titles: number;
  ratings: number;
  episodes: number;
  imports: number;
  last_activity: string | null;
}

function StatCard({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="bg-card rounded-lg p-4 border border-border">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function relativeDays(iso: string | null) {
  if (!iso) return { text: "Nunca usou", tone: "muted" as const };
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (diff <= 0) return { text: "Ativo hoje", tone: "good" as const };
  if (diff <= 7) return { text: `Ativo há ${diff}d`, tone: "ok" as const };
  return { text: `Inativo há ${diff}d`, tone: "muted" as const };
}

export default function Admin() {
  const [query, setQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  const { data: metrics, isLoading } = useQuery({
    queryKey: ["admin-metrics"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_usage_metrics");
      if (error) throw error;
      return data as unknown as Metrics;
    },
  });

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["admin-users", query],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_user_list", { _query: query, _limit: 50 });
      if (error) throw error;
      return (data ?? []) as unknown as UserRow[];
    },
  });

  const maxDaily = Math.max(1, ...(metrics?.daily ?? []).map((d) => d.actions));
  const totalUsers = metrics?.overview.total_users ?? 0;

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link to="/" aria-label="Voltar" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-heading font-bold text-lg">Painel de administração</h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-8">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <section className="space-y-3">
              <h2 className="font-heading font-bold flex items-center gap-2">
                <Users className="h-4 w-4" /> Visão geral
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Usuários" value={totalUsers} hint={`${metrics?.overview.onboarded_users ?? 0} concluíram onboarding`} />
                <StatCard label="Novos (7d)" value={metrics?.overview.new_users_7d ?? 0} hint={`${metrics?.overview.new_users_30d ?? 0} em 30d`} />
                <StatCard label="Ativos hoje" value={metrics?.overview.active_1d ?? 0} />
                <StatCard
                  label="Ativos (7d)"
                  value={metrics?.overview.active_7d ?? 0}
                  hint={`${metrics?.overview.active_30d ?? 0} em 30d`}
                />
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="font-heading font-bold flex items-center gap-2">
                <Activity className="h-4 w-4" /> Atividade nos últimos 30 dias
              </h2>
              <div className="bg-card rounded-lg p-4 border border-border">
                <div className="flex items-end gap-1 h-32">
                  {(metrics?.daily ?? []).map((d) => (
                    <div
                      key={d.day}
                      title={`${d.day}: ${d.actions} ações, ${d.active_users} usuários, ${d.signups} cadastros`}
                      className="flex-1 bg-primary/80 rounded-t min-h-[3px]"
                      style={{ height: `${Math.max(3, (d.actions / maxDaily) * 100)}%` }}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">Ações por dia (fuso de Brasília)</p>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="font-heading font-bold flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> Uso por funcionalidade
              </h2>
              <div className="bg-card rounded-lg border border-border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border">
                      <th className="p-3">Funcionalidade</th>
                      <th className="p-3">7d</th>
                      <th className="p-3">30d</th>
                      <th className="p-3">Total</th>
                      <th className="p-3">Adoção</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(metrics?.features ?? []).map((f) => (
                      <tr key={f.feature} className="border-b border-border/50 last:border-0">
                        <td className="p-3">{FEATURE_LABELS[f.feature] ?? f.feature}</td>
                        <td className="p-3">
                          {f.total_7d} <span className="text-muted-foreground">({f.users_7d} us.)</span>
                        </td>
                        <td className="p-3">
                          {f.total_30d} <span className="text-muted-foreground">({f.users_30d} us.)</span>
                        </td>
                        <td className="p-3">
                          {f.total} <span className="text-muted-foreground">({f.users_all} us.)</span>
                        </td>
                        <td className="p-3">
                          {totalUsers > 0 ? Math.round((f.users_all / totalUsers) * 100) : 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(metrics?.drawers ?? []).map((d) => (
                  <StatCard
                    key={d.drawer_id}
                    label={DRAWER_LABELS[d.drawer_id] ?? "Personalizada"}
                    value={d.total}
                    hint={`${d.users} usuários`}
                  />
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  label="Importações"
                  value={metrics?.imports.total ?? 0}
                  hint={`${metrics?.imports.completed ?? 0} concluídas · ${metrics?.imports.failed ?? 0} com erro`}
                />
                <StatCard
                  label="Notificações"
                  value={metrics?.notifications.total ?? 0}
                  hint={`${
                    metrics && metrics.notifications.total > 0
                      ? Math.round((metrics.notifications.read / metrics.notifications.total) * 100)
                      : 0
                  }% lidas`}
                />
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="font-heading font-bold">Usuários e atividade diária</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Buscar por @handle ou nome"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                {usersLoading && (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}
                {(users ?? []).map((u) => {
                  const rel = relativeDays(u.last_activity);
                  return (
                    <button
                      key={u.id}
                      onClick={() => setSelectedUser(u.id)}
                      className="w-full text-left bg-card border border-border rounded-lg p-3 flex items-center gap-3 hover:bg-muted/50 transition-colors"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={u.avatar_url ?? undefined} />
                        <AvatarFallback>{(u.username ?? "?").slice(0, 1).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {u.username ?? "Usuário"}{" "}
                          {u.handle && <span className="text-muted-foreground font-normal">@{u.handle}</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {u.titles} títulos · {u.ratings} notas · {u.episodes} eps · {u.imports} imports
                        </p>
                      </div>
                      <Badge variant={rel.tone === "good" ? "default" : rel.tone === "ok" ? "secondary" : "outline"}>
                        {rel.text}
                      </Badge>
                    </button>
                  );
                })}
                {!usersLoading && (users ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhum usuário encontrado.</p>
                )}
              </div>
            </section>
          </>
        )}
      </main>

      <UserActivityDialog
        userId={selectedUser}
        open={!!selectedUser}
        onOpenChange={(v) => !v && setSelectedUser(null)}
      />
    </div>
  );
}

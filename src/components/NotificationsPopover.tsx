import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bell, Check, Film, Trash2, Users, X, Calendar, RefreshCw, Heart, MessageCircle, Settings, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications, Notification, PendingItem } from "@/hooks/useNotifications";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatRelativeDate } from "@/lib/utils";
import { Content } from "@/lib/mockData";
import { supabase } from "@/integrations/supabase/client";
import { normalizeStoredContent } from "@/lib/contentNormalizer";
import { ContentDetailDialog } from "./ContentDetailDialog";
import { ActivityDetailDialog } from "./ActivityDetailDialog";
import { NotificationSettingsDialog } from "./NotificationSettingsDialog";
import { resolveAvatarSrc } from "./AvatarPickerDialog";
import { groupNotifications, InboxFilter, notificationContext, NotificationGroup } from "@/lib/notifications/grouping";
import { resolveNotificationContent } from "@/lib/notifications/destinations";

function NoticeIcon({ type }: { type: string }) {
  const Icon = type === "activity_like" ? Heart : type === "activity_comment" ? MessageCircle : type.startsWith("friend") || type === "shared_drawer_invite" ? Users : type === "streaming_change" ? RefreshCw : type === "upcoming_content" ? Calendar : Film;
  return <Icon className={`h-4 w-4 shrink-0 ${type === "activity_like" ? "text-destructive" : "text-primary"}`} />;
}
function NoticeRow({ group, open, remove, busy, seenAt, profiles, posters }: {
  group: NotificationGroup; open: (n: Notification) => void; remove: (n: Notification) => void; busy: boolean; seenAt: string | null;
  profiles: Map<string, { username: string | null; avatar_url: string | null }>; posters: Map<string, string>;
}) {
  const [expanded, setExpanded] = useState(false);
  const n = group.items[0];
  const actors = [...new Set(group.items.map(item => item.related_user_id).filter((id): id is string => !!id))];
  const profile = n.related_user_id ? profiles.get(n.related_user_id) : undefined;
  const groupedLikes = n.type === "activity_like" && actors.length > 1;
  const title = groupedLikes ? `${profile?.username || "Um amigo"} e mais ${actors.length - 1} ${actors.length === 2 ? "pessoa curtiram" : "pessoas curtiram"} sua atividade` : n.title;
  const image = n.related_user_id ? resolveAvatarSrc(profile?.avatar_url) : posters.get(n.related_content_id || "");
  const context = notificationContext(n);
  const source = typeof context.production_title === "string" ? context.production_title : undefined;
  const isNew = group.items.some(item => !item.is_read || (!!seenAt && item.created_at > seenAt));
  return <article className={`border-b border-border px-4 py-3 ${isNew ? "bg-primary/5" : ""}`}>
    <div className="flex items-start gap-3">
      <Avatar className={n.related_user_id ? "mt-1 h-10 w-10 shrink-0" : "mt-1 h-14 w-10 shrink-0 rounded-md"}>
        <AvatarImage src={image} alt="" className="object-cover" />
        <AvatarFallback className="rounded-md bg-muted"><NoticeIcon type={n.type} /></AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <Button variant="ghost" className="h-auto w-full justify-start whitespace-normal p-0 text-left hover:bg-transparent" onClick={() => open(n)} disabled={busy}>
          <span className="block min-w-0 space-y-1">
            <span className="block break-words text-sm font-medium">{title}</span>
            {source && <span className="block text-xs font-medium text-foreground">{source}</span>}
            {n.message && <span className="block break-words text-xs font-normal text-muted-foreground">{formatRelativeDate(n.message)}</span>}
          </span>
        </Button>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}</span>
          {isNew && <span className="font-medium text-primary">Novo</span>}
          {group.items.length > 1 && <Button variant="ghost" size="sm" className="h-6 gap-1 px-1 text-xs" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}><ChevronDown className="h-3 w-3" />{groupedLikes ? `${actors.length} pessoas` : `${group.items.length} avisos`}</Button>}
        </div>
        {expanded && <ul className="mt-2 space-y-2 border-l border-border pl-3">{group.items.map(item => <li key={item.id} className="text-xs"><Button variant="link" className="h-auto whitespace-normal p-0 text-left text-xs" onClick={() => open(item)}>{groupedLikes ? profiles.get(item.related_user_id || "")?.username || "Amigo" : item.message}</Button></li>)}</ul>}
      </div>
      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground" aria-label="Excluir aviso" title="Excluir aviso" onClick={() => remove(n)} disabled={busy}><Trash2 className="h-3.5 w-3.5" /></Button>
    </div>
  </article>;
}
export function NotificationsPopover() {
  const inbox = useNotifications();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [seenAt, setSeenAt] = useState<string | null>(null);
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [contentOpen, setContentOpen] = useState(false);
  const [recommendation, setRecommendation] = useState<{ notification: Notification; comment?: string | null } | null>(null);
  const [activity, setActivity] = useState<{ id: string; commentId?: string | null } | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const actorIds = [...new Set(inbox.notifications.map(n => n.related_user_id).filter((id): id is string => !!id))].sort();
  const contentIds = [...new Set(inbox.notifications.filter(n => !n.related_user_id && n.related_content_id).map(n => n.related_content_id as string))].sort();
  const media = useQuery({
    queryKey: ["notification-media", user?.id, actorIds, contentIds], enabled: popoverOpen && !!user,
    queryFn: async () => {
      const [profiles, titles] = await Promise.all([
        actorIds.length ? supabase.from("profiles").select("id,username,avatar_url").in("id", actorIds) : { data: [], error: null },
        contentIds.length && user ? supabase.from("user_drawer_assignments").select("production_id,production_type,production_data").eq("user_id", user.id).in("production_id", contentIds) : { data: [], error: null },
      ]);
      return { profiles: new Map((profiles.data || []).map(p => [p.id, p])), posters: new Map((titles.data || []).map(t => [t.production_id, normalizeStoredContent(t.production_data, { productionId: t.production_id, productionType: t.production_type }).posterUrl || ""])) };
    },
  });
  const openChange = (open: boolean) => {
    setPopoverOpen(open);
    if (open) { const cutoff = new Date().toISOString(); setSeenAt(cutoff); inbox.markAllAsRead.mutate(cutoff); inbox.refetch(); }
  };
  const openNotice = async (n: Notification) => {
    if (!user || processing) return;
    if (!n.is_read) inbox.markAsRead.mutate(n.id);
    if (n.type === "activity_like" || n.type === "activity_comment") {
      if (!n.related_content_id) return;
      setPopoverOpen(false); setActivity({ id: n.related_content_id, commentId: n.type === "activity_comment" ? n.event_id : null }); return;
    }
    if (n.type === "friend_request" || n.type === "friend_accepted") { setPopoverOpen(false); navigate("/friends"); return; }
    if (n.type === "shared_drawer_invite") {
      if (!n.related_content_id) return;
      setProcessing(n.id);
      const { data, error } = await supabase.from("shared_drawer_members").select("status").eq("drawer_id", n.related_content_id).eq("user_id", user.id).maybeSingle();
      setProcessing(null);
      if (error || !data) toast({ title: "Este convite não está mais disponível" });
      else if (data.status === "accepted") { setPopoverOpen(false); navigate(`/my-drawers?drawer=${n.related_content_id}`); }
      else toast({ title: "Convite aguardando sua resposta", description: "Responda na seção Pendências." });
      return;
    }
    setProcessing(n.id);
    try {
      const resolved = await resolveNotificationContent(n, user.id);
      setSelectedContent(resolved.content); setPopoverOpen(false);
      if (n.type === "recommendation") setRecommendation({ notification: n, comment: resolved.comment });
      else setContentOpen(true);
    } catch (error) { toast({ title: "Não foi possível abrir o aviso", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" }); }
    finally { setProcessing(null); }
  };
  const pendingCount = inbox.pending.friends.length + inbox.pending.drawers.length;
  const groups = groupNotifications(inbox.notifications, filter);
  const renderPending = (item: PendingItem, kind: "friends" | "drawers") => <div key={item.id} className="border-b border-border px-4 py-3">
    <div className="flex gap-3"><Avatar className="h-10 w-10 shrink-0"><AvatarImage src={resolveAvatarSrc(item.avatar_url)} alt="" /><AvatarFallback><Users className="h-4 w-4" /></AvatarFallback></Avatar><div className="min-w-0 flex-1"><p className="break-words text-sm font-medium">{item.username || "Um amigo"}</p><p className="break-words text-xs text-muted-foreground">{kind === "friends" ? "Quer ser seu amigo" : `Convidou você para ${item.name || "uma gavetta"}`}</p><div className="mt-2 flex gap-2"><Button size="sm" className="h-8 gap-1" disabled={inbox.respond.isPending} onClick={() => inbox.respond.mutate({ item, kind, accept: true })}><Check className="h-3.5 w-3.5" />Aceitar</Button><Button variant="outline" size="sm" className="h-8 gap-1" disabled={inbox.respond.isPending} onClick={() => inbox.respond.mutate({ item, kind, accept: false })}><X className="h-3.5 w-3.5" />Recusar</Button></div></div></div>
  </div>;
  return <>
    <Popover open={popoverOpen} onOpenChange={openChange}>
      <PopoverTrigger asChild><Button variant="ghost" size="icon" className="relative" aria-label={inbox.unreadCount ? `Notificações, ${inbox.unreadCount} não lidas` : "Notificações"}><Bell className="h-5 w-5" />{inbox.unreadCount > 0 && <Badge variant="destructive" className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center px-1 text-xs">{inbox.unreadCount > 99 ? "99+" : inbox.unreadCount}</Badge>}</Button></PopoverTrigger>
      <PopoverContent align="end" className="w-[min(420px,calc(100vw-24px))] p-0">
        <header className="flex items-center justify-between border-b border-border px-4 py-3"><h2 className="font-semibold">Notificações</h2><div className="flex gap-1">{inbox.unreadCount > 0 && <Button variant="ghost" size="icon" title="Marcar todas como lidas" aria-label="Marcar todas como lidas" onClick={() => inbox.markAllAsRead.mutate(new Date().toISOString())}><Check className="h-4 w-4" /></Button>}<Button variant="ghost" size="icon" title="Preferências de notificações" aria-label="Preferências de notificações" onClick={() => { setPopoverOpen(false); setSettingsOpen(true); }}><Settings className="h-4 w-4" /></Button></div></header>
        <div className="flex gap-1 border-b border-border px-3 py-2" role="group" aria-label="Filtrar notificações">{([{ id: "all", label: "Tudo" }, { id: "content", label: "Filmes e séries" }, { id: "social", label: "Social" }] as const).map(f => <Button key={f.id} size="sm" variant={filter === f.id ? "secondary" : "ghost"} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)} className="h-8 px-3 text-xs">{f.label}</Button>)}</div>
        <ScrollArea className="h-[min(560px,65vh)]">
          {inbox.error && <div className="p-4 text-sm" role="alert">Não foi possível carregar os avisos.<Button variant="link" onClick={inbox.refetch}>Tentar novamente</Button></div>}
          {filter !== "content" && pendingCount > 0 && <section><h3 className="flex items-center gap-2 bg-muted/40 px-4 py-2 text-xs font-semibold">Pendências <Badge variant="secondary">{pendingCount}</Badge></h3>{inbox.pending.friends.map(item => renderPending(item, "friends"))}{inbox.pending.drawers.map(item => renderPending(item, "drawers"))}</section>}
          {inbox.isLoading ? <Loader2 className="mx-auto my-8 h-6 w-6 animate-spin text-muted-foreground" /> : !groups.length ? <div className="flex flex-col items-center gap-2 py-12 text-sm text-muted-foreground"><Bell className="h-8 w-8" />Nenhum aviso por aqui</div> : groups.map((group, index) => <div key={group.id}>{(index === 0 || groups[index - 1].dateLabel !== group.dateLabel) && <h3 className="bg-muted/40 px-4 py-2 text-xs font-semibold">{group.dateLabel}</h3>}<NoticeRow group={group} open={openNotice} remove={n => inbox.deleteNotification.mutate(n.id)} busy={processing === group.items[0].id} seenAt={seenAt} profiles={media.data?.profiles || new Map()} posters={media.data?.posters || new Map()} /></div>)}
          {inbox.hasNextPage && <div className="p-3 text-center"><Button variant="ghost" size="sm" disabled={inbox.isFetchingNextPage} onClick={() => void inbox.fetchNextPage()}>{inbox.isFetchingNextPage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ChevronDown className="mr-2 h-4 w-4" />}Carregar mais</Button></div>}
        </ScrollArea>
      </PopoverContent>
    </Popover>
    <NotificationSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    <ActivityDetailDialog activityId={activity?.id || null} commentId={activity?.commentId} open={!!activity} onOpenChange={open => { if (!open) setActivity(null); }} />
    <ContentDetailDialog content={selectedContent} open={contentOpen || !!recommendation} onOpenChange={open => { setContentOpen(open); if (!open) { setRecommendation(null); setSelectedContent(null); } }} notificationComment={recommendation?.comment} />
  </>;
}

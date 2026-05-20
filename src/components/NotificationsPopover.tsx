import { useState } from "react";
import { Bell, Check, UserPlus, ThumbsUp, Film, Trash2, Users, CheckCircle, X, Tv, Calendar, RefreshCw, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications, Notification } from "@/hooks/useNotifications";
import { useSharedDrawers } from "@/hooks/useSharedDrawers";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Content } from "@/lib/mockData";
import { supabase } from "@/integrations/supabase/client";
import { normalizeStoredContent } from "@/lib/contentNormalizer";
import { ContentDetailDialog } from "./ContentDetailDialog";
import { formatRelativeDate } from "@/lib/utils";

const getNotificationIcon = (type: Notification["type"]) => {
  switch (type) {
    case "friend_request":
      return <UserPlus className="h-4 w-4 text-primary" />;
    case "friend_accepted":
      return <ThumbsUp className="h-4 w-4 text-green-500" />;
    case "recommendation":
      return <Film className="h-4 w-4 text-accent" />;
    case "shared_drawer_invite":
      return <Users className="h-4 w-4 text-purple-500" />;
    case "streaming_change":
      return <RefreshCw className="h-4 w-4 text-blue-500" />;
    case "new_season":
      return <Tv className="h-4 w-4 text-green-500" />;
    case "new_episodes":
      return <Tv className="h-4 w-4 text-emerald-400" />;
    case "upcoming_content":
      return <Calendar className="h-4 w-4 text-orange-500" />;
    case "rental_arrival":
      return <DollarSign className="h-4 w-4 text-accent" />;
    case "purchase_arrival":
      return <DollarSign className="h-4 w-4 text-accent" />;
    default:
      return <Bell className="h-4 w-4 text-muted-foreground" />;
  }
};

export function NotificationsPopover() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } =
    useNotifications();
  const { acceptInvite, rejectInvite } = useSharedDrawers();
  const { toast } = useToast();
  const [processing, setProcessing] = useState<string | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [contentDialogOpen, setContentDialogOpen] = useState(false);

  const handleAcceptDrawerInvite = async (notification: Notification) => {
    if (!notification.related_content_id) return;
    setProcessing(notification.id);
    try {
      await acceptInvite(notification.related_content_id);
      markAsRead.mutate(notification.id);
      toast({ title: "Gaveta aceita!", description: "Agora ela aparece nas suas gavettas." });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setProcessing(null);
    }
  };

  const handleRejectDrawerInvite = async (notification: Notification) => {
    if (!notification.related_content_id) return;
    setProcessing(notification.id);
    try {
      await rejectInvite(notification.related_content_id);
      deleteNotification.mutate(notification.id);
      toast({ title: "Convite recusado." });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setProcessing(null);
    }
  };

  const handleRecommendationClick = async (notification: Notification) => {
    if (!notification.related_content_id) return;
    
    markAsRead.mutate(notification.id);
    
    // Fetch the recommendation to get production_data
    const { data: rec } = await supabase
      .from("recommendations")
      .select("*")
      .eq("production_id", notification.related_content_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (rec) {
      const content = normalizeStoredContent(rec.production_data, {
        productionId: rec.production_id,
        productionType: rec.production_type,
      });
      setSelectedContent(content);
      setPopoverOpen(false);
      setContentDialogOpen(true);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (notification.type === "recommendation") {
      handleRecommendationClick(notification);
      return;
    }
    if (!notification.is_read) {
      markAsRead.mutate(notification.id);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setPopoverOpen(open);
    if (open && unreadCount > 0) {
      markAllAsRead.mutate();
    }
  };

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge
                className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs animate-[pulse_1.5s_cubic-bezier(0.4,0,0.6,1)_3]"
                variant="destructive"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
          <div className="flex items-center justify-between p-4 border-b">
            <h4 className="font-semibold">Notificações</h4>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => markAllAsRead.mutate()}
              >
                <Check className="h-3 w-3 mr-1" />
                Marcar todas
              </Button>
            )}
          </div>
          <ScrollArea className="h-80">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                <Bell className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">Nenhuma notificação</p>
              </div>
            ) : (
              <div className="divide-y">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={cn(
                      "p-4 hover:bg-accent/5 transition-colors cursor-pointer group",
                      !notification.is_read && "bg-primary/5"
                    )}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{notification.title}</p>
                        {notification.message && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                            {formatRelativeDate(notification.message)}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(notification.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </p>
                        {notification.type === "shared_drawer_invite" && !notification.is_read && (
                          <div className="flex gap-2 mt-2">
                            <Button
                              size="sm"
                              variant="default"
                              className="h-7 text-xs"
                              disabled={processing === notification.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAcceptDrawerInvite(notification);
                              }}
                            >
                              <CheckCircle className="h-3 w-3 mr-1" /> Aceitar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              disabled={processing === notification.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRejectDrawerInvite(notification);
                              }}
                            >
                              <X className="h-3 w-3 mr-1" /> Recusar
                            </Button>
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification.mutate(notification.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>

      <ContentDetailDialog
        content={selectedContent}
        open={contentDialogOpen}
        onOpenChange={setContentDialogOpen}
      />
    </>
  );
}

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tv, RefreshCw, Calendar, Film, DollarSign, ShoppingBag, CheckCheck, Heart, MessageCircle, Users, ThumbsUp, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface NotificationSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Preferences {
  streaming_changes: boolean;
  new_seasons: boolean;
  new_episodes: boolean;
  upcoming_content: boolean;
  rental_arrival: boolean;
  purchase_arrival: boolean;
  watched_availability: boolean;
  activity_likes: boolean;
  activity_comments: boolean;
  recommendations: boolean;
  friendship_updates: boolean;
}

const defaultPrefs: Preferences = {
  streaming_changes: true,
  new_seasons: true,
  new_episodes: true,
  upcoming_content: true,
  rental_arrival: true,
  purchase_arrival: true,
  watched_availability: false,
  activity_likes: true, activity_comments: true, recommendations: true, friendship_updates: true,
};

export function NotificationSettingsDialog({ open, onOpenChange }: NotificationSettingsDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<Preferences>(defaultPrefs);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!open || !user?.id) return;
    setLoading(true);
    setSaved(false);
    setLoadError(false);
    let active = true;

    (async () => {
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("streaming_changes, new_seasons, new_episodes, upcoming_content, rental_arrival, purchase_arrival, watched_availability, activity_likes, activity_comments, recommendations, friendship_updates")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!active) return;
      setLoadError(!!error);
      setPrefs(data ? data as Preferences : defaultPrefs);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [open, user?.id]);

  const handleToggle = async (key: keyof Preferences, value: boolean) => {
    if (!user?.id || saving || loading || loadError) return;
    setSaving(true);
    setSaved(false);
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);

    const { error } = await supabase
      .from("notification_preferences")
      .upsert(
        { user_id: user.id, ...updated },
        { onConflict: "user_id" }
      );

    setSaving(false);
    if (error) {
      setPrefs({ ...prefs });
      toast({ title: "Erro", description: "Não foi possível salvar.", variant: "destructive" });
    } else { setSaved(true); }
  };

  const settings = [
    {
      key: "streaming_changes" as const,
      icon: RefreshCw,
      label: "Mudanças de streaming",
      description: "Quando um título muda de plataforma (ex: sai da Netflix, entra no Prime)",
    },
    {
      key: "new_seasons" as const,
      icon: Film,
      label: "Novas temporadas",
      description: "Quando uma série ganha uma nova temporada",
    },
    {
      key: "new_episodes" as const,
      icon: Tv,
      label: "Novos episódios",
      description: "Quando novos episódios são lançados",
    },
    {
      key: "upcoming_content" as const,
      icon: Calendar,
      label: "Lançamentos em breve",
      description: "Episódios que serão lançados nos próximos 7 dias",
    },
    {
      key: "rental_arrival" as const,
      icon: DollarSign,
      label: "Disponível para alugar",
      description: "Quando um filme das suas gavetas chega para aluguel digital",
    },
    {
      key: "purchase_arrival" as const,
      icon: ShoppingBag,
      label: "Disponível para comprar",
      description: "Quando um filme das suas gavetas chega para compra digital",
    },
    {
      key: "watched_availability" as const,
      icon: CheckCheck,
      label: "Disponibilidade de assistidos",
      description: "Receber avisos de 'Disponível em' também para títulos que estão só na gavetta Assistidos",
    },
  ];
  const socialSettings = [
    { key: "activity_likes" as const, icon: Heart, label: "Curtidas", description: "Curtidas nas suas atividades" },
    { key: "activity_comments" as const, icon: MessageCircle, label: "Comentários", description: "Comentários nas suas atividades" },
    { key: "recommendations" as const, icon: Users, label: "Indicações", description: "Títulos indicados por amigos" },
    { key: "friendship_updates" as const, icon: ThumbsUp, label: "Amizades aceitas", description: "Respostas aos seus pedidos de amizade" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto z-[60]">
        <DialogHeader>
          <DialogTitle>Suas notificações</DialogTitle>
          <DialogDescription>
            Pedidos de amizade e convites continuam disponíveis até sua resposta.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-5 text-xs text-muted-foreground" role="status">{loadError ? "Não foi possível carregar. Feche e tente novamente." : loading ? "Carregando…" : saving ? "Salvando…" : saved ? "Preferências salvas" : ""}</div>
        {[{ name: "Filmes e séries", items: settings }, { name: "Social", items: socialSettings }].map(section => (
        <section key={section.name} className="space-y-1 border-t border-border py-2">
          <h3 className="py-2 text-sm font-semibold">{section.name}</h3>
          {section.items.map(({ key, icon: Icon, label, description }) => (
            <div
              key={key}
              className="flex items-center justify-between py-3 px-1 rounded-md"
            >
              <div className="flex min-w-0 items-center gap-3 pr-3">
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <Label className="text-sm font-medium">{label}</Label>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
              </div>
              <Switch
                checked={prefs[key]}
                onCheckedChange={(v) => handleToggle(key, v)}
                disabled={loading || saving || loadError}
                aria-label={label}
                className="shrink-0"
              />
            </div>
          ))}
        </section>
        ))}
      </DialogContent>
    </Dialog>
  );
}

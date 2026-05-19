import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tv, RefreshCw, Calendar, Film, DollarSign } from "lucide-react";
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
  vod_arrival: boolean;
}

const defaultPrefs: Preferences = {
  streaming_changes: true,
  new_seasons: true,
  new_episodes: true,
  upcoming_content: true,
  vod_arrival: true,
};

export function NotificationSettingsDialog({ open, onOpenChange }: NotificationSettingsDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<Preferences>(defaultPrefs);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !user?.id) return;
    setLoading(true);

    (async () => {
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("streaming_changes, new_seasons, new_episodes, upcoming_content, vod_arrival")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!error && data) {
        setPrefs(data as Preferences);
      }
      setLoading(false);
    })();
  }, [open, user?.id]);

  const handleToggle = async (key: keyof Preferences, value: boolean) => {
    if (!user?.id) return;
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);

    const { error } = await supabase
      .from("notification_preferences")
      .upsert(
        { user_id: user.id, ...updated },
        { onConflict: "user_id" }
      );

    if (error) {
      setPrefs({ ...prefs });
      toast({ title: "Erro", description: "Não foi possível salvar.", variant: "destructive" });
    }
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
      key: "vod_arrival" as const,
      icon: DollarSign,
      label: "Disponível para alugar",
      description: "Quando um filme das suas gavetas chega para aluguel ou compra digital",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Notificações de conteúdo</DialogTitle>
          <DialogDescription>
            Escolha quais avisos você quer receber sobre filmes e séries nas suas gavetas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1 py-2">
          {settings.map(({ key, icon: Icon, label, description }) => (
            <div
              key={key}
              className="flex items-center justify-between py-3 px-1 rounded-md"
            >
              <div className="flex items-center gap-3">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label className="text-sm font-medium">{label}</Label>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
              </div>
              <Switch
                checked={prefs[key]}
                onCheckedChange={(v) => handleToggle(key, v)}
                disabled={loading}
              />
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useCallback, useEffect, useState } from "react";
import { AvatarPickerDialog } from "@/components/AvatarPickerDialog";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export const AVATAR_SETUP_FINISHED_EVENT = "gavetta:avatar-setup-finished";

export function FirstAvatarSetup() {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [currentAvatar, setCurrentAvatar] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading || !user?.id) {
      setOpen(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("avatar_url, avatar_selected_at")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled || error || !data) return;
      setCurrentAvatar(data.avatar_url ?? "");
      setOpen(!data.avatar_selected_at);
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, user?.id]);

  const handleSelect = useCallback(async (avatarId: string) => {
    if (!user?.id || saving) return;
    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        avatar_url: avatarId,
        avatar_selected_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    setSaving(false);
    if (error) {
      toast({
        variant: "destructive",
        title: "Não foi possível salvar",
        description: "Tente escolher seu avatar novamente.",
      });
      setOpen(true);
      return;
    }

    setCurrentAvatar(avatarId);
    setOpen(false);
    window.dispatchEvent(new Event(AVATAR_SETUP_FINISHED_EVENT));
  }, [saving, toast, user?.id]);

  return (
    <AvatarPickerDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) setOpen(true);
      }}
      currentAvatar={currentAvatar}
      onSelectAvatar={(avatarId) => void handleSelect(avatarId)}
      onboarding
      saving={saving}
    />
  );
}
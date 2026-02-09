import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { User, Mail, Calendar, Globe, Lock, Bell, Camera, LogOut, ChevronRight, Shield } from "lucide-react";
import { AvatarPickerDialog, getAvatarById } from "@/components/AvatarPickerDialog";
import { EditProfileDialog } from "@/components/EditProfileDialog";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import { ProfileStats } from "@/components/ProfileStats";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function Profile() {
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<string>("joker");
  const [isLoading, setIsLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const { user, signOut } = useAuth();
  const { toast } = useToast();

  // Load avatar from database on mount
  useEffect(() => {
    async function loadAvatar() {
      if (!user?.id) return;
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('id', user.id)
          .single();
        if (error) console.error('Error loading avatar:', error);
        else if (data?.avatar_url) setSelectedAvatar(data.avatar_url);
      } catch (err) {
        console.error('Error loading avatar:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadAvatar();
  }, [user?.id]);

  const handleAvatarSelect = async (avatarId: string) => {
    setSelectedAvatar(avatarId);
    if (!user?.id) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarId })
        .eq('id', user.id);
      if (error) {
        toast({ title: "Erro", description: "Não foi possível salvar o avatar.", variant: "destructive" });
      } else {
        toast({ title: "Avatar atualizado!", description: "Seu novo avatar foi salvo." });
      }
    } catch (err) {
      console.error('Error saving avatar:', err);
    }
  };

  const avatarData = getAvatarById(selectedAvatar);

  const handleSignOut = async () => {
    await signOut();
    toast({ title: "Até logo!", description: "Você saiu da sua conta." });
  };

  const isGoogleUser = user?.app_metadata?.provider === "google";

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      
      <main className="container mx-auto px-4 py-6 max-w-lg">
        <h2 className="font-heading text-3xl font-bold text-foreground mb-6">
          Meu Perfil
        </h2>

        <div className="space-y-6">
          {/* Perfil do Usuário */}
          <div className="bg-card rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-4">
              <button onClick={() => setIsAvatarPickerOpen(true)} className="relative group">
                <Avatar className="h-20 w-20 cursor-pointer transition-all duration-200 group-hover:ring-2 group-hover:ring-primary/50">
                  {avatarData ? (
                    <AvatarImage src={avatarData.src} alt={avatarData.name} className="object-cover" />
                  ) : (
                    <AvatarFallback>{user?.email?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
                  )}
                </Avatar>
                <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="h-6 w-6 text-white" />
                </div>
              </button>
              <div className="flex-1">
                <h3 className="font-heading text-xl font-bold text-foreground">
                  {user?.user_metadata?.username || "Usuário"}
                </h3>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={() => setIsEditProfileOpen(true)}>
              <User className="h-4 w-4 mr-2" />
              Editar Perfil
            </Button>
          </div>

          <Separator />

          {/* Estatísticas */}
          <ProfileStats />

          <Separator />

          {/* Informações */}
          <div className="bg-card rounded-lg p-6 space-y-4">
            <h3 className="font-heading font-bold text-foreground mb-4">Informações</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{user?.email}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  Membro desde {user?.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR') : '-'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  Login via {isGoogleUser ? "Google" : "Email"}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Brasil</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Tema */}
          <div className="bg-card rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base font-medium">Tema</Label>
                <p className="text-sm text-muted-foreground">Alternar entre claro e escuro</p>
              </div>
              <ThemeToggle />
            </div>
          </div>

          <Separator />

          {/* Configurações */}
          <div className="bg-card rounded-lg p-6 space-y-1">
            <h3 className="font-heading font-bold text-foreground mb-4">Configurações</h3>

            {/* Alterar senha - apenas para login por email */}
            {!isGoogleUser && (
              <button
                onClick={() => setIsChangePasswordOpen(true)}
                className="w-full flex items-center justify-between py-3 px-1 rounded-md hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-foreground">Alterar Senha</p>
                    <p className="text-xs text-muted-foreground">Atualize sua senha de acesso</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            )}

            {/* Notificações */}
            <div className="flex items-center justify-between py-3 px-1">
              <div className="flex items-center gap-3">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Notificações</p>
                  <p className="text-xs text-muted-foreground">Pedidos de amizade e recomendações</p>
                </div>
              </div>
              <Switch
                checked={notificationsEnabled}
                onCheckedChange={setNotificationsEnabled}
              />
            </div>
          </div>

          <Separator />

          {/* Sair */}
          <div className="bg-card rounded-lg p-6">
            <Button variant="destructive" className="w-full" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sair da Conta
            </Button>
          </div>

          {/* Sobre */}
          <div className="bg-card rounded-lg p-6 space-y-2">
            <h3 className="font-heading font-bold text-foreground">Sobre</h3>
            <p className="text-sm text-muted-foreground">Gavetta • Versão 1.0.0</p>
            <p className="text-xs text-muted-foreground">Organize suas séries e filmes favoritos.</p>
          </div>
        </div>
      </main>

      <BottomNav />

      <AvatarPickerDialog
        open={isAvatarPickerOpen}
        onOpenChange={setIsAvatarPickerOpen}
        currentAvatar={selectedAvatar}
        onSelectAvatar={handleAvatarSelect}
      />
      <EditProfileDialog open={isEditProfileOpen} onOpenChange={setIsEditProfileOpen} />
      <ChangePasswordDialog open={isChangePasswordOpen} onOpenChange={setIsChangePasswordOpen} />
    </div>
  );
}

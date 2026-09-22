import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, Lock, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/hooks/useAnalytics";

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  hasPassword: boolean;
}

export function ChangePasswordDialog({ open, onOpenChange, email, hasPassword }: ChangePasswordDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!open) setSent(false);
  }, [open]);

  const handleSendLink = async () => {
    if (!email) return;
    setLoading(true);
    trackEvent(hasPassword ? "password_change_start" : "password_create_start");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);

    if (error) {
      trackEvent(hasPassword ? "password_change_error" : "password_create_error");
      toast({
        variant: "destructive",
        title: "Não foi possível enviar",
        description: error.message.toLowerCase().includes("rate limit")
          ? "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente."
          : "Tente novamente em alguns instantes.",
      });
      return;
    }

    trackEvent(hasPassword ? "password_change_link_sent" : "password_create_link_sent");
    setSent(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{hasPassword ? "Alterar senha" : "Criar senha"}</DialogTitle>
          <DialogDescription>
            {hasPassword
              ? "Enviaremos um link seguro para trocar a senha da sua conta."
              : "Crie uma senha para entrar com o mesmo email e manter suas Gavettas."}
          </DialogDescription>
        </DialogHeader>
        {sent ? (
          <div className="space-y-4 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-primary" aria-hidden="true" />
            <div>
              <p className="font-medium text-foreground">Confira seu email</p>
              <p className="mt-1 text-sm text-muted-foreground">Enviamos o link para {email}.</p>
            </div>
            <Button onClick={() => onOpenChange(false)} className="w-full">Entendi</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-md border border-border bg-muted/30 p-3">
              <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 truncate text-sm text-foreground">{email}</span>
            </div>
            <Button onClick={handleSendLink} className="w-full" disabled={loading || !email}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
              {hasPassword ? "Enviar link para alterar" : "Enviar link para criar senha"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { FormEvent, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/hooks/useAnalytics";
import gavettaLogo from "@/assets/gavettalogo.png";
import { getPasswordErrorMessage, PASSWORD_HELP } from "@/lib/passwordGuidance";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [checkingLink, setCheckingLink] = useState(true);
  const [validRecovery, setValidRecovery] = useState(false);
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const recoveryInUrl = window.location.hash.includes("type=recovery") || window.location.search.includes("type=recovery");
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (recoveryInUrl && session)) setValidRecovery(true);
      setCheckingLink(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (recoveryInUrl && session) setValidRecovery(true);
      setCheckingLink(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 6) {
      toast({ variant: "destructive", title: "Senha muito curta", description: "Use pelo menos 6 caracteres." });
      return;
    }
    if (password !== confirmation) {
      toast({ variant: "destructive", title: "As senhas não coincidem", description: "Digite a mesma senha nos dois campos." });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      trackEvent("password_reset_error");
      const passwordRejected = /password|weak|pwned|known|leaked/i.test(error.message);
      toast({
        variant: "destructive",
        title: "Não foi possível alterar",
        description: passwordRejected
          ? getPasswordErrorMessage(error.message)
          : "O link pode ter expirado. Solicite um novo link.",
      });
      return;
    }

    trackEvent("password_reset_complete");
    setComplete(true);
    window.setTimeout(() => navigate("/", { replace: true }), 1500);
  };

  return (
    <main className="flex min-h-screen items-start justify-center bg-background p-4 py-8 md:items-center">
      <Helmet>
        <title>Nova senha · Gavetta</title>
        <meta name="description" content="Crie uma nova senha para sua conta Gavetta." />
      </Helmet>
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <img src={gavettaLogo} alt="Gavetta" className="h-12 w-auto" />
        </div>
        <Card className="border-border/50 shadow-lg">
          {checkingLink ? (
            <CardContent className="flex min-h-48 items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-primary" aria-label="Validando link" />
            </CardContent>
          ) : complete ? (
            <CardHeader className="text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-primary" aria-hidden="true" />
              <CardTitle>Senha alterada</CardTitle>
              <CardDescription>Sua conta está pronta. Entrando no Gavetta…</CardDescription>
            </CardHeader>
          ) : !validRecovery ? (
            <>
              <CardHeader>
                <CardTitle>Link inválido ou expirado</CardTitle>
                <CardDescription>Solicite um novo link para trocar sua senha com segurança.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full"><Link to="/forgot-password">Pedir novo link</Link></Button>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <CardTitle>Crie uma nova senha</CardTitle>
                <CardDescription>Escolha uma senha que você ainda não usa em outros serviços.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">Nova senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="new-password" type={showPassword ? "text" : "password"} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="pl-10 pr-10" minLength={6} required autoFocus />
                      <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>
                        {showPassword ? <EyeOff /> : <Eye />}
                      </Button>
                    </div>
                   <p className="text-xs text-muted-foreground">{PASSWORD_HELP}</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-new-password">Confirme a nova senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="confirm-new-password" type={showPassword ? "text" : "password"} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="pl-10" minLength={6} required />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" size="lg" disabled={loading}>
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Salvar nova senha
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </main>
  );
}
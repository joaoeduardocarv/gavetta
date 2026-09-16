import { FormEvent, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Loader2, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/hooks/useAnalytics";
import gavettaLogo from "@/assets/gavettalogo.png";

export default function ForgotPassword() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    trackEvent("password_recovery_start");

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);
    if (error) {
      trackEvent("password_recovery_error");
      toast({
        variant: "destructive",
        title: "Não foi possível enviar",
        description: error.message.toLowerCase().includes("rate limit")
          ? "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente."
          : "Confira o email e tente novamente.",
      });
      return;
    }

    trackEvent("password_recovery_sent");
    setSent(true);
  };

  return (
    <main className="flex min-h-screen items-start justify-center bg-background p-4 py-8 md:items-center">
      <Helmet>
        <title>Recuperar senha · Gavetta</title>
        <meta name="description" content="Recupere sua senha do Gavetta por email." />
      </Helmet>
      <div className="w-full max-w-md space-y-6">
        <Link to="/auth" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar para entrar
        </Link>
        <div className="flex justify-center">
          <img src={gavettaLogo} alt="Gavetta" className="h-12 w-auto" />
        </div>
        <Card className="border-border/50 shadow-lg">
          {sent ? (
            <>
              <CardHeader className="text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-primary" aria-hidden="true" />
                <CardTitle>Confira seu email</CardTitle>
                <CardDescription>
                  Se existir uma conta com esse email, você receberá um link para criar uma nova senha.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full" variant="outline" onClick={() => setSent(false)}>
                  Enviar novamente
                </Button>
                <Button asChild className="w-full" variant="ghost">
                  <Link to="/auth">Voltar para entrar</Link>
                </Button>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <CardTitle>Esqueceu sua senha?</CardTitle>
                <CardDescription>Digite seu email e enviaremos um link seguro para você voltar à sua conta.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="recovery-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="recovery-email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        className="pl-10"
                        placeholder="seu@email.com"
                        required
                        autoFocus
                        disabled={loading}
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" size="lg" disabled={loading}>
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Enviar link de recuperação
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
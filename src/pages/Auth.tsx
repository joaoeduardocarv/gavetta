import { useState, useEffect, useLayoutEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, User, AtSign, Loader2, CheckCircle2, HelpCircle } from "lucide-react";
import gavetaLogo from "@/assets/gavettalogo.png";
import { z } from "zod";
import { allAvatars } from "@/components/AvatarPickerDialog";
import { cn } from "@/lib/utils";
import { checkEmailPolicy } from "@/lib/emailPolicy";

const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, { message: "Informe seu email ou @" })
    .refine(
      (v) =>
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ||
        /^@?[a-zA-Z0-9_]{3,30}$/.test(v),
      { message: "Informe um email válido ou um @ (ex.: @maria_silva)" }
    ),
  password: z.string().min(6, { message: "Senha deve ter pelo menos 6 caracteres" }),
});

// Ordem dos campos = ordem visual do formulário (username → handle → email → password).
// Isso garante que o primeiro erro mostrado no toast corresponda ao primeiro campo
// visível com problema, evitando confusão do usuário.
const signupSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2, { message: "Nome deve ter pelo menos 2 caracteres" })
    .max(50, { message: "Nome deve ter no máximo 50 caracteres" })
    // Mesma regra da trigger handle_new_user (POSIX [:alpha:][:digit:] + _ - . ' espaço)
    .regex(/^[\p{L}\p{N}_\-\. ']+$/u, {
      message: "Nome só pode conter letras, números, espaços, _ - . e '",
    }),
  handle: z
    .string()
    .trim()
    .min(3, { message: "@ deve ter pelo menos 3 caracteres" })
    .max(30, { message: "@ deve ter no máximo 30 caracteres" })
    .regex(/^[a-zA-Z0-9_]+$/, {
      message: "@ só pode conter letras minúsculas, números e _",
    })
    .transform((v) => v.toLowerCase()),
  email: z
    .string()
    .trim()
    .min(1, { message: "Informe seu email" })
    .email({ message: "Email inválido" })
    .superRefine((v, ctx) => {
      const result = checkEmailPolicy(v);
      if (!result.ok) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.reason ?? "Email inválido" });
      }
    }),
  password: z.string().min(6, { message: "Senha deve ter pelo menos 6 caracteres" }),
});

// Normaliza nome → handle base (remove acentos, espaços, símbolos)
function normalizeToHandle(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 26);
}

export default function Auth() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState(searchParams.get("username") ?? "");
  const [handle, setHandle] = useState(searchParams.get("handle") ?? "");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [selectedAvatar, setSelectedAvatar] = useState("");
  const [lastSignupError, setLastSignupError] = useState(false);
  const [handleEdited, setHandleEdited] = useState(!!searchParams.get("handle"));
  const [suggestingHandle, setSuggestingHandle] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [previousTheme, setPreviousTheme] = useState<string | undefined>();

  useLayoutEffect(() => {
    setPreviousTheme(theme);
    setTheme("light");
  }, []);

  useEffect(() => {
    return () => {
      if (previousTheme) {
        setTheme(previousTheme);
      }
    };
  }, [previousTheme, setTheme]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        navigate("/", { replace: true });
      }
      setCheckingSession(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        navigate("/", { replace: true });
      }
      setCheckingSession(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Auto-sugere @ baseado no nome (se usuário ainda não editou o @)
  const handleUsernameChange = (value: string) => {
    setUsername(value);
    if (!handleEdited) {
      const suggested = normalizeToHandle(value);
      if (suggested.length >= 3) setHandle(suggested);
      else setHandle("");
    }
  };

  // Pede ao backend uma sugestão de @ única
  const suggestUniqueHandle = async () => {
    const base = username.trim() || handle.trim();
    if (!base) {
      toast({ variant: "destructive", title: "Digite seu nome primeiro", description: "Precisamos do seu nome para sugerir um @." });
      return;
    }
    setSuggestingHandle(true);
    const { data, error } = await supabase.rpc("suggest_handle_from_username" as any, { _username: base });
    setSuggestingHandle(false);
    if (error || !data) {
      toast({ variant: "destructive", title: "Não consegui sugerir", description: "Tente digitar um @ manualmente." });
      return;
    }
    setHandle(data as string);
    setHandleEdited(true);
    toast({ title: "@ sugerido", description: `Usaremos @${data}. Você pode editar se quiser.` });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const identifier = email.trim();
    const validation = loginSchema.safeParse({ identifier, password });
    if (!validation.success) {
      toast({
        variant: "destructive",
        title: "Erro de validação",
        description: validation.error.errors[0].message,
      });
      return;
    }

    setLoading(true);

    // Resolve handle → email se o usuário digitou um @ em vez de email
    let loginEmail = identifier;
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
    if (!isEmail) {
      const rawHandle = identifier.startsWith("@") ? identifier.slice(1) : identifier;
      const { data: resolvedEmail, error: rpcError } = await supabase.rpc(
        "get_email_by_handle" as any,
        { _handle: rawHandle }
      );
      if (rpcError || !resolvedEmail) {
        setLoading(false);
        toast({
          variant: "destructive",
          title: "Erro ao entrar",
          description: "Não encontramos uma conta com esse @. Verifique e tente novamente.",
        });
        return;
      }
      loginEmail = resolvedEmail as string;
    }

    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
    setLoading(false);

    if (error) {
      if (error.message === "Email not confirmed") {
        setConfirmationEmail(loginEmail);
        setShowConfirmation(true);
        toast({
          variant: "destructive",
          title: "Email não confirmado",
          description: "Verifique sua caixa de entrada para confirmar seu email.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Erro ao entrar",
          description: error.message === "Invalid login credentials"
            ? "Email/@ ou senha incorretos. Verifique e tente novamente."
            : error.message,
        });
      }
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = signupSchema.safeParse({ username, handle, email, password });
    if (!validation.success) {
      toast({
        variant: "destructive",
        title: "Erro de validação",
        description: validation.error.errors[0].message,
      });
      return;
    }

    if (!selectedAvatar) {
      toast({
        variant: "destructive",
        title: "Escolha um avatar",
        description: "Selecione um avatar para continuar.",
      });
      return;
    }

    setLoading(true);
    const redirectUrl = `${window.location.origin}/`;
    
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          username: username.trim(),
          handle: handle.trim().toLowerCase(),
          avatar_url: selectedAvatar,
        },
      },
    });
    setLoading(false);

    if (error) {
      setLastSignupError(true);
      const msg = error.message || "";
      let description = msg;
      if (msg.includes("already registered") || msg.includes("already been registered") || msg.includes("User already registered")) {
        description = "Este email já está cadastrado. Tente fazer login.";
      } else if (msg.includes("Invalid username")) {
        description = "Nome inválido: use apenas letras, números, espaços, _ e -. Mínimo 2, máximo 50 caracteres.";
      } else if (msg.includes("Invalid handle")) {
        description = "@ inválido: use apenas letras minúsculas, números e _. Mínimo 3, máximo 30 caracteres.";
      } else if (msg.includes("Invalid avatar_url")) {
        description = "URL do avatar inválida.";
      } else if (msg.toLowerCase().includes("password") && (msg.toLowerCase().includes("weak") || msg.toLowerCase().includes("pwned") || msg.toLowerCase().includes("known"))) {
        description = "Essa senha é muito comum e já apareceu em vazamentos. Escolha uma senha mais forte (use letras, números e símbolos).";
      } else if (msg.includes("Password should be at least")) {
        description = "A senha deve ter pelo menos 6 caracteres.";
      } else if (msg.includes("Unable to validate email") || msg.toLowerCase().includes("invalid email")) {
        description = "Email inválido. Verifique e tente novamente.";
      } else if (msg.includes("duplicate key")) {
        if (msg.includes("handle")) {
          description = "Este @ já está em uso. Escolha outro nome de usuário.";
        } else if (msg.includes("username")) {
          description = "Esse nome já está em uso. Escolha outro.";
        } else {
          description = "Esse cadastro já existe. Tente outro email ou @.";
        }
      } else if (msg.includes("Database error saving new user") || msg.includes("unexpected_failure")) {
        description = "Não conseguimos criar sua conta agora. Verifique se o @ ou email já estão em uso e tente novamente.";
      } else if (msg.toLowerCase().includes("rate limit") || msg.includes("over_email_send_rate_limit")) {
        description = "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.";
      }
      const helpUrl = `/signup-help?email=${encodeURIComponent(email)}&handle=${encodeURIComponent(handle)}&username=${encodeURIComponent(username)}`;
      toast({
        variant: "destructive",
        title: "Erro ao cadastrar",
        description,
        action: (
          <button
            type="button"
            onClick={() => navigate(helpUrl)}
            className="shrink-0 rounded-md border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 transition"
          >
            Diagnosticar
          </button>
        ),
      });
    } else if (data.user && !data.session) {
      // User created but needs email confirmation
      setConfirmationEmail(email);
      setShowConfirmation(true);
    } else if (data.session) {
      // Auto-confirmed (shouldn't happen with current config, but handle gracefully)
      navigate("/", { replace: true });
    }
  };

  const handleResendConfirmation = async () => {
    if (resendCooldown > 0) return;
    
    setLoading(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: confirmationEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
      },
    });
    setLoading(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao reenviar",
        description: error.message,
      });
    } else {
      setResendCooldown(60);
      toast({
        title: "Email reenviado!",
        description: "Verifique sua caixa de entrada e spam.",
      });
    }
  };

  const handleGoogleLogin = async () => {
    if (googleLoading) return;
    setGoogleLoading(true);
    
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });

    if (result?.error) {
      setGoogleLoading(false);
      toast({
        variant: "destructive",
        title: "Erro ao entrar com Google",
        description: result.error instanceof Error ? result.error.message : "Falha na autenticação com Google. Tente novamente.",
      });
    }
    // If redirected, loading stays true until redirect completes
  };

  const handleBackToLogin = () => {
    setShowConfirmation(false);
    setConfirmationEmail("");
    setEmail("");
    setPassword("");
    setUsername("");
    setHandle("");
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (showConfirmation) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-start md:justify-center p-4 py-8 overflow-y-auto">
        <div className="w-full max-w-md space-y-6">
          <div className="flex flex-col items-center gap-2">
            <img src={gavetaLogo} alt="Gavetta" className="h-12 w-auto" />
          </div>

          <Card className="border-border/50 shadow-lg">
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <CheckCircle2 className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-xl">Confirme seu email</CardTitle>
              <CardDescription className="mt-2">
                Enviamos um link de confirmação para{" "}
                <span className="font-medium text-foreground">{confirmationEmail}</span>.
                Verifique sua caixa de entrada e clique no link para ativar sua conta.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Não recebeu o email? Verifique a pasta de spam ou clique abaixo para reenviar.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleResendConfirmation}
                disabled={loading || resendCooldown > 0}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {resendCooldown > 0
                  ? `Reenviar em ${resendCooldown}s`
                  : "Reenviar email de confirmação"}
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={handleBackToLogin}
              >
                Voltar para o login
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const isAnyLoading = loading || googleLoading;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-start md:justify-center p-4 py-8 overflow-y-auto">
      <Helmet>
        <title>Entrar ou Cadastrar · Gavetta</title>
        <meta name="description" content="Acesse o Gavetta para organizar seus filmes e séries. Login com email ou Google." />
        <link rel="canonical" href="https://gavetta.com.br/auth" />
      </Helmet>
      <h1 className="sr-only">Entrar ou criar conta no Gavetta</h1>
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2">
          <img src={gavetaLogo} alt="Gavetta" className="h-12 w-auto" />
          <p className="text-muted-foreground text-sm">Organize suas séries e filmes</p>
        </div>

        <Card className="border-border/50 shadow-lg">
          <Tabs defaultValue="login" className="w-full">
            <CardHeader className="pb-2">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login" disabled={isAnyLoading}>Entrar</TabsTrigger>
                <TabsTrigger value="signup" disabled={isAnyLoading}>Cadastrar</TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent className="pt-4">
              <TabsContent value="login" className="mt-0 space-y-4">
                <CardTitle className="text-xl">Bem-vindo de volta!</CardTitle>
                <CardDescription>Entre na sua conta para continuar</CardDescription>
                
                <form onSubmit={handleLogin} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email ou @</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-email"
                        type="text"
                        inputMode="email"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        placeholder="seu@email.com ou @seu_usuario"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        required
                        disabled={isAnyLoading}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10"
                        required
                        disabled={isAnyLoading}
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={isAnyLoading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Entrar
                  </Button>
                </form>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">ou continue com</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleGoogleLogin}
                  disabled={isAnyLoading}
                >
                  {googleLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                  )}
                  Google
                </Button>
              </TabsContent>

              <TabsContent value="signup" className="mt-0 space-y-4">
                <CardTitle className="text-xl">Criar conta</CardTitle>
                <CardDescription>Cadastre-se para começar a organizar</CardDescription>
                
                <form onSubmit={handleSignup} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-username">Nome de exibição</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-username"
                        type="text"
                        placeholder="Seu nome (ex: João da Silva)"
                        value={username}
                        onChange={(e) => handleUsernameChange(e.target.value)}
                        className="pl-10"
                        required
                        disabled={isAnyLoading}
                        maxLength={50}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Pode ter acentos, espaços e se repetir entre usuários.</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="signup-handle">@ Nome de usuário (único)</Label>
                      <button
                        type="button"
                        onClick={suggestUniqueHandle}
                        disabled={isAnyLoading || suggestingHandle}
                        className="text-xs text-primary hover:underline disabled:opacity-50"
                      >
                        {suggestingHandle ? "Sugerindo..." : "Sugerir @ disponível"}
                      </button>
                    </div>
                    <div className="relative">
                      <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-handle"
                        type="text"
                        placeholder="seu_usuario"
                        value={handle}
                        onChange={(e) => {
                          setHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase());
                          setHandleEdited(true);
                        }}
                        className="pl-10"
                        required
                        disabled={isAnyLoading}
                        maxLength={30}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Apenas letras minúsculas, números e _. Seus amigos te encontrarão por esse @.</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="seu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        required
                        disabled={isAnyLoading}
                      />
                    </div>
                  </div>

                  {/* Avatar Picker */}
                  <div className="space-y-2">
                    <Label>Escolha seu avatar <span className="text-destructive">*</span></Label>
                    <div className="grid grid-cols-6 gap-2 max-h-[140px] overflow-y-auto p-1">
                      {allAvatars.map((avatar) => (
                        <button
                          key={avatar.id}
                          type="button"
                          onClick={() => setSelectedAvatar(avatar.id)}
                          disabled={isAnyLoading}
                          className={cn(
                            "aspect-square rounded-full overflow-hidden border-2 transition-all duration-150 hover:scale-105",
                            selectedAvatar === avatar.id
                              ? "border-primary ring-2 ring-primary/50"
                              : "border-transparent hover:border-muted-foreground/30"
                          )}
                          title={avatar.name}
                        >
                          <img src={avatar.src} alt={avatar.name} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                    {!selectedAvatar && (
                      <p className="text-xs text-muted-foreground">Toque em um personagem para selecioná-lo.</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10"
                        required
                        disabled={isAnyLoading}
                        minLength={6}
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={isAnyLoading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Cadastrar
                  </Button>

                  <Link
                    to={`/signup-help?email=${encodeURIComponent(email)}&handle=${encodeURIComponent(handle)}&username=${encodeURIComponent(username)}`}
                    className={cn(
                      "flex items-center justify-center gap-1.5 text-xs underline-offset-4 hover:underline transition-colors",
                      lastSignupError
                        ? "text-destructive font-medium"
                        : "text-muted-foreground"
                    )}
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                    {lastSignupError
                      ? "Algo deu errado. Diagnosticar problema →"
                      : "Está com problemas? Diagnosticar cadastro"}
                  </Link>
                </form>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">ou continue com</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleGoogleLogin}
                  disabled={isAnyLoading}
                >
                  {googleLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                  )}
                  Google
                </Button>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}

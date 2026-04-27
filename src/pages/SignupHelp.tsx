import { useState, useEffect, useLayoutEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, AtSign, User, Lock, ArrowLeft, Loader2, CheckCircle2, AlertCircle, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import gavetaLogo from "@/assets/gavettalogo.png";

type CheckStatus = "idle" | "checking" | "ok" | "error";

interface FieldDiagnosis {
  status: CheckStatus;
  message: string;
  hint?: string;
}

const COMMON_WEAK_PASSWORDS = new Set([
  "12345678", "123456789", "1234567890", "password", "senha123",
  "qwerty123", "11111111", "00000000", "abc12345", "password1",
]);

function diagnoseEmail(email: string): FieldDiagnosis {
  const v = email.trim();
  if (!v) return { status: "idle", message: "Informe seu email para verificar." };
  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(v)) {
    return {
      status: "error",
      message: "Formato de email inválido.",
      hint: "Use o formato nome@dominio.com (ex.: maria@gmail.com).",
    };
  }
  return { status: "ok", message: "Formato válido." };
}

function diagnoseHandle(handle: string): FieldDiagnosis {
  const v = handle.trim();
  if (!v) return { status: "idle", message: "Informe um @ para verificar." };
  if (v.length < 3) {
    return {
      status: "error",
      message: "@ muito curto.",
      hint: "O @ precisa ter pelo menos 3 caracteres.",
    };
  }
  if (v.length > 30) {
    return {
      status: "error",
      message: "@ muito longo.",
      hint: "Use no máximo 30 caracteres.",
    };
  }
  if (/\\s/.test(v)) {
    return {
      status: "error",
      message: "@ não pode conter espaços.",
      hint: "Troque os espaços por _ (ex.: maria_silva).",
    };
  }
  if (!/^[a-z0-9_]+$/.test(v.toLowerCase())) {
    return {
      status: "error",
      message: "@ contém caracteres inválidos.",
      hint: "Use apenas letras minúsculas, números e _ (sem acentos, hífen ou pontos).",
    };
  }
  return { status: "ok", message: "Formato válido." };
}

function diagnoseUsername(name: string): FieldDiagnosis {
  const v = name.trim();
  if (!v) return { status: "idle", message: "Informe seu nome para verificar." };
  if (v.length < 2) {
    return {
      status: "error",
      message: "Nome muito curto.",
      hint: "O nome precisa ter pelo menos 2 caracteres.",
    };
  }
  if (v.length > 50) {
    return {
      status: "error",
      message: "Nome muito longo.",
      hint: "Use no máximo 50 caracteres.",
    };
  }
  if (!/^[a-zA-Z0-9 _-]+$/.test(v)) {
    return {
      status: "error",
      message: "Nome contém caracteres inválidos.",
      hint: "Use apenas letras, números, espaços, _ e -. Não use acentos, pontos ou emojis.",
    };
  }
  return { status: "ok", message: "Formato válido." };
}

function diagnosePassword(password: string): FieldDiagnosis {
  if (!password) return { status: "idle", message: "Informe uma senha para verificar." };
  if (password.length < 6) {
    return {
      status: "error",
      message: "Senha muito curta.",
      hint: "Use pelo menos 6 caracteres.",
    };
  }
  if (COMMON_WEAK_PASSWORDS.has(password.toLowerCase())) {
    return {
      status: "error",
      message: "Senha muito comum.",
      hint: "Essa senha aparece em vazamentos públicos. Combine letras, números e símbolos (ex.: G@vetta2026!).",
    };
  }
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  if (!hasLetter || !hasNumber) {
    return {
      status: "error",
      message: "Senha pouco segura.",
      hint: "Combine letras e números. Adicione um símbolo para ficar ainda mais forte.",
    };
  }
  return { status: "ok", message: "Boa! Essa senha parece segura." };
}

function FieldRow({
  icon,
  label,
  diagnosis,
  takenLabel,
}: {
  icon: React.ReactNode;
  label: string;
  diagnosis: FieldDiagnosis;
  takenLabel?: string;
}) {
  const showTaken = diagnosis.status === "error" && diagnosis.message === takenLabel;
  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-colors",
        diagnosis.status === "error" && "border-destructive/40 bg-destructive/5",
        diagnosis.status === "ok" && "border-green-500/40 bg-green-500/5",
        diagnosis.status === "checking" && "border-border bg-muted/30",
        diagnosis.status === "idle" && "border-border bg-card"
      )}
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5 text-muted-foreground">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{label}</span>
            {diagnosis.status === "checking" && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            {diagnosis.status === "ok" && <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" />}
            {diagnosis.status === "error" && <AlertCircle className="h-4 w-4 text-destructive" />}
          </div>
          <p
            className={cn(
              "text-sm mt-0.5",
              diagnosis.status === "error" && "text-destructive",
              diagnosis.status === "ok" && "text-green-700 dark:text-green-500",
              (diagnosis.status === "idle" || diagnosis.status === "checking") && "text-muted-foreground"
            )}
          >
            {diagnosis.message}
          </p>
          {diagnosis.hint && (
            <p className="text-xs text-muted-foreground mt-1">💡 {diagnosis.hint}</p>
          )}
          {showTaken && (
            <Link
              to="/auth"
              className="text-xs text-primary underline mt-1 inline-block"
            >
              Já tenho conta — fazer login →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SignupHelp() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { theme, setTheme } = useTheme();
  const [previousTheme, setPreviousTheme] = useState<string | undefined>();

  const [email, setEmail] = useState(params.get("email") ?? "");
  const [handle, setHandle] = useState(params.get("handle") ?? "");
  const [username, setUsername] = useState(params.get("username") ?? "");
  const [password, setPassword] = useState("");

  const [emailDx, setEmailDx] = useState<FieldDiagnosis>({ status: "idle", message: "Informe seu email para verificar." });
  const [handleDx, setHandleDx] = useState<FieldDiagnosis>({ status: "idle", message: "Informe um @ para verificar." });
  const [usernameDx, setUsernameDx] = useState<FieldDiagnosis>({ status: "idle", message: "Informe seu nome para verificar." });
  const [passwordDx, setPasswordDx] = useState<FieldDiagnosis>({ status: "idle", message: "Informe uma senha para verificar." });

  useLayoutEffect(() => {
    setPreviousTheme(theme);
    setTheme("light");
  }, []);

  useEffect(() => {
    return () => {
      if (previousTheme) setTheme(previousTheme);
    };
  }, [previousTheme, setTheme]);

  useEffect(() => {
    const localEmail = diagnoseEmail(email);
    const localHandle = diagnoseHandle(handle);
    const localUsername = diagnoseUsername(username);

    setEmailDx(localEmail);
    setHandleDx(localHandle);
    setUsernameDx(localUsername);

    const needsCheck =
      (localEmail.status === "ok" && email.trim()) ||
      (localHandle.status === "ok" && handle.trim()) ||
      (localUsername.status === "ok" && username.trim());

    if (!needsCheck) return;

    if (localEmail.status === "ok") setEmailDx({ status: "checking", message: "Verificando se o email está disponível..." });
    if (localHandle.status === "ok") setHandleDx({ status: "checking", message: "Verificando se o @ está disponível..." });
    if (localUsername.status === "ok") setUsernameDx({ status: "checking", message: "Verificando se o nome está disponível..." });

    const timer = setTimeout(async () => {
      const { data, error } = await supabase.rpc("check_signup_availability", {
        _email: localEmail.status === "ok" ? email.trim() : null,
        _handle: localHandle.status === "ok" ? handle.trim() : null,
        _username: localUsername.status === "ok" ? username.trim() : null,
      });

      if (error) {
        return;
      }

      const result = (data ?? {}) as {
        email_taken?: boolean;
        handle_taken?: boolean;
        username_taken?: boolean;
      };

      if (localEmail.status === "ok") {
        setEmailDx(
          result.email_taken
            ? {
                status: "error",
                message: "Este email já está cadastrado.",
                hint: "Tente fazer login ou use outro email.",
              }
            : { status: "ok", message: "Email disponível! ✨" }
        );
      }
      if (localHandle.status === "ok") {
        setHandleDx(
          result.handle_taken
            ? {
                status: "error",
                message: "Este @ já está em uso.",
                hint: "Escolha outro @ — adicione números, troque letras ou use _ (ex.: filipe_600 → filipe_dev).",
              }
            : { status: "ok", message: "@ disponível! ✨" }
        );
      }
      if (localUsername.status === "ok") {
        setUsernameDx(
          result.username_taken
            ? {
                status: "error",
                message: "Esse nome já está em uso.",
                hint: "Adicione um sobrenome ou variação para diferenciar.",
              }
            : { status: "ok", message: "Nome disponível! ✨" }
        );
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [email, handle, username]);

  useEffect(() => {
    setPasswordDx(diagnosePassword(password));
  }, [password]);

  const allOk =
    emailDx.status === "ok" &&
    handleDx.status === "ok" &&
    usernameDx.status === "ok" &&
    passwordDx.status === "ok";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/auth")}
              className="-ml-2 h-8"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
            <img src={gavetaLogo} alt="Gavetta" className="h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <HelpCircle className="h-5 w-5 text-primary" />
              <CardTitle className="text-xl">Ajuda no cadastro</CardTitle>
            </div>
            <CardDescription>
              Está tendo problema para criar conta? Preencha abaixo e a gente te
              mostra exatamente qual campo precisa ser corrigido — antes de você
              tentar de novo.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="help-email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="help-email"
                type="email"
                placeholder="seu@email.com"
                className="pl-9"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
              />
            </div>
            <FieldRow
              icon={<Mail className="h-4 w-4" />}
              label="Email"
              diagnosis={emailDx}
              takenLabel="Este email já está cadastrado."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="help-handle">@ (nome de usuário)</Label>
            <div className="relative">
              <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="help-handle"
                placeholder="filipe_600"
                className="pl-9"
                value={handle}
                onChange={(e) => setHandle(e.target.value.toLowerCase())}
                autoComplete="off"
              />
            </div>
            <FieldRow
              icon={<AtSign className="h-4 w-4" />}
              label="@ / handle"
              diagnosis={handleDx}
              takenLabel="Este @ já está em uso."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="help-name">Nome</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="help-name"
                placeholder="Filipe"
                className="pl-9"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="off"
              />
            </div>
            <FieldRow
              icon={<User className="h-4 w-4" />}
              label="Nome de exibição"
              diagnosis={usernameDx}
              takenLabel="Esse nome já está em uso."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="help-pwd">Senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="help-pwd"
                type="password"
                placeholder="Digite a senha que quer usar"
                className="pl-9"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              🔒 Sua senha é checada só no navegador. Nada é enviado para o servidor nesta tela.
            </p>
            <FieldRow icon={<Lock className="h-4 w-4" />} label="Senha" diagnosis={passwordDx} />
          </div>

          {allOk && (
            <div className="rounded-lg border border-green-500/40 bg-green-500/10 p-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-500" />
                <p className="text-sm font-medium text-green-700 dark:text-green-500">
                  Tudo certo! Pode voltar e finalizar seu cadastro.
                </p>
              </div>
            </div>
          )}

          <Button
            className="w-full"
            onClick={() =>
              navigate(
                `/auth?email=${encodeURIComponent(email)}&handle=${encodeURIComponent(
                  handle
                )}&username=${encodeURIComponent(username)}`
              )
            }
          >
            Voltar para o cadastro
          </Button>

          <div className="text-xs text-muted-foreground text-center pt-2">
            Continua com problema? Mande um email para{" "}
            <a href="mailto:contato@gavetta.com.br" className="underline">
              contato@gavetta.com.br
            </a>
            .
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Loader2,
  Search,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Mail,
  User as UserIcon,
  Database,
  Trash2,
  Send,
} from "lucide-react";
import { toast } from "sonner";

interface DebugResult {
  email: string;
  verdict: { level: "ok" | "warn" | "error"; code: string; message: string };
  authUser: null | {
    exists: true;
    id: string;
    createdAt: string | null;
    emailConfirmedAt: string | null;
    lastSignInAt: string | null;
    provider: string | null;
  };
  profile: { exists: false } | { exists: true; handle: string | null; username: string | null };
  format: { valid: boolean; domain: string | null };
  triggerSimulation: { suggestedHandle: string; available: boolean };
  recentLogs: Array<{
    timestamp: string;
    action: string | null;
    path: string | null;
    status: number | null;
    errorMsg: string | null;
  }>;
  notes: string[];
}

const FOUNDER_HANDLE = "joaoeduardo";

export default function AdminSignupDebug() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DebugResult | null>(null);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setAllowed(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("handle")
        .eq("id", user.id)
        .maybeSingle();
      setAllowed(data?.handle === FOUNDER_HANDLE);
    })();
  }, [user, authLoading]);

  const runDiagnosis = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("signup-debug", {
        body: { email: email.trim().toLowerCase() },
      });
      if (error) throw error;
      setResult(data as DebugResult);
    } catch (e) {
      toast.error("Erro ao diagnosticar", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const cleanupOrphan = async () => {
    if (!result?.authUser?.id) return;
    if (!confirm(`Deletar registro de ${result.email} (${result.authUser.id}) de auth.users?`)) return;
    setActing(true);
    try {
      const { error } = await supabase.functions.invoke("signup-cleanup-orphan", {
        body: { userId: result.authUser.id },
      });
      if (error) throw error;
      toast.success("Registro órfão removido");
      runDiagnosis();
    } catch (e) {
      toast.error("Falha ao limpar", { description: (e as Error).message });
    } finally {
      setActing(false);
    }
  };

  const resendConfirmation = async () => {
    if (!result?.email) return;
    setActing(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: result.email,
      });
      if (error) throw error;
      toast.success("Email de confirmação reenviado");
    } catch (e) {
      toast.error("Falha ao reenviar", { description: (e as Error).message });
    } finally {
      setActing(false);
    }
  };

  if (authLoading || allowed === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <ShieldAlert className="h-10 w-10 text-destructive mb-2" />
            <CardTitle>Acesso negado</CardTitle>
            <CardDescription>Esta página é restrita.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => navigate("/")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Diagnóstico de Cadastro</h1>
            <p className="text-sm text-muted-foreground">
              Investiga por que um email foi negado durante o signup.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Investigar email</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="flex gap-2">
                <Input
                  id="email"
                  type="email"
                  placeholder="usuario@dominio.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runDiagnosis()}
                  disabled={loading}
                />
                <Button onClick={runDiagnosis} disabled={loading || !email.trim()}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  <span className="ml-2 hidden sm:inline">Diagnosticar</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {result && (
          <>
            {/* Verdict banner */}
            <Alert
              variant={result.verdict.level === "error" ? "destructive" : "default"}
              className={
                result.verdict.level === "ok"
                  ? "border-green-500/50 [&>svg]:text-green-500"
                  : result.verdict.level === "warn"
                    ? "border-yellow-500/50 [&>svg]:text-yellow-500"
                    : ""
              }
            >
              {result.verdict.level === "ok" && <CheckCircle2 className="h-4 w-4" />}
              {result.verdict.level === "warn" && <AlertTriangle className="h-4 w-4" />}
              {result.verdict.level === "error" && <XCircle className="h-4 w-4" />}
              <AlertTitle className="font-mono text-xs uppercase tracking-wider">
                {result.verdict.code}
              </AlertTitle>
              <AlertDescription className="mt-1">{result.verdict.message}</AlertDescription>
            </Alert>

            {/* Action buttons */}
            {(result.verdict.code === "orphan_record" ||
              result.verdict.code === "already_registered_unconfirmed") && (
              <div className="flex flex-wrap gap-2">
                {result.verdict.code === "orphan_record" && (
                  <Button
                    variant="destructive"
                    onClick={cleanupOrphan}
                    disabled={acting}
                    size="sm"
                  >
                    {acting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 h-4 w-4" />
                    )}
                    Limpar registro órfão
                  </Button>
                )}
                {result.verdict.code === "already_registered_unconfirmed" && (
                  <Button onClick={resendConfirmation} disabled={acting} size="sm">
                    {acting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    Reenviar confirmação
                  </Button>
                )}
              </div>
            )}

            {/* Format */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Formato
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <Row label="Email">{result.email}</Row>
                <Row label="Domínio">{result.format.domain ?? "—"}</Row>
                <Row label="Formato válido">
                  <Badge variant={result.format.valid ? "default" : "destructive"}>
                    {result.format.valid ? "sim" : "não"}
                  </Badge>
                </Row>
              </CardContent>
            </Card>

            {/* Auth user */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Registro em auth.users
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                {result.authUser ? (
                  <>
                    <Row label="ID"><code className="text-xs">{result.authUser.id}</code></Row>
                    <Row label="Criado em">{fmtDate(result.authUser.createdAt)}</Row>
                    <Row label="Email confirmado">
                      {result.authUser.emailConfirmedAt ? (
                        <Badge>{fmtDate(result.authUser.emailConfirmedAt)}</Badge>
                      ) : (
                        <Badge variant="destructive">não confirmado</Badge>
                      )}
                    </Row>
                    <Row label="Último login">{fmtDate(result.authUser.lastSignInAt) || "nunca"}</Row>
                    <Row label="Provider">{result.authUser.provider ?? "email"}</Row>
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    Nenhum registro encontrado. O email está livre no banco.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Profile */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <UserIcon className="h-4 w-4" />
                  Profile em public.profiles
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                {result.profile.exists ? (
                  <>
                    <Row label="Handle">@{result.profile.handle}</Row>
                    <Row label="Nome">{result.profile.username ?? "—"}</Row>
                  </>
                ) : result.authUser ? (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>
                      Existe usuário em auth.users SEM profile. Trigger handle_new_user
                      falhou em algum momento — registro órfão.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <p className="text-muted-foreground">N/A (sem usuário).</p>
                )}
              </CardContent>
            </Card>

            {/* Trigger sim */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Simulação do trigger</CardTitle>
                <CardDescription className="text-xs">
                  Handle que seria gerado a partir do local-part do email.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <Row label="Handle sugerido">@{result.triggerSimulation.suggestedHandle}</Row>
                <Row label="Disponível">
                  <Badge variant={result.triggerSimulation.available ? "default" : "destructive"}>
                    {result.triggerSimulation.available ? "sim" : "esgotou tentativas"}
                  </Badge>
                </Row>
              </CardContent>
            </Card>

            {/* Notes */}
            {result.notes.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Observações</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  {result.notes.map((n, i) => (
                    <p key={i} className="text-muted-foreground">• {n}</p>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1 border-b border-border/30 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right break-all">{children}</span>
    </div>
  );
}

function fmtDate(s: string | null) {
  if (!s) return "";
  try {
    return new Date(s).toLocaleString("pt-BR");
  } catch {
    return s;
  }
}

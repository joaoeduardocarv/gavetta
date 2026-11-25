import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Crown, Gift, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export interface AdminPremiumInfo {
  is_premium: boolean;
  subscription: {
    id: string;
    plan: string;
    payment_method: string;
    status: string;
    current_period_start: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
  } | null;
  grant: {
    id: string;
    reason: string | null;
    expires_at: string | null;
    created_at: string;
    granted_by: string;
    granted_by_name: string | null;
  } | null;
}

type GrantDuration = "30d" | "90d" | "1y" | "forever";

const DURATION_OPTIONS: { value: GrantDuration; label: string }[] = [
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
  { value: "1y", label: "1 ano" },
  { value: "forever", label: "Sem fim" },
];

const PLAN_LABELS: Record<string, string> = {
  monthly: "Mensal",
  yearly: "Anual",
};

const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";

function isSubscriptionGrantingAccess(sub: AdminPremiumInfo["subscription"]): boolean {
  if (!sub) return false;
  const now = Date.now();
  const endMs = sub.current_period_end ? new Date(sub.current_period_end).getTime() : 0;
  if (sub.status === "active") return true;
  if (sub.status === "past_due") return endMs + 3 * 24 * 60 * 60 * 1000 > now;
  if (sub.status === "canceled") return endMs > now;
  return false;
}

export function AdminPremiumSection({
  userId,
  premium,
}: {
  userId: string;
  premium?: AdminPremiumInfo | null;
}) {
  const qc = useQueryClient();
  const [grantOpen, setGrantOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState<GrantDuration>("30d");
  const [revokeReason, setRevokeReason] = useState("");

  const hasActiveSub = isSubscriptionGrantingAccess(premium?.subscription ?? null);
  const activeGrant = premium?.grant ?? null;

  const statusLabel = hasActiveSub
    ? "Assinatura"
    : activeGrant
      ? "Cortesia"
      : "Grátis";

  const planLabel = hasActiveSub
    ? (PLAN_LABELS[premium!.subscription!.plan] ?? premium!.subscription!.plan)
    : activeGrant
      ? "Cortesia"
      : "Grátis";

  const periodEndLabel = hasActiveSub
    ? fmt(premium!.subscription!.current_period_end)
    : activeGrant
      ? activeGrant.expires_at
        ? fmt(activeGrant.expires_at)
        : "Sem fim"
      : "—";

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["admin-user-profile", userId] });
    qc.invalidateQueries({ queryKey: ["admin-user-activity", userId] });
    qc.invalidateQueries({ queryKey: ["premium-status", userId] });
  };

  const grantMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("admin_grant_premium", {
        _user_id: userId,
        _reason: reason.trim(),
        _duration: duration,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cortesia Gavetta+ concedida");
      setGrantOpen(false);
      setReason("");
      setDuration("30d");
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("admin_revoke_premium", {
        _user_id: userId,
        _reason: revokeReason.trim() || undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cortesia Gavetta+ revogada");
      setRevokeOpen(false);
      setRevokeReason("");
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="bg-card border border-border rounded-lg p-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Crown className="h-4 w-4 text-accent" aria-hidden="true" />
          <h3 className="font-heading font-bold">Gavetta+</h3>
          <Badge variant={premium?.is_premium ? "default" : "secondary"}>{statusLabel}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setGrantOpen(true)}>
            <Gift className="h-4 w-4 mr-1" />
            Conceder cortesia
          </Button>
          {activeGrant && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setRevokeOpen(true)}
              disabled={revokeMutation.isPending}
            >
              <XCircle className="h-4 w-4 mr-1" />
              Revogar cortesia
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <div className="bg-muted/40 rounded-md p-3">
          <p className="text-xs text-muted-foreground">Status atual</p>
          <p className="font-semibold">{statusLabel}</p>
        </div>
        <div className="bg-muted/40 rounded-md p-3">
          <p className="text-xs text-muted-foreground">Plano</p>
          <p className="font-semibold">{planLabel}</p>
        </div>
        <div className="bg-muted/40 rounded-md p-3">
          <p className="text-xs text-muted-foreground">Fim do período</p>
          <p className="font-semibold">{periodEndLabel}</p>
        </div>
      </div>

      {activeGrant && (
        <p className="text-xs text-muted-foreground">
          Cortesia ativa{activeGrant.reason ? `: ${activeGrant.reason}` : ""}
          {activeGrant.granted_by_name ? ` · por @${activeGrant.granted_by_name}` : ""}
          {hasActiveSub
            ? ` · validade ${activeGrant.expires_at ? fmt(activeGrant.expires_at) : "Sem fim"}`
            : ""}
        </p>
      )}

      <Dialog
        open={grantOpen}
        onOpenChange={(v) => {
          setGrantOpen(v);
          if (!v) {
            setReason("");
            setDuration("30d");
          }
        }}
      >
        <DialogContent className="z-[60] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Conceder cortesia Gavetta+</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="grant-duration">
                Validade
              </label>
              <Select value={duration} onValueChange={(v) => setDuration(v as GrantDuration)}>
                <SelectTrigger id="grant-duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[70]">
                  {DURATION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="grant-reason">
                Motivo
              </label>
              <Textarea
                id="grant-reason"
                placeholder="Ex.: Testador beta, parceiro, imprensa..."
                maxLength={300}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={!reason.trim() || grantMutation.isPending}
              onClick={() => grantMutation.mutate()}
            >
              Confirmar cortesia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={revokeOpen}
        onOpenChange={(v) => {
          setRevokeOpen(v);
          if (!v) setRevokeReason("");
        }}
      >
        <DialogContent className="z-[60] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Revogar cortesia Gavetta+</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            A cortesia ativa será encerrada imediatamente. Assinaturas pagas não são afetadas.
          </p>
          <Textarea
            placeholder="Motivo (opcional)"
            maxLength={300}
            value={revokeReason}
            onChange={(e) => setRevokeReason(e.target.value)}
          />
          <DialogFooter>
            <Button
              variant="destructive"
              disabled={revokeMutation.isPending}
              onClick={() => revokeMutation.mutate()}
            >
              Revogar cortesia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
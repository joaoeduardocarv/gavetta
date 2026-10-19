import { useQuery } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export function BlockedAccountGuard() {
  const { user, signOut } = useAuth();
  const { data } = useQuery({
    queryKey: ["my-block-status", user?.id],
    enabled: !!user?.id,
    refetchInterval: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_block_status");
      if (error) return null;
      return data as { reason: string | null } | null;
    },
  });
  if (!user || !data) return null;
  return (
    <div className="fixed inset-0 z-[100] bg-background flex items-center justify-center p-6">
      <div className="max-w-sm text-center space-y-4">
        <ShieldAlert className="h-12 w-12 mx-auto text-destructive" />
        <h1 className="font-heading font-bold text-xl">Conta suspensa</h1>
        <p className="text-sm text-muted-foreground">{data.reason ?? "Sua conta foi suspensa pela equipe do Gavetta."}</p>
        <Button onClick={() => signOut()}>Sair</Button>
      </div>
    </div>
  );
}

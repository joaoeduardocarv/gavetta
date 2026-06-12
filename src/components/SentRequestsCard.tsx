import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, X, Loader2 } from "lucide-react";
import { useFriendships, FriendProfile } from "@/hooks/useFriendships";
import { resolveAvatarSrc } from "@/components/AvatarPickerDialog";

export function SentRequestsCard() {
  const { sentRequests, sentLoading, cancelSentRequest } = useFriendships();

  if (sentLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (sentRequests.length === 0) {
    return null;
  }

  return (
    <Card className="border-amber-500/20 bg-amber-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4 text-amber-500" />
          Aguardando resposta ({sentRequests.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sentRequests.map((request) => (
          <div
            key={request.friendship_id}
            className="flex items-center gap-3 p-3 bg-background rounded-lg border"
          >
            <Avatar className="h-10 w-10 flex-shrink-0">
              <AvatarImage src={resolveAvatarSrc(request.avatar_url)} alt={request.username || ""} />
              <AvatarFallback className="bg-amber-500/10 text-amber-600 text-xs">
                {request.username?.slice(0, 2).toUpperCase() || "??"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">
                {request.username || "Usuário"}
              </p>
              <p className="text-xs text-muted-foreground">
                Pedido enviado • aguardando resposta
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={() => cancelSentRequest.mutate(request.friendship_id)}
              disabled={cancelSentRequest.isPending}
              title="Cancelar pedido"
              aria-label={`Cancelar pedido para ${request.username || "usuário"}`}
            >
              {cancelSentRequest.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <X className="h-4 w-4" />
              )}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

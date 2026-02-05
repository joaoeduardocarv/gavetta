import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, X, UserPlus, Loader2 } from "lucide-react";
import { useFriendships, FriendProfile } from "@/hooks/useFriendships";

export function FriendRequestsCard() {
  const { pendingRequests, pendingLoading, acceptRequest, rejectRequest } = useFriendships();

  if (pendingLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (pendingRequests.length === 0) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <UserPlus className="h-4 w-4 text-primary" />
          Pedidos de Amizade ({pendingRequests.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {pendingRequests.map((request) => (
          <div
            key={request.friendship_id}
            className="flex items-center gap-3 p-3 bg-background rounded-lg border"
          >
            <Avatar className="h-10 w-10">
              <AvatarImage src={request.avatar_url || ""} alt={request.username || ""} />
              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                {request.username?.slice(0, 2).toUpperCase() || "??"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">
                {request.username || "Usuário sem nome"}
              </p>
              <p className="text-xs text-muted-foreground">
                Quer ser seu amigo
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100"
                onClick={() => acceptRequest.mutate(request.friendship_id)}
                disabled={acceptRequest.isPending}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => rejectRequest.mutate(request.friendship_id)}
                disabled={rejectRequest.isPending}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

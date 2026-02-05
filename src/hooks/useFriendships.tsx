import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  updated_at: string;
}

export interface FriendProfile {
  id: string;
  username: string | null;
  avatar_url: string | null;
  friendship_id: string;
  is_requester: boolean;
}

export function useFriendships() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch accepted friends
  const { data: friends = [], isLoading: friendsLoading } = useQuery({
    queryKey: ["friends", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data: friendships, error } = await supabase
        .from("friendships")
        .select("*")
        .eq("status", "accepted")
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

      if (error) throw error;

      // Get friend profiles
      const friendIds = friendships.map((f) =>
        f.requester_id === user.id ? f.addressee_id : f.requester_id
      );

      if (friendIds.length === 0) return [];

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .in("id", friendIds);

      if (profilesError) throw profilesError;

      return friendships.map((f) => {
        const friendId = f.requester_id === user.id ? f.addressee_id : f.requester_id;
        const profile = profiles.find((p) => p.id === friendId);
        return {
          id: friendId,
          username: profile?.username,
          avatar_url: profile?.avatar_url,
          friendship_id: f.id,
          is_requester: f.requester_id === user.id,
        } as FriendProfile;
      });
    },
    enabled: !!user?.id,
  });

  // Fetch pending requests received
  const { data: pendingRequests = [], isLoading: pendingLoading } = useQuery({
    queryKey: ["pending-requests", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data: friendships, error } = await supabase
        .from("friendships")
        .select("*")
        .eq("addressee_id", user.id)
        .eq("status", "pending");

      if (error) throw error;

      const requesterIds = friendships.map((f) => f.requester_id);
      if (requesterIds.length === 0) return [];

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .in("id", requesterIds);

      if (profilesError) throw profilesError;

      return friendships.map((f) => {
        const profile = profiles.find((p) => p.id === f.requester_id);
        return {
          id: f.requester_id,
          username: profile?.username,
          avatar_url: profile?.avatar_url,
          friendship_id: f.id,
          is_requester: false,
        } as FriendProfile;
      });
    },
    enabled: !!user?.id,
  });

  // Send friend request
  const sendRequest = useMutation({
    mutationFn: async (addresseeId: string) => {
      if (!user?.id) throw new Error("Não autenticado");

      // Create friendship
      const { error: friendshipError } = await supabase
        .from("friendships")
        .insert({
          requester_id: user.id,
          addressee_id: addresseeId,
          status: "pending",
        });

      if (friendshipError) throw friendshipError;

      // Create notification for the addressee
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .maybeSingle();

      await supabase.from("notifications").insert({
        user_id: addresseeId,
        type: "friend_request",
        title: "Novo pedido de amizade",
        message: `${profile?.username || "Alguém"} quer ser seu amigo!`,
        related_user_id: user.id,
      });
    },
    onSuccess: () => {
      toast({ title: "Pedido enviado!", description: "Aguardando aceitação." });
      queryClient.invalidateQueries({ queryKey: ["friends"] });
    },
    onError: (error: any) => {
      if (error.code === "23505") {
        toast({
          title: "Já existe um pedido",
          description: "Você já enviou ou recebeu um pedido desta pessoa.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
      }
    },
  });

  // Accept friend request
  const acceptRequest = useMutation({
    mutationFn: async (friendshipId: string) => {
      if (!user?.id) throw new Error("Não autenticado");

      const { data: friendship, error } = await supabase
        .from("friendships")
        .update({ status: "accepted" })
        .eq("id", friendshipId)
        .select()
        .single();

      if (error) throw error;

      // Notify the requester
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .maybeSingle();

      await supabase.from("notifications").insert({
        user_id: friendship.requester_id,
        type: "friend_accepted",
        title: "Pedido aceito!",
        message: `${profile?.username || "Alguém"} aceitou seu pedido de amizade!`,
        related_user_id: user.id,
      });
    },
    onSuccess: () => {
      toast({ title: "Amizade aceita!" });
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      queryClient.invalidateQueries({ queryKey: ["pending-requests"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  // Reject friend request
  const rejectRequest = useMutation({
    mutationFn: async (friendshipId: string) => {
      const { error } = await supabase
        .from("friendships")
        .delete()
        .eq("id", friendshipId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Pedido recusado" });
      queryClient.invalidateQueries({ queryKey: ["pending-requests"] });
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  // Remove friend
  const removeFriend = useMutation({
    mutationFn: async (friendshipId: string) => {
      const { error } = await supabase
        .from("friendships")
        .delete()
        .eq("id", friendshipId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Amigo removido" });
      queryClient.invalidateQueries({ queryKey: ["friends"] });
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  return {
    friends,
    friendsLoading,
    pendingRequests,
    pendingLoading,
    sendRequest,
    acceptRequest,
    rejectRequest,
    removeFriend,
  };
}

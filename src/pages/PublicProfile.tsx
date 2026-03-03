import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getAvatarById } from "@/components/AvatarPickerDialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Share2, Lock, Star, Film, Tv, Eye, Clock, Trophy, Loader2, User, CheckCircle } from "lucide-react";
import { getTMDBImageUrl } from "@/lib/tmdb";
import { useToast } from "@/hooks/use-toast";
import gavetaIcon from "@/assets/gaveta-icon.png";

interface ProfileData {
  id: string;
  username: string;
  avatar_url: string | null;
  is_public: boolean;
}

interface DrawerItem {
  id: string;
  drawer_id: string;
  production_data: any;
  production_type: string;
  production_id: string;
  rating: number | null;
}

interface ProfileStats {
  totalMovies: number;
  totalSeries: number;
  avgRating: number | null;
}

export default function PublicProfile() {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [watchingItems, setWatchingItems] = useState<DrawerItem[]>([]);
  const [toWatchItems, setToWatchItems] = useState<DrawerItem[]>([]);
  const [top3Items, setTop3Items] = useState<DrawerItem[]>([]);
  const [stats, setStats] = useState<ProfileStats>({ totalMovies: 0, totalSeries: 0, avgRating: null });
  const { toast } = useToast();

  useEffect(() => {
    async function loadProfile() {
      if (!username) { setNotFound(true); setLoading(false); return; }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, is_public")
        .eq("username", username)
        .single();

      if (error || !data) { setNotFound(true); setLoading(false); return; }

      if (!data.is_public) { setIsPrivate(true); setLoading(false); return; }

      setProfile(data as ProfileData);

      // Load drawer assignments
      const { data: assignments } = await supabase
        .from("user_drawer_assignments")
        .select("*")
        .eq("user_id", data.id);

      if (assignments) {
        setWatchingItems(assignments.filter((a: any) => a.drawer_id === "watching"));
        setToWatchItems(assignments.filter((a: any) => a.drawer_id === "to_watch"));
        
        const rated = assignments
          .filter((a: any) => a.rating && a.rating > 0)
          .sort((a: any, b: any) => (b.rating ?? 0) - (a.rating ?? 0))
          .slice(0, 3);
        setTop3Items(rated);

        // Compute stats
        const watched = assignments.filter((a: any) => a.drawer_id === "watched");
        const movies = watched.filter((a: any) => a.production_type === "movie").length;
        const series = watched.filter((a: any) => a.production_type === "tv").length;
        const ratingsArr = assignments.filter((a: any) => a.rating && a.rating > 0).map((a: any) => a.rating as number);
        const avg = ratingsArr.length > 0 ? Math.round((ratingsArr.reduce((s: number, r: number) => s + r, 0) / ratingsArr.length) * 10) / 10 : null;
        setStats({ totalMovies: movies, totalSeries: series, avgRating: avg });
      }
      setLoading(false);
    }
    loadProfile();
  }, [username]);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: `${profile?.username} no Gavetta`, url }); } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copiado!", description: "O link do perfil foi copiado." });
    }
  };

  const getPoster = (item: DrawerItem) => {
    const d = item.production_data as any;
    const path = d?.poster_path || d?.posterUrl;
    if (!path) return null;
    if (path.startsWith("http")) return path;
    return getTMDBImageUrl(path, "w300");
  };

  const getTitle = (item: DrawerItem) => {
    const d = item.production_data as any;
    return d?.title || d?.name || "Sem título";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6 text-center">
        <img src={gavetaIcon} alt="Gavetta" className="h-12 w-12 opacity-50" />
        <h1 className="text-2xl font-bold text-foreground">Perfil não encontrado</h1>
        <p className="text-muted-foreground">Esse usuário não existe no Gavetta.</p>
      </div>
    );
  }

  if (isPrivate) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6 text-center">
        <Lock className="h-16 w-16 text-muted-foreground/40" />
        <h1 className="text-2xl font-bold text-foreground">Perfil Privado</h1>
        <p className="text-muted-foreground">Este perfil é privado e não pode ser visualizado.</p>
        <img src={gavetaIcon} alt="Gavetta" className="h-8 w-8 opacity-30 mt-4" />
      </div>
    );
  }

  if (!profile) return null;

  const avatarData = getAvatarById(profile.avatar_url || "");
  const medalColors = ["text-accent", "text-muted-foreground", "text-orange-600"];
  const medalLabels = ["🥇", "🥈", "🥉"];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/20 via-primary/5 to-background" />
        <div className="relative px-6 pt-10 pb-6 flex flex-col items-center text-center">
          <Avatar className="h-24 w-24 ring-4 ring-primary/30 shadow-lg">
            {avatarData ? (
              <AvatarImage src={avatarData.src} alt={avatarData.name} className="object-cover" />
            ) : (
              <AvatarFallback><User className="h-10 w-10" /></AvatarFallback>
            )}
          </Avatar>
          <h1 className="mt-4 text-2xl font-bold text-foreground">{profile.username}</h1>
          <p className="text-sm text-muted-foreground mt-1">Perfil público no Gavetta</p>
          <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={handleShare}>
            <Share2 className="h-4 w-4" />
            Compartilhar perfil
          </Button>
        </div>
      </div>

      <div className="px-4 pb-12 max-w-lg mx-auto space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card rounded-lg p-4 text-center border border-border">
            <Film className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold text-foreground">{stats.totalMovies}</p>
            <p className="text-xs text-muted-foreground">Filmes assistidos</p>
          </div>
          <div className="bg-card rounded-lg p-4 text-center border border-border">
            <Tv className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold text-foreground">{stats.totalSeries}</p>
            <p className="text-xs text-muted-foreground">Séries assistidas</p>
          </div>
          <div className="bg-card rounded-lg p-4 text-center border border-border">
            <Star className="h-5 w-5 mx-auto text-accent mb-1" />
            <p className="text-2xl font-bold text-foreground">{stats.avgRating ?? "—"}</p>
            <p className="text-xs text-muted-foreground">Nota média</p>
          </div>
        </div>

        <Separator />
        {top3Items.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="h-5 w-5 text-accent" />
              <h2 className="text-lg font-bold text-foreground">Top 3 — Maiores Notas</h2>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {top3Items.map((item, idx) => {
                const poster = getPoster(item);
                return (
                  <div key={item.id} className="relative group">
                    <div className="aspect-[2/3] rounded-xl overflow-hidden bg-muted border-2 border-border shadow-md">
                      {poster ? (
                        <img src={poster} alt={getTitle(item)} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Film className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    {/* Medal + rating overlay */}
                    <div className="absolute top-2 left-2 bg-background/80 backdrop-blur-sm rounded-full px-2 py-0.5 text-sm font-bold">
                      {medalLabels[idx]}
                    </div>
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-background/90 to-transparent p-2 pt-6 rounded-b-xl">
                      <p className="text-xs font-semibold text-foreground line-clamp-1">{getTitle(item)}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Star className="h-3 w-3 fill-accent text-accent" />
                        <span className="text-xs font-bold text-accent">{item.rating}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <Separator />

        {/* Assistindo agora */}
        <CarouselSection
          icon={<Eye className="h-5 w-5 text-primary" />}
          title="Assistindo agora"
          items={watchingItems}
          emptyText="Nenhum título sendo assistido no momento."
          getPoster={getPoster}
          getTitle={getTitle}
        />

        <Separator />

        {/* Para assistir */}
        <CarouselSection
          icon={<Clock className="h-5 w-5 text-primary" />}
          title="Para assistir"
          items={toWatchItems}
          emptyText="Nenhum título na watchlist."
          getPoster={getPoster}
          getTitle={getTitle}
        />

        {/* Footer */}
        <div className="text-center pt-6 pb-4">
          <img src={gavetaIcon} alt="Gavetta" className="h-8 w-8 mx-auto opacity-40 mb-2" />
          <p className="text-xs text-muted-foreground">Perfil público do Gavetta</p>
        </div>
      </div>
    </div>
  );
}

function CarouselSection({
  icon,
  title,
  items,
  emptyText,
  getPoster,
  getTitle,
}: {
  icon: React.ReactNode;
  title: string;
  items: DrawerItem[];
  emptyText: string;
  getPoster: (item: DrawerItem) => string | null;
  getTitle: (item: DrawerItem) => string;
}) {
  if (items.length === 0) {
    return (
      <section>
        <div className="flex items-center gap-2 mb-3">
          {icon}
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
        </div>
        <p className="text-sm text-muted-foreground italic">{emptyText}</p>
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
        <Badge variant="secondary" className="ml-auto text-xs">{items.length}</Badge>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
        {items.map((item) => {
          const poster = getPoster(item);
          return (
            <div key={item.id} className="flex-shrink-0 w-28">
              <div className="aspect-[2/3] rounded-lg overflow-hidden bg-muted border border-border">
                {poster ? (
                  <img src={poster} alt={getTitle(item)} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Film className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
              </div>
              <p className="text-xs text-foreground font-medium mt-1.5 line-clamp-2">{getTitle(item)}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

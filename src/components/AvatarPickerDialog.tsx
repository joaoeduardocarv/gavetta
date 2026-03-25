import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Upload, Loader2, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from "react-image-crop";
import { Slider } from "@/components/ui/slider";
import "react-image-crop/dist/ReactCrop.css";

// Import all avatar images
import aang from "@/assets/avatars/aang.png";
import anton from "@/assets/avatars/anton.png";
import apollo from "@/assets/avatars/apollo.png";
import batman from "@/assets/avatars/batman.png";
import blackPanther from "@/assets/avatars/black-panther.png";
import bride from "@/assets/avatars/bride.png";
import demogorgon from "@/assets/avatars/demogorgon.png";
import eleven from "@/assets/avatars/eleven.png";
import furiosa from "@/assets/avatars/furiosa.png";
import gandalf from "@/assets/avatars/gandalf.png";
import godfather from "@/assets/avatars/godfather.png";
import heisenberg from "@/assets/avatars/heisenberg.png";
import ironMan from "@/assets/avatars/iron-man.png";
import johnWick from "@/assets/avatars/john-wick.png";
import joker from "@/assets/avatars/joker.png";
import legolas from "@/assets/avatars/legolas.png";
import neytiri from "@/assets/avatars/neytiri.png";
import rocky from "@/assets/avatars/rocky.png";
import simba from "@/assets/avatars/simba.png";
import terminator from "@/assets/avatars/terminator.png";
import thanos from "@/assets/avatars/thanos.png";
import trinity from "@/assets/avatars/trinity.png";

export interface AvatarOption {
  id: string;
  name: string;
  src: string;
}

export const allAvatars: AvatarOption[] = [
  { id: "aang", name: "Aang", src: aang },
  { id: "anton", name: "Anton Chigurh", src: anton },
  { id: "apollo", name: "Apollo Creed", src: apollo },
  { id: "batman", name: "Batman", src: batman },
  { id: "black-panther", name: "Pantera Negra", src: blackPanther },
  { id: "bride", name: "A Noiva", src: bride },
  { id: "demogorgon", name: "Demogorgon", src: demogorgon },
  { id: "eleven", name: "Eleven", src: eleven },
  { id: "furiosa", name: "Furiosa", src: furiosa },
  { id: "gandalf", name: "Gandalf", src: gandalf },
  { id: "godfather", name: "O Poderoso Chefão", src: godfather },
  { id: "heisenberg", name: "Heisenberg", src: heisenberg },
  { id: "iron-man", name: "Homem de Ferro", src: ironMan },
  { id: "john-wick", name: "John Wick", src: johnWick },
  { id: "joker", name: "Coringa", src: joker },
  { id: "legolas", name: "Legolas", src: legolas },
  { id: "neytiri", name: "Neytiri", src: neytiri },
  { id: "rocky", name: "Rocky", src: rocky },
  { id: "simba", name: "Simba", src: simba },
  { id: "terminator", name: "Terminator", src: terminator },
  { id: "thanos", name: "Thanos", src: thanos },
  { id: "trinity", name: "Trinity", src: trinity },
];

export function getAvatarById(avatarId: string): AvatarOption | undefined {
  const found = allAvatars.find(a => a.id === avatarId);
  if (found) return found;
  if (avatarId && (avatarId.startsWith("http://") || avatarId.startsWith("https://"))) {
    return { id: "custom", name: "Foto personalizada", src: avatarId };
  }
  return undefined;
}

/** Resolves an avatar_url (which may be an avatar id like "joker" or a full URL) to an image src */
export function resolveAvatarSrc(avatarUrl: string | null | undefined): string {
  if (!avatarUrl) return "";
  const avatar = getAvatarById(avatarUrl);
  return avatar?.src || "";
}

function getCroppedBlob(image: HTMLImageElement, crop: Crop, zoom: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  const size = 256;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // The crop coordinates are relative to the displayed (zoomed) image
  // We need to adjust for zoom when mapping to natural coordinates
  ctx.drawImage(
    image,
    (crop.x * scaleX) / zoom,
    (crop.y * scaleY) / zoom,
    (crop.width * scaleX) / zoom,
    (crop.height * scaleY) / zoom,
    0,
    0,
    size,
    size
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas is empty"))),
      "image/jpeg",
      0.9
    );
  });
}

interface AvatarPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentAvatar: string;
  onSelectAvatar: (avatarId: string) => void;
}

export function AvatarPickerDialog({
  open,
  onOpenChange,
  currentAvatar,
  onSelectAvatar,
}: AvatarPickerDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState(currentAvatar);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Crop state
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [zoom, setZoom] = useState(1);
  const imgRef = useRef<HTMLImageElement>(null);

  const handleSelect = (avatar: AvatarOption) => {
    setSelectedId(avatar.id);
    onSelectAvatar(avatar.id);
    onOpenChange(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 5 * 1024 * 1024; // 5MB for source (will be cropped down)
    if (file.size > maxSize) {
      toast({ title: "Arquivo muito grande", description: "O tamanho máximo é 5MB.", variant: "destructive" });
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: "Formato inválido", description: "Use JPG, PNG ou WebP.", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setImageSrc(reader.result as string);
    reader.readAsDataURL(file);
  };

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    imgRef.current = e.currentTarget;
    const { width, height } = e.currentTarget;
    const initialCrop = centerCrop(
      makeAspectCrop({ unit: "%", width: 80 }, 1, width, height),
      width,
      height
    );
    setCrop(initialCrop);
  }, []);

  const handleCropConfirm = async () => {
    if (!imgRef.current || !crop || !user?.id) return;

    setUploading(true);
    try {
      const blob = await getCroppedBlob(imgRef.current, crop, zoom);
      const filePath = `${user.id}/avatar.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, blob, { upsert: true, contentType: "image/jpeg" });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const url = `${publicUrl}?t=${Date.now()}`;
      onSelectAvatar(url);
      setSelectedId(url);
      setImageSrc(null);
      onOpenChange(false);
      toast({ title: "Foto atualizada!", description: "Sua foto personalizada foi salva." });
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleCropCancel = () => {
    setImageSrc(null);
    setZoom(1);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setImageSrc(null); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">
            {imageSrc ? "Recortar imagem" : "Escolha seu Avatar"}
          </DialogTitle>
        </DialogHeader>

        {imageSrc ? (
          <div className="space-y-4">
            <div className="flex justify-center rounded-lg overflow-hidden bg-muted/30">
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                aspect={1}
                circularCrop
              >
                <img
                  src={imageSrc}
                  onLoad={onImageLoad}
                  alt="Recorte"
                  className="max-h-[300px] w-auto"
                  style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
                />
              </ReactCrop>
            </div>

            {/* Zoom slider */}
            <div className="flex items-center gap-3 px-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Zoom</span>
              <Slider
                min={1}
                max={3}
                step={0.05}
                value={[zoom]}
                onValueChange={([v]) => setZoom(v)}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground w-10 text-right">{Math.round(zoom * 100)}%</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleCropCancel} disabled={uploading}>
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
              <Button className="flex-1" onClick={handleCropConfirm} disabled={uploading}>
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                {uploading ? "Salvando..." : "Confirmar"}
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Upload button */}
            <div className="mb-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Enviar foto da biblioteca
              </Button>
              <p className="text-xs text-muted-foreground mt-1 text-center">JPG, PNG ou WebP • Máx. 5MB</p>
            </div>

            <ScrollArea className="h-[350px] pr-4">
              <div className="grid grid-cols-4 gap-3">
                {allAvatars.map((avatar) => (
                  <button
                    key={avatar.id}
                    onClick={() => handleSelect(avatar)}
                    className={cn(
                      "relative aspect-square rounded-full overflow-hidden border-2 transition-all duration-200 hover:scale-105",
                      selectedId === avatar.id
                        ? "border-primary ring-2 ring-primary/50"
                        : "border-transparent hover:border-muted-foreground/30"
                    )}
                    title={avatar.name}
                  >
                    <img
                      src={avatar.src}
                      alt={avatar.name}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

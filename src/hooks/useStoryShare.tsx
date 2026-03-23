import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import gavetaLogo from "@/assets/gavettalogo.png";

interface StoryShareContent {
  title: string;
  posterUrl?: string;
  backdropUrl?: string;
  type: 'movie' | 'series';
}

export function useStoryShare() {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const generateStoryImage = useCallback(async (content: StoryShareContent): Promise<Blob | null> => {
    return new Promise((resolve) => {
      // Dimensões do Story (9:16 aspect ratio)
      const STORY_WIDTH = 1080;
      const STORY_HEIGHT = 1920;

      const canvas = document.createElement('canvas');
      canvas.width = STORY_WIDTH;
      canvas.height = STORY_HEIGHT;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve(null);
        return;
      }

      // Usa backdrop se disponível, senão usa poster
      const imageUrl = content.backdropUrl || content.posterUrl;
      
      if (!imageUrl) {
        // Caso não tenha imagem, criar fundo gradiente
        const gradient = ctx.createLinearGradient(0, 0, 0, STORY_HEIGHT);
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(1, '#16213e');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);
        
        drawTextAndLogo(ctx, content, STORY_WIDTH, STORY_HEIGHT, resolve, canvas);
        return;
      }

      const bgImage = new Image();
      bgImage.crossOrigin = 'anonymous';
      
      bgImage.onload = () => {
        // Preencher o canvas com a imagem de fundo (cover)
        const scale = Math.max(STORY_WIDTH / bgImage.width, STORY_HEIGHT / bgImage.height);
        const x = (STORY_WIDTH - bgImage.width * scale) / 2;
        const y = (STORY_HEIGHT - bgImage.height * scale) / 2;
        
        ctx.drawImage(bgImage, x, y, bgImage.width * scale, bgImage.height * scale);
        
        // Overlay escuro para melhor legibilidade
        const overlay = ctx.createLinearGradient(0, 0, 0, STORY_HEIGHT);
        overlay.addColorStop(0, 'rgba(0, 0, 0, 0.3)');
        overlay.addColorStop(0.5, 'rgba(0, 0, 0, 0.2)');
        overlay.addColorStop(1, 'rgba(0, 0, 0, 0.7)');
        ctx.fillStyle = overlay;
        ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);
        
        drawTextAndLogo(ctx, content, STORY_WIDTH, STORY_HEIGHT, resolve, canvas);
      };

      bgImage.onerror = () => {
        // Fallback para gradiente se a imagem falhar
        const gradient = ctx.createLinearGradient(0, 0, 0, STORY_HEIGHT);
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(1, '#16213e');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);
        
        drawTextAndLogo(ctx, content, STORY_WIDTH, STORY_HEIGHT, resolve, canvas);
      };

      bgImage.src = imageUrl;
    });
  }, []);

  const drawTextAndLogo = (
    ctx: CanvasRenderingContext2D,
    content: StoryShareContent,
    width: number,
    height: number,
    resolve: (blob: Blob | null) => void,
    canvas: HTMLCanvasElement
  ) => {
    // Título centralizado na parte inferior
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Calcular tamanho da fonte baseado no tamanho do título
    const maxWidth = width - 120;
    let fontSize = 72;
    ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    
    while (ctx.measureText(content.title).width > maxWidth && fontSize > 36) {
      fontSize -= 4;
      ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    }

    // Quebrar título em múltiplas linhas se necessário
    const words = content.title.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    words.forEach((word) => {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(testLine).width > maxWidth) {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    });
    if (currentLine) lines.push(currentLine);

    // Posição do título (parte inferior, mas acima do logo)
    const titleY = height - 300;
    const lineHeight = fontSize * 1.2;
    const totalTextHeight = lines.length * lineHeight;
    const startY = titleY - totalTextHeight / 2;

    // Sombra no texto
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;

    lines.forEach((line, index) => {
      ctx.fillText(line, width / 2, startY + index * lineHeight);
    });

    // Tipo de conteúdo (Filme ou Série)
    ctx.shadowBlur = 10;
    ctx.font = `500 32px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    const typeLabel = content.type === 'movie' ? '🎬 Filme' : '📺 Série';
    ctx.fillText(typeLabel, width / 2, startY - 60);

    // Carregar e desenhar logo da Gavetta
    const logoImg = new Image();
    logoImg.crossOrigin = 'anonymous';
    
    logoImg.onload = () => {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 15;
      
      // Logo no topo
      const logoHeight = 60;
      const logoWidth = (logoImg.width / logoImg.height) * logoHeight;
      ctx.drawImage(logoImg, (width - logoWidth) / 2, 80, logoWidth, logoHeight);

      // CTA na parte inferior
      ctx.shadowBlur = 10;
      ctx.font = `500 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fillText('gavetta.lovable.app', width / 2, height - 100);

      // Converter para blob
      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/png', 0.95);
    };

    logoImg.onerror = () => {
      // Se o logo falhar, desenhar texto "Gavetta" como fallback
      ctx.shadowBlur = 10;
      ctx.font = `bold 48px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText('Gavetta', width / 2, 100);

      // CTA na parte inferior
      ctx.font = `500 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fillText('gavetta.lovable.app', width / 2, height - 100);

      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/png', 0.95);
    };

    logoImg.src = gavetaLogo;
  };

  const shareToStory = useCallback(async (content: StoryShareContent) => {
    setIsGenerating(true);

    try {
      const imageBlob = await generateStoryImage(content);
      
      if (!imageBlob) {
        throw new Error('Falha ao gerar imagem');
      }

      const file = new File([imageBlob], `gavetta-${content.title.toLowerCase().replace(/\s+/g, '-')}.png`, {
        type: 'image/png',
      });

      // Verificar se o Web Share API está disponível e suporta arquivos
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${content.title} - Gavetta`,
          text: `Confira "${content.title}" no Gavetta! 🎬\n\nhttps://gavetta.lovable.app`,
        });

        toast({
          title: "Compartilhado!",
          description: "Story pronto para publicar no Instagram.",
        });
      } else if (navigator.share) {
        // Fallback: compartilhar apenas texto/link se não suportar arquivos
        await navigator.share({
          title: `${content.title} - Gavetta`,
          text: `Confira "${content.title}" no Gavetta! 🎬`,
          url: 'https://gavetta.lovable.app',
        });

        toast({
          title: "Link compartilhado!",
          description: "Seu dispositivo não suporta compartilhamento de imagens.",
        });
      } else {
        // Fallback para desktop: baixar a imagem
        const url = URL.createObjectURL(imageBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gavetta-${content.title.toLowerCase().replace(/\s+/g, '-')}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast({
          title: "Imagem baixada!",
          description: "Abra o Instagram e compartilhe a imagem nos Stories.",
        });
      }
    } catch (error) {
      // Usuário cancelou o compartilhamento - não mostrar erro
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }

      console.error('Erro ao compartilhar:', error);
      toast({
        title: "Erro ao compartilhar",
        description: "Tente novamente ou baixe a imagem manualmente.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  }, [generateStoryImage, toast]);

  return {
    shareToStory,
    isGenerating,
  };
}

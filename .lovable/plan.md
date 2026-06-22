## Objetivo
Toda vez que o usuário compartilhar um Story do Instagram a partir de um filme/série no Gavetta, o link curto do card (`gavetta.com.br/m/{id}` ou `/s/{id}`) acompanha o compartilhamento, para que quem vir o Story consiga abrir aquele card específico.

## Limitação técnica importante (será comunicada ao usuário no toast)
O Instagram **não torna automaticamente clicável** um link que vem dentro de uma imagem compartilhada via Web Share API. Para virar clicável, o usuário precisa colar o link no **adesivo "Link"** do editor de Stories. Por isso, a estratégia é tripla:

1. **Imprimir o link no rodapé da imagem do Story** (visível para qualquer espectador digitar/lembrar).
2. **Copiar o link automaticamente para a área de transferência** antes de abrir o compartilhamento — assim o usuário só precisa colar no adesivo "Link" do Instagram.
3. **Incluir o link também no `text` do `navigator.share`** — em alguns destinos (não Stories) ele aparece como legenda.

## Mudanças

### 1. `src/hooks/useStoryShare.tsx`
- Estender `StoryShareContent` com:
  ```ts
  tmdbId?: number;
  // type já existe como 'movie' | 'series'
  ```
- Calcular `shareUrl`:
  ```ts
  const prefix = content.type === 'movie' ? 'm' : 's';
  const shareUrl = content.tmdbId
    ? `https://gavetta.com.br/${prefix}/${content.tmdbId}`
    : 'https://gavetta.com.br';
  ```
- Em `generateStoryImage`, substituir o rodapé atual:
  - Linha `gavetta.com.br` (linha 320) passa a renderizar `shareUrl` sem o prefixo `https://` (ex.: `gavetta.com.br/m/550`).
  - Manter "Crie sua conta grátis!" acima.
- Em `shareToStory`:
  - Antes do `navigator.share`, tentar `navigator.clipboard.writeText(shareUrl)` dentro de um try/catch (ignorar erro silenciosamente — clipboard pode falhar em alguns browsers/contextos sem HTTPS).
  - No payload `navigator.share({ files, ... })`, trocar o `text` para:
    ```
    Confira "${title}" no Gavetta! 🎬\n\n${shareUrl}
    ```
    e adicionar `url: shareUrl` (alguns targets usam um, outros outro).
  - No fallback "só texto" (`navigator.share` sem arquivos), passar `url: shareUrl`.
  - No fallback desktop (download), também copiar o link para clipboard.
  - Atualizar os toasts:
    - Sucesso com arquivo: "Story pronto! Link do card copiado — cole no adesivo **Link** do Instagram para deixar clicável."
    - Sucesso só texto: mensagem similar.
    - Desktop download: "Imagem baixada e link copiado. Abra o Instagram, adicione a imagem e cole o link no adesivo Link."

### 2. `src/components/ContentDetailDialog.tsx`
- Passar `tmdbId` para `shareToStory`. Já existe `extractTmdbInfoFromId(content.id)` usado no botão "Compartilhar link"; reaproveitar:
  ```ts
  const parsed = extractTmdbInfoFromId(content.id);
  shareToStory({
    title: content.title,
    posterUrl: content.posterUrl,
    backdropUrl: content.backdropUrl,
    type: content.type === 'movie' ? 'movie' : 'series',
    rating: contentDrawers.rating,
    userHandle: userHandle,
    tmdbId: parsed?.tmdbId,
  });
  ```

### 3. Sem mudanças de backend, rotas ou SEO
- A rota `/m/:id` e `/s/:id` já foi criada na etapa anterior, então o link já resolve.

## Validação
- Compartilhar um Story de um filme no mobile: confirmar que (a) a imagem mostra `gavetta.com.br/m/{id}` no rodapé, (b) o clipboard contém o mesmo link, (c) o toast orienta colar no adesivo Link.
- Mesmo fluxo numa série → URL com prefixo `/s/`.
- Desktop: confirmar download + clipboard + toast atualizado.
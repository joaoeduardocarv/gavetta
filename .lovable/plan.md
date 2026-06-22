## Objetivo
Cada filme/série passa a ter URL pública curta:
- Filme: `gavetta.com.br/m/{tmdbId}`
- Série: `gavetta.com.br/s/{tmdbId}`

Os links antigos `/share/movie/{id}` e `/share/tv/{id}` continuam funcionando via redirect automático para o novo formato.

## Mudanças

### 1. Roteamento (`src/App.tsx`)
- Adicionar duas rotas novas apontando para `SharePage`:
  - `/m/:tmdbId` → renderiza `<SharePage forcedType="movie" />`
  - `/s/:tmdbId` → renderiza `<SharePage forcedType="tv" />`
- Manter `/share/:type/:tmdbId`, porém apontando para um pequeno componente `LegacyShareRedirect` que faz `<Navigate replace to={`/${type === 'movie' ? 'm' : 's'}/${tmdbId}`} />`. Isso preserva todo link já compartilhado por usuários.

### 2. `src/pages/SharePage.tsx`
- Aceitar a prop opcional `forcedType?: "movie" | "tv"`. Quando presente, usa ela; quando ausente, mantém o comportamento atual de ler `type` da URL (fallback de segurança, mas as novas rotas sempre passam `forcedType`).
- Resto da página (loader, Helmet OG/Twitter, layout) permanece igual.

### 3. Geração de link de compartilhamento (`src/components/ContentDetailDialog.tsx` linha 863)
- Trocar:
  ```ts
  const url = `${window.location.origin}/share/${parsed.mediaType}/${parsed.tmdbId}`;
  ```
  por:
  ```ts
  const prefix = parsed.mediaType === "movie" ? "m" : "s";
  const url = `${window.location.origin}/${prefix}/${parsed.tmdbId}`;
  ```
- Mesmo tratamento em qualquer outro local que monte URL de share (verificar `useStoryShare` e geração de imagem de Story; ajustar se também montarem `/share/...`).

### 4. Riscos de colisão
- Rotas existentes ocupam: `/welcome`, `/auth`, `/signup-help`, `/`, `/my-drawers`, `/friends`, `/search`, `/trending`, `/profile`, `/u/:username`, `/share/...`, `/admin/...`. Os prefixos `/m/` e `/s/` estão livres e não conflitam com nada planejado.

### 5. SEO
- `public/sitemap.xml`: hoje é estático e não lista conteúdos individuais. Não vamos gerar entradas por filme/série agora (seriam dezenas de milhares vindas do TMDB). As metatags OG/Twitter já existentes em `SharePage` continuam cobrindo o preview por link.

### 6. Sem mudanças de backend
- Nenhuma migração necessária. RLS e edge functions permanecem intactas.

## Validação
- Abrir `/m/550` (Clube da Luta) e `/s/1399` (Game of Thrones) e conferir carregamento + metatags.
- Abrir um link antigo `/share/movie/550` e confirmar redirect para `/m/550`.
- Clicar em "Compartilhar" num card e verificar que a URL copiada está no novo formato.
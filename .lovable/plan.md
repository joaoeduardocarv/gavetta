## Toggle de idioma do título

### Como vai funcionar

- Um pequeno botão ícone (ex.: `Languages` do lucide, ou texto "Aa") fica ao lado do título no `ContentDetailDialog` e na `SharePage`.
- Clicar nele alterna **globalmente** entre exibir o título em pt-BR (padrão atual) ou o `originalTitle` que o TMDB já devolve.
- A escolha é salva em `localStorage` (`gavetta:titleLang` = `"pt"` | `"original"`) e propagada via um pequeno hook/contexto, então todos os `ContentCard` da busca, gavetas, trending, perfil público e detalhes refletem a mesma preferência sem nova requisição.
- Quando não houver `originalTitle` (ou ele for igual ao traduzido), o componente cai silenciosamente para o título disponível — o toggle some nesse caso para não confundir.

### Onde aparece

- `ContentDetailDialog` (modal de detalhes): toggle ao lado do título, com tooltip "Mostrar título original / Mostrar em português".
- `SharePage` (`/share/:type/:tmdbId`): mesmo toggle, mesma lógica.
- `ContentCard` (busca, gavetas, trending, recomendações, perfil público): apenas reage à preferência global; sem botão próprio para evitar poluição visual.

### Escopo intencionalmente limitado

- Sinopse, gêneros e elenco continuam em pt-BR (não muda esse texto).
- Não toca em dados salvos no banco — `production_data.title` permanece como está; a troca é só de apresentação.

### Detalhes técnicos

- Novo hook `useTitleLanguage()` em `src/hooks/useTitleLanguage.tsx`:
  - Lê/escreve `localStorage` e expõe `{ lang, toggle, resolveTitle(content) }`.
  - Usa um `Store` simples (event emitter ou `useSyncExternalStore`) para que todos os componentes re-renderizem ao alternar, sem precisar de Provider envolvendo a app.
- `resolveTitle(content)` retorna `content.originalTitle` quando `lang === "original"` e o original existe e é diferente do título atual; caso contrário retorna `content.title`.
- Componentes afetados (apenas substituem a leitura direta de `content.title` por `resolveTitle(content)`):
  - `src/components/ContentCard.tsx`
  - `src/components/ContentDetailDialog.tsx` (título + adiciona o botão)
  - `src/pages/SharePage.tsx` (título + helmet/SEO + botão)
- Garantir que `originalTitle` já vem do normalizador (`src/lib/contentNormalizer.ts` linha ~200 já preenche). Para `getMovieDetails`/`getTVDetails` na SharePage, o TMDB retorna `original_title`/`original_name` — vou passar pelo normalizador antes de exibir.
- Sem mudanças de schema, sem migração, sem nova chamada ao TMDB.

### Fora do escopo

- Tradução de sinopse/gêneros (poderia ser feita depois com uma segunda chamada `language=en-US`, mas hoje não faz parte).
- Preferência sincronizada com perfil no Supabase (fica só local por enquanto — simples e instantâneo).

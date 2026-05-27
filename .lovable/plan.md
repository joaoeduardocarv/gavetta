# Gaveta do Destino

Funcionalidade exclusiva na tela `/search` que sugere um único filme/série personalizado, usando apenas os dados de avaliações do próprio usuário + TMDB.

## 1. UI — Card de entrada (topo do Search)

Adicionar acima do campo de busca um card destacado:
- Ícone de gaveta com brilho dourado (Sparkles + GavetaIcon, gradiente dourado coerente com o branding).
- Título "Gaveta do Destino" + subtítulo curto ("Uma escolha feita pra você").
- Tap abre um `Dialog` dedicado (`DestinyDrawerDialog`).

## 2. Algoritmo (client-side, em `src/lib/destinyDrawer.ts`)

Entrada: avaliações do usuário em `user_drawer_assignments` (campo `rating`) — mesma fonte do RatingDialog.

Passos:
1. Buscar todas as assignments do usuário onde `rating >= 7`. Se `< 3` avaliações totais com rating, mostrar estado vazio ("Avalie pelo menos 3 títulos…").
2. Para cada item, ler `production_data.genres` (já normalizado por `contentNormalizer`) e contar frequência. Empates desempatam pela média de rating do usuário no gênero.
3. Pegar top 2–3 gêneros. Mapear nomes → IDs via `MOVIE_GENRES`/`TV_GENRES` de `src/lib/tmdb.ts`.
4. Chamar `discoverMovies` + `discoverTVShows` com esses gêneros (ver §3) — sort por popularity, língua pt-BR.
5. Filtrar resultados:
   - Remover qualquer `tmdbId` presente em qualquer drawer do usuário (`assistidos`, `assistindo`, `watchlist`, customizadas).
   - Remover itens já sorteados na sessão atual (lista mantida em estado do Dialog).
   - Remover itens sem poster.
6. Ordenar pelo score: `vote_average * 0.6 + popularity_normalizada * 0.4`. Pegar top 10 e sortear 1.

## 3. Suporte a múltiplos gêneros na edge function TMDB

`supabase/functions/tmdb/index.ts` hoje aceita um único `genreId` em `discoverMovies`/`discoverTVShows`. Estender para aceitar `genreIds` (CSV) e repassar como `with_genres=28,12` (OR no TMDB). Manter compatibilidade com `genreId`.

Atualizar `discoverMovies`/`discoverTVShows` em `src/lib/tmdb.ts` para aceitar `genreIds?: number[]`.

## 4. Dialog (`src/components/DestinyDrawerDialog.tsx`)

Estados:
- `loading` → animação temática (gaveta abrindo + partículas douradas via Tailwind `animate-*` + custom keyframes em `tailwind.config.ts`).
- `empty` (< 3 avaliações) → mensagem orientativa + CTA "Ir para Buscar".
- `result` → reusar visual do `ContentCard` (poster, nota TMDB, gêneros, plataformas BR via `getMovieWatchProviders`/`getTVWatchProviders`).
- Abaixo do card: frase dinâmica "Você curte muito **{Gênero1}** e **{Gênero2}** — esse foi escolhido pra você."
- Botões: **Revelar outro** (refaz exclui o atual) e **Adicionar à watchlist** (usa fluxo padrão de adicionar a gaveta `watchlist`).
- Tap no card abre `ContentDetailDialog` existente (sem duplicar lógica).

## 5. Identidade visual dourada

Adicionar tokens em `src/index.css` (HSL):
- `--destiny-gold` e `--destiny-gold-glow`
- `--gradient-destiny: linear-gradient(135deg, hsl(var(--destiny-gold)), hsl(var(--destiny-gold-glow)))`
- `--shadow-destiny`

Adicionar keyframes `drawer-open` e `gold-particles` em `tailwind.config.ts` para a animação de loading. Sem libs novas.

## 6. Arquivos

Criar:
- `src/components/DestinyDrawerCard.tsx` (entrada no topo do Search)
- `src/components/DestinyDrawerDialog.tsx` (dialog principal)
- `src/lib/destinyDrawer.ts` (algoritmo: fetch ratings, ranking de gêneros, seleção)

Editar:
- `src/pages/Search.tsx` — montar `<DestinyDrawerCard />` no topo do `<main>`.
- `src/lib/tmdb.ts` — `discoverMovies/discoverTVShows` aceitando `genreIds`.
- `supabase/functions/tmdb/index.ts` — suporte a `genreIds` CSV.
- `src/index.css` + `tailwind.config.ts` — tokens dourados + keyframes.

## 7. Fora do escopo

- Sem nova tabela/migration (lê de `user_drawer_assignments` existente).
- Sem IA externa, sem novas dependências.
- Sem persistência da última recomendação (estado fica no Dialog).

Gostei muito da ideia. Hoje o usuário sai do tour com a biblioteca vazia, e ter que buscar item por item é o maior atrito do onboarding. Um "quick-start" com populares resolve isso em segundos e ainda gera dado real de catálogo (gavetas Assistidos / Para Assistir) que melhora recomendações futuras (Destiny Drawer, feed de amigos, etc.).

## O que será construído

Um novo passo final no fluxo de onboarding: **"Vamos montar sua estante em 1 minuto"**. Aparece logo após o usuário concluir (ou pular) o tour dos botões, na primeira sessão. Pode ser pulado a qualquer momento.

### Fluxo

```text
Tour de botões  →  Tela "Monte sua estante"  →  MyDrawers populado
                          │
                          ├─ Card grande do título atual (poster, ano, gêneros, sinopse curta)
                          ├─ [✓ Já vi] → abre seletor de nota 1-10 + comentário opcional
                          │              → salva em Assistidos
                          ├─ [+ Quero ver] → salva em Para Assistir
                          ├─ [↪ Pular]    → próximo
                          └─ Indicador "3 de 20"  ·  botão "Encerrar" no topo
```

- Lote de **20 títulos populares**, mistura ~60% filmes e ~40% séries, tirados do TMDB `trending/all/week` via a Edge Function `tmdb` já existente.
- Filtra títulos já presentes em qualquer gaveta do usuário para não repetir.
- "Já vi" reaproveita o `GlobalRatingDialog` / fluxo de avaliação obrigatória que já vigora para Assistidos.
- Ao encerrar, marca conclusão em localStorage (`gavetta:quickstart-done:{userId}`) para não reaparecer.
- Botão **"Adicionar mais populares"** discreto no topo da página Minhas Gavettas quando a estante estiver com menos de 5 itens, caso o usuário queira voltar.

### Aparência

- Mobile-first, fullscreen sheet com fundo escurecido (mesmo padrão visual do tour).
- Poster grande centralizado, título e metadados abaixo, três botões grandes empilhados (verde "Já vi", azul "Quero ver", neutro "Pular").
- Pequena barra de progresso no topo.
- Animação suave de swipe horizontal ao trocar de item.

## Detalhes técnicos

- **Novo componente:** `src/components/QuickStartLibrary.tsx` (renderizado no `App.tsx` após `OnboardingDialog`).
- **Dados:** chamada única a `supabase.functions.invoke('tmdb', { body: { endpoint: 'trending/all/week' } })`. Normaliza via `src/lib/contentNormalizer.ts` antes de exibir.
- **Filtro de duplicatas:** consulta `user_drawer_assignments` do usuário (já cacheada por `useDrawers`) e remove tmdb_ids já existentes.
- **Persistência:**
  - "Quero ver" → insert em `user_drawer_assignments` com `drawer_id = 'to_watch'`.
  - "Já vi" → abre o fluxo padrão de avaliação obrigatória (`GlobalRatingDialog`) e, ao confirmar, insere em `drawer_id = 'watched'` com `rating` e `comment`.
- **Gatilho:** após `OnboardingDialog.finish()`, seta um estado em contexto/localStorage que dispara o quick-start na próxima renderização do `/` (rota MyDrawers). Não aparece em outras rotas para não atrapalhar.
- **Skip total:** botão "Encerrar agora" sempre visível; também é registrado como concluído.
- **Sem novas tabelas nem mudanças de RLS** — usa as existentes.

## Fora do escopo desta etapa

- Algoritmo de recomendação personalizado em si (apenas captura os dados que servirão de base).
- Filtros por gênero, plataforma de streaming ou década (pode virar v2).
- Importar histórico de outras plataformas (Letterboxd, Trakt).
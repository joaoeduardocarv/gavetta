# Popup ao marcar o último episódio disponível

## Objetivo
Quando o usuário marca como assistido o **último episódio já lançado** de uma série dentro do `SeasonsAccordion`, abrir um diálogo de confirmação ("Sim/Não") perguntando se quer **mover o card direto para a gaveta "Assistido"**. Se a série ainda não terminou (status TMDB diferente de `Ended`/`Canceled`), exibir um aviso claro de que ainda há temporadas/episódios por vir.

## Comportamento

1. Após cada `toggleEpisode` que marca (não desmarca) um episódio, comparar `totalWatched + 1` com o número total de **episódios já lançados** (aired) da série inteira.
2. Se atingiu 100% dos lançados E a série ainda não está na gaveta `watched`, abrir um `AlertDialog`.
3. O diálogo mostra:
   - Título: "Você assistiu tudo que está disponível!"
   - Se `status === 'Ended'` ou `'Canceled'`: subtítulo "A série está finalizada. Mover para Assistido?"
   - Caso contrário (`Returning Series`, `In Production`, etc.): subtítulo + **aviso destacado** "Atenção: a série ainda está em produção e novos episódios devem ser lançados. Você poderá continuar marcando episódios futuros mesmo após mover."
   - Botões: "Agora não" (cancelar) e "Mover para Assistido" (confirmar).
4. Confirmar → chama o fluxo existente que move o conteúdo para a gaveta `watched` (mesma rota usada pelo `DrawerPickerPopover`/`ContentDetailDialog`, que dispara o `GlobalRatingDialog` para pedir nota 1-10 obrigatória, mantendo a regra atual de avaliação obrigatória).
5. Disparado **uma única vez por sessão de visualização** (state local) para não reaparecer caso o usuário desmarque/remarque.

## Arquivos afetados

- `src/components/SeasonsAccordion.tsx`
  - Aceitar nova prop opcional `seriesStatus?: string` e `contentId?: string` (ou já consumir do contexto).
  - Detectar transição "último ep aired marcado" no `onCheckedChange` do checkbox e no botão "Marcar episódios já lançados".
  - Renderizar `AlertDialog` com a lógica de aviso.
  - Chamar a função do `DrawerContext` que move para `watched` (reutilizar `setContentDrawer('watched', ...)` que já existe e dispara o rating obrigatório).
- `src/components/ContentDetailDialog.tsx`
  - Passar `seriesStatus` (de `TMDBTVDetails.status`) e `content` para o `SeasonsAccordion`.

## Detalhes técnicos

- "Último episódio disponível" = `airedEpisodesCount` somado em todas as temporadas (excluindo season 0). Calculado a partir de `episodesBySeason` já carregado; se nem todos os seasons foram abertos, carregar sob demanda apenas no momento da checagem (`Promise.all(getSeasonEpisodes)` para os faltantes), igual ao `handleMarkAllAired`.
- Status "em andamento" = qualquer valor diferente de `Ended` e `Canceled` (TMDB usa também `Returning Series`, `In Production`, `Pilot`, `Planned`).
- Verificação de "já está em watched" usa `useDrawers().getContentDrawers(contentId).defaultDrawer === 'watched'`.
- Sem mudanças no banco; só UX no cliente.

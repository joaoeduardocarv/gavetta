# Por que "Rio, Zona Norte" não mostrou as infos

Testei a busca no app com esse título. O que aparece hoje no card:

- Duração: **aparece** ("1957 • 1h 22min • Drama • Música")
- Onde assistir: **não aparece** — o catálogo do TMDB não lista nenhuma opção no Brasil para esse filme (nem assinatura, nem aluguel, nem compra)

Ou seja, não é um erro do app: é ausência de dado na fonte. Filmes brasileiros antigos costumam ter essa lacuna.

Sobre aluguel/compra: o app **já** considera assinatura, aluguel e compra ao montar a lista de "disponível em". Nesse título específico não há nenhuma das três.

## O que proponho fazer

1. Deixar explícito no card quando não há nenhuma opção de assistir no Brasil, em vez de simplesmente não mostrar nada — uma etiqueta discreta do tipo "Sem opções no Brasil".
2. Diferenciar visualmente, no card, o que é assinatura e o que é só aluguel/compra, para não dar a impressão de que está incluso na assinatura.
3. Aplicar isso tanto nos mini cards da busca quanto nos cards das gavettas, mantendo o mesmo padrão visual.

## Detalhes técnicos

- `src/lib/tmdb.ts`: `extractStreamingNames` / `extractStreamingLogos` já agregam `flatrate`, `rent` e `buy`; incluir no retorno dos logos a marcação de tipo de oferta já disponível (`offerType`) para uso na interface.
- `src/components/ContentCard.tsx`: quando o enriquecimento terminar e a lista de provedores vier vazia (e o título não estiver nos cinemas nem marcado como "Em breve"), renderizar a etiqueta de indisponibilidade; usar um estado de "carregando" para não piscar a etiqueta antes dos dados chegarem.
- Marcar visualmente os logos de `rent`/`buy` (ex.: pequeno indicador "$") para distinguir de assinatura.
- Mesma exibição reaproveitada em `src/pages/Search.tsx` e `src/pages/MyDrawers.tsx`, já que ambos usam `ContentCard`.

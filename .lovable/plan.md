# Premiações nos filmes e séries

## Resposta curta

O TMDB **não** fornece premiações. Nem Oscar, nem Globo de Ouro, nem Emmy. Para ter isso é preciso uma segunda fonte.

A fonte mais simples e confiável é o **OMDb**, que devolve um resumo pronto por título, do tipo "Ganhou 2 Oscars. 158 vitórias e 271 indicações". A chave é gratuita e leva um minuto para criar (1.000 consultas por dia, o que é suficiente porque os dados ficam guardados no seu banco e quase nunca mudam).

## O que eu faria

1. **Selo discreto no mini card** — uma estatueta dourada pequena no canto do pôster apenas para títulos que **venceram** Oscar, Globo de Ouro ou Emmy. Nada de poluir cards sem prêmio.
2. **Seção "Premiações" no card de detalhes** — logo abaixo das notas: os prêmios de destaque em destaque (estatueta + "2 Oscars"), e abaixo a linha resumo "158 vitórias e 271 indicações".
3. **Nada aparece quando não há dados** — título sem premiação simplesmente não mostra a seção, sem "carregando" nem espaço vazio.

## Como funciona por trás

- Nova tabela `title_awards` (chave: tipo + id do TMDB) com o texto bruto, contagens de Oscar/Globo/Emmy, total de vitórias e indicações, e data da última consulta. RLS: leitura pública, escrita só pelo serviço.
- Nova Edge Function `awards`: recebe tipo + id do TMDB, resolve o `imdb_id` via `external_ids` do TMDB, consulta o OMDb, interpreta o campo `Awards` (vencedor x indicado, quantos Oscars, totais) e grava no cache. Revalida só depois de 30 dias.
- Hook `useAwards(type, tmdbId)` no front: lê o cache; se não existir, chama a função em segundo plano e atualiza sem travar a interface.
- Componentes tocados: `ContentCard.tsx` (selo), `ContentDetailDialog.tsx` (seção), mais um `AwardsBadge.tsx` novo.
- O texto do OMDb vem em inglês; a interpretação converte para rótulos em português ("Oscar", "vitórias", "indicações").

## O que preciso de você

A chave gratuita do OMDb: cadastre-se em omdbapi.com/apikey.aspx, confirme pelo e-mail, e eu peço a chave num formulário seguro na hora de implementar.

## Alternativa sem chave

Dá para usar a Wikidata, que é gratuita e sem cadastro, e permite listar prêmios nominais (categoria e ano). A contrapartida é cobertura irregular, principalmente em títulos brasileiros e lançamentos recentes. Se preferir esse caminho, me avise que eu troco a fonte do plano.

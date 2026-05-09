
## Sobre os preços

**Preço por título não é possível** com nossa stack atual. A TMDB expõe os watch providers do JustWatch separados por categoria (`flatrate`, `rent`, `buy`, `free`, `ads`), mas **não retorna valores monetários**. Para preços precisaríamos da API direta do JustWatch (paga, com contrato comercial) ou scraping (frágil e contra os termos).

O que conseguimos fazer hoje, e que cobre 95% da intenção: **mostrar com clareza em qual modalidade o título está disponível em cada streaming no Brasil** (Incluso, Aluguel, Compra, Grátis com anúncios).

## O que muda

Hoje juntamos `flatrate + rent + buy` numa lista única de logos, então um filme que está só para alugar na Prime aparece igualzinho a um que está incluso na assinatura. A proposta é separar e rotular.

### 1. Backend (edge function `tmdb`)

`getMovieWatchProviders` / `getTVWatchProviders` já retornam o objeto `BR` cru com `flatrate/rent/buy/free/ads` — não precisa mudar a função, só consumir esses campos no front (já vêm).

### 2. Camada de dados (`src/lib/tmdb.ts`)

Estender `extractStreamingLogos` para devolver também o tipo da oferta:

```ts
type OfferType = 'flatrate' | 'rent' | 'buy' | 'free' | 'ads';
{ name, logoPath, offerTypes: OfferType[] } // um provider pode ter mais de uma
```

E manter `extractStreamingNames` retrocompatível.

### 3. UI

**ContentCard (lista compacta)**
- Manter os logos como hoje
- Adicionar um anel/badge sutil no canto da logo:
  - Sem decoração = Incluso na assinatura (flatrate)
  - Ícone `$` pequeno no canto = só Aluguel/Compra
- Tooltip ao tocar/hover: "Prime Video · Aluguel/Compra"

**ContentDetailDialog (tela de detalhes)**
- Substituir a lista única "Disponível em" por seções rotuladas:
  - **Incluso na assinatura** — logos flatrate
  - **Alugar** — logos rent
  - **Comprar** — logos buy
  - **Grátis com anúncios** — logos ads/free (se houver)
- Cada logo continua clicável (abre o link do JustWatch quando disponível, ou só visual)
- Nota pequena no rodapé: "Disponibilidade fornecida por JustWatch · Brasil"

### 4. Filtros existentes (Trending, Search, etc.)

Se já existe filtro por streaming, adicionar um sub-filtro opcional "Apenas incluso na assinatura" para o usuário não ser enganado por um título que aparece como "Netflix" mas é só aluguel.

## Sobre o preço — alternativas se for crítico

1. **Aceitar sem preço** (recomendado): rotular a modalidade resolve a confusão principal sem custo nem fragilidade.
2. **Link direto pro JustWatch**: clicar na logo abre o JustWatch BR daquele título, onde o usuário vê o preço atualizado. Baixo esforço, resolve sem manter dados.
3. **Scraping do JustWatch**: não recomendado — viola ToS, quebra fácil, exige manutenção.
4. **API JustWatch oficial**: paga, requer contrato. Fora de escopo para o momento.

A opção **2 (link pro JustWatch)** combina muito bem com a separação por modalidade e é praticamente "preço com 1 clique".

## Resumo do entregável proposto

- Separar `flatrate`/`rent`/`buy`/`ads` em vez de misturar
- Rotular nos detalhes ("Incluso", "Alugar", "Comprar")
- Indicador visual no card quando não estiver incluso em nenhuma assinatura
- Logos clicáveis → JustWatch BR (preço sempre atualizado pela fonte)
- Sem preço dentro do app

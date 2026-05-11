## Problema

Itens antigos (como "Ex Machina") foram salvos com `availableOn` em texto mas sem `watchProviderLogos`. A migração atual em `useMigrateIncompleteContent.tsx` não detecta esse caso, então o card cai no fallback de texto e nunca recebe os logos.

## Correção

Em `src/hooks/useMigrateIncompleteContent.tsx`, ajustar a lógica de `needsEnrichment` (linhas 41-54) adicionando uma condição `missingLogos`:

```ts
const availableOnArr = Array.isArray(data.availableOn) ? data.availableOn : [];
const logos = Array.isArray(data.watchProviderLogos)
  ? (data.watchProviderLogos as Array<Record<string, unknown>>)
  : [];

const hasGenres = Array.isArray(data.genres) && data.genres.length > 0;
const hasDirector = !!data.director;
const hasAvailableOn = Array.isArray(data.availableOn);

// Logos faltando quando availableOn já tem dados (formato legado)
const missingLogos = availableOnArr.length > 0 && logos.length === 0;

// Logos no formato antigo (sem offerTypes)
const hasOfferTypes = logos.length === 0
  ? true
  : logos.some(l => Array.isArray(l.offerTypes) && (l.offerTypes as unknown[]).length > 0);

return !hasGenres || !hasDirector || !hasAvailableOn || !hasOfferTypes || missingLogos;
```

## Resultado

No próximo carregamento da home/gavetas, o hook detecta os itens legados, busca os providers no TMDB e popula `watchProviderLogos` (com `offerTypes`) e `watchProvidersLink`. O `ContentCard` passa a renderizar a logo do Prime Video — com badge `$` se for só aluguel/compra.

## Arquivo alterado

- `src/hooks/useMigrateIncompleteContent.tsx`

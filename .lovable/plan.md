## Diagnóstico

A parte visual **já está pronta**: o mini-card já mostra os ícones de aluguel/compra com badge `$` no canto, e o detalhe já agrupa por "Incluso na assinatura / Alugar / Comprar / Grátis". O que falta é a **notificação automática** quando um filme das suas gavetas "Quero ver" ou "Vendo" chega ao VOD (aluguel/compra) pela primeira vez.

Hoje já existe a notificação `streaming_change` (para assinatura), mas ela compara só `flatrate` — ignora `rent` e `buy`.

A migration que adiciona a coluna `vod_arrival` em `notification_preferences` (default `true`) já foi aplicada.

## Mudanças

### 1. Edge function `check-content-updates`
- Adicionar helper `vodProvidersAppeared(oldProviders, newProviders)` que compara `rent ∪ buy` antigos vs novos e retorna `true` apenas quando passou de **zero para um ou mais provedores**.
- Aplicar somente quando `production_type === 'movie'` (filme).
- Disparar notificação tipo `vod_arrival` com título `💵 {título} já pode ser alugado` e mensagem listando os provedores que apareceram.
- Respeitar `userWants(userId, 'vod_arrival')` na nova chave `vod_arrival` do mapa de preferências.
- Reaproveita o dedup de 24h já existente.

### 2. Front-end — UI da notificação
- `src/hooks/useNotifications.tsx`: adicionar `"vod_arrival"` na união de tipos.
- `src/hooks/useContentNotifications.tsx`: incluir `"vod_arrival"` em `CONTENT_NOTIFICATION_TYPES` para que o sino pisque no mini-card também por VOD.
- `src/components/NotificationsPopover.tsx`: adicionar case `vod_arrival` em `getNotificationIcon` usando `DollarSign` em tom accent.

### 3. Preferências de notificação
- `src/components/NotificationSettingsDialog.tsx`:
  - Adicionar `vod_arrival: boolean` no tipo `Preferences` e no `defaultPrefs`.
  - Incluir no `select` da query e no `upsert`.
  - Novo item de toggle com ícone `DollarSign`, label **"Disponível para alugar"** e descrição **"Quando um filme das suas gavetas chega para aluguel ou compra digital"**.

## Comportamento final

- Funciona apenas para **filmes** em `want_to_watch` ou `watching` (já é o filtro padrão da função).
- Notifica **apenas a estreia em VOD** (primeira vez que aparece em `rent` ou `buy`). Se já havia VOD e só mudou o provedor, não notifica — evita ruído.
- Quem desligar o toggle nas preferências para de receber.
- Roda no mesmo cron diário (`check-content-updates`) que já existe.

## Fora de escopo

- Notificação de saída do VOD.
- Notificação de mudança de preço.
- Aplicar a séries (raro elas terem janela de VOD relevante).
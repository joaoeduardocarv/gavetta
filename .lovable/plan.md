## Contador de revisitas (rewatches)

Permite marcar quantas vezes você já reviu um filme/série depois que ele entra em **Assistidos**. A nota original permanece intocada — só conta quantas vezes você revisitou.

### Backend

Nova coluna simples em `user_drawer_assignments`:
- `rewatch_count` (integer, default 0, not null)

Sem tabela de histórico — só o número, conforme escolhido. Atualização via `UPDATE` no próprio assignment (RLS já cobre: `auth.uid() = user_id`).

### Regras

- Só aparece quando o item está no drawer `watched`
- A 1ª vez que entra em Assistidos = 0 revisitas (badge oculto)
- Botão "Vi de novo" incrementa para 1, 2, 3… → aí o badge passa a aparecer
- Permite decrementar (caso de erro) via long-press / menu

### UI

**ContentCard** (`src/components/ContentCard.tsx`)
- Badge pequeno ao lado do rating: ícone `Repeat` (lucide) + número, ex: `↻ 3`
- Estilo: `Badge variant="outline"` com `border-accent/40 text-accent` (segue padrão do badge de episódios)
- Só renderiza se `rewatch_count > 0` e está em Assistidos

**ContentDetailDialog** (`src/components/ContentDetailDialog.tsx`)
- Quando o conteúdo está em Assistidos, mostrar uma linha tipo:
  - `↻ Vista 3 vezes` + botão `+ Vi de novo`
  - Botão secundário `−` discreto para corrigir (com confirmação se for pra 0)
- Toast: "Marcado como revisita #4 ↻"

**Feed de amigos** (`src/components/ActivityFeed.tsx` + `src/hooks/useFriendActivities.tsx`)
- Nova entrada de atividade tipo `rewatch`: "João reviu *Interestelar* (4ª vez)"
- Mesmo card visual das outras atividades (poster 56×56)
- Disparada toda vez que `rewatch_count` é incrementado

### Acesso aos dados

Hook novo `useRewatch(productionId)`:
- `count: number`
- `increment(): Promise<void>` — UPDATE + toast + (opcional) notificação a amigos
- `decrement(): Promise<void>`

Usar dentro de `DrawerContext` ou compor com `getContentDrawers` pra saber se está em Assistidos antes de mostrar UI.

### Privacidade

- `rewatch_count` herda RLS do `user_drawer_assignments` (amigos já podem ver assignments de `watched` — policy "Users can view friends watched assignments")
- Perfil público também vê (policy "Public profile drawer assignments are viewable")

### Arquivos afetados

```
supabase/migrations/...        (nova coluna rewatch_count)
src/contexts/DrawerContext.tsx (expor count + ações)
src/hooks/useRewatch.tsx       (novo)
src/components/ContentCard.tsx (badge ↻N)
src/components/ContentDetailDialog.tsx (botão + linha "Vista Nx")
src/hooks/useFriendActivities.tsx (incluir eventos rewatch)
src/components/ActivityFeed.tsx (renderizar "reviu X")
```

### Fora de escopo (decidido)

- Sem histórico de datas
- Sem re-avaliação a cada revisita (nota original preservada)
- Sem stats agregadas no perfil ("mais revisto") — pode vir depois

# Checklist de QA — Redirecionamentos de primeira visita

Valida o comportamento implementado em `src/components/ProtectedRoute.tsx` +
`src/lib/sessionVisit.ts`.

## Conceito

- **Sessão nova** = navegador acabou de abrir (ou aba anônima nova). `sessionStorage` está vazio.
- **Mesma sessão** = aba/janela continua aberta, mesmo após refresh.
- **Flag** = `sessionStorage["gavetta:session-visited"] = "1"`.

A flag é setada quando: (a) usuário deslogado é redirecionado para `/welcome`,
(b) usuário logado entra em qualquer rota protegida, (c) `signOut()` é chamado.

---

## Pré-requisitos

- DevTools aberto em **Application → Storage → Session Storage** para inspecionar a chave.
- Testar em janela **anônima** garante sessão limpa a cada teste.
- Repetir os cenários críticos em **mobile** (Safari iOS / Chrome Android).

---

## Cenários

### ✅ Cenário 1 — Primeiro acesso sem login
1. Abrir janela anônima.
2. Acessar `https://gavetta.com.br/`.
3. **Esperado**: redireciona para `/welcome`. Flag `gavetta:session-visited = 1` aparece no Session Storage.

### ✅ Cenário 2 — Refresh em `/welcome` (mesma sessão, sem login)
1. Continuação do Cenário 1.
2. Dar **F5** em `/welcome`.
3. **Esperado**: continua em `/welcome` (rota pública, sem redirect). Flag permanece.

### ✅ Cenário 3 — Navegar para rota protegida na mesma sessão (sem login)
1. Continuação do Cenário 1.
2. Acessar manualmente `https://gavetta.com.br/my-drawers`.
3. **Esperado**: redireciona para `/auth` (não para `/welcome`).

### ✅ Cenário 4 — Refresh em rota protegida na mesma sessão (sem login)
1. Continuação do Cenário 3.
2. Dar **F5**.
3. **Esperado**: continua redirecionando para `/auth`.

### ✅ Cenário 5 — Acesso direto a `/welcome` por link compartilhado
1. Janela anônima nova.
2. Colar `https://gavetta.com.br/welcome` direto na barra.
3. **Esperado**: mostra a landing. Flag **não** é setada (rota pública não dispara o ProtectedRoute).
4. Acessar `/` em seguida → vai para `/welcome` novamente (porque a flag ainda não existe).

### ✅ Cenário 6 — Login bem-sucedido
1. Continuação do Cenário 3 (em `/auth`).
2. Fazer login.
3. **Esperado**: vai para `/` (home — MyDrawers). Flag fica `1`.

### ✅ Cenário 7 — Refresh estando logado
1. Continuação do Cenário 6.
2. Dar **F5** em `/my-drawers`.
3. **Esperado**: continua na página, sem flash de `/welcome` ou `/auth`.

### ✅ Cenário 8 — Logout
1. Continuação do Cenário 6 (logado).
2. Fazer logout.
3. **Esperado**: vai para `/auth` (não para `/welcome`). Flag continua `1`.

### ✅ Cenário 9 — Após logout, navegar para rota protegida
1. Continuação do Cenário 8.
2. Acessar `/friends`.
3. **Esperado**: redireciona para `/auth`.

### ✅ Cenário 10 — Fechar e reabrir o navegador (CRÍTICO)
1. Continuação do Cenário 8 (deslogado, flag setada).
2. **Fechar todas as abas/janela do navegador**.
3. Abrir novamente e acessar `https://gavetta.com.br/`.
4. **Esperado**: vai para `/welcome` novamente (sessionStorage foi limpa).

> ⚠️ **Atenção**: navegadores móveis às vezes mantêm a aba viva em background. Para testar de verdade, force fechamento (swipe up + remover do app switcher).

### ✅ Cenário 11 — Fechar/abrir estando logado
1. Logado em `/`.
2. Fechar navegador, reabrir, acessar `https://gavetta.com.br/`.
3. **Esperado**: continua logado (Supabase persiste em localStorage), vai direto para `/`. Não passa por `/welcome`.

### ✅ Cenário 12 — Subdomínio www
1. Repetir Cenários 1, 6 e 10 usando `https://www.gavetta.com.br/` em vez do domínio raiz.
2. **Esperado**: comportamento idêntico (mesmo app, mesmo storage por origin).

> ℹ️ `gavetta.com.br` e `www.gavetta.com.br` são origins **diferentes** para o navegador — sessionStorage não é compartilhada. Se o Primary Domain redireciona um para o outro, isso é resolvido antes do JS rodar.

### ✅ Cenário 13 — Modo anônimo / privacy
1. Janela anônima nova.
2. Acessar `/`.
3. **Esperado**: vai para `/welcome`. Após fechar a janela anônima, abrir outra → vai para `/welcome` de novo (cada janela anônima é uma sessão independente).

### ✅ Cenário 14 — sessionStorage bloqueado (fail-safe)
1. Em alguns navegadores corporativos ou extensões de privacidade, `sessionStorage` lança `SecurityError`.
2. Acessar `/` sem login.
3. **Esperado**: vai para `/auth` direto (fail-safe — evita loop infinito em `/welcome`).
4. Como reproduzir: no DevTools, executar antes do load:
   ```js
   Object.defineProperty(Storage.prototype, 'getItem', {
     value: () => { throw new Error('blocked'); }
   });
   ```

### ✅ Cenário 15 — Deep link compartilhado para rota protegida (sem login)
1. Janela anônima nova.
2. Acessar `https://gavetta.com.br/friends` direto.
3. **Esperado**: redireciona para `/welcome` (primeiro acesso da sessão).
4. ⚠️ **Limitação conhecida**: a rota original `/friends` é perdida. Se quiser preservar (`?redirect=/friends`), abrir nova issue.

---

## Cobertura automatizada

Os cenários 1–7 e 14 estão cobertos por testes unitários:

```bash
bunx vitest run src/lib/sessionVisit.test.ts src/components/ProtectedRoute.test.tsx
```

**17 testes passando** (9 unitários em `sessionVisit` + 8 de integração em `ProtectedRoute`).

Os cenários 8–13 e 15 dependem de auth real / lifecycle do navegador e devem ser
validados manualmente.

---

## Tabela-resumo do comportamento esperado

| Estado da sessão | Logado? | Rota acessada     | Resultado     |
|------------------|---------|-------------------|---------------|
| Nova             | Não     | `/`               | → `/welcome`  |
| Nova             | Não     | `/my-drawers`     | → `/welcome`  |
| Nova             | Não     | `/welcome`        | mostra        |
| Nova             | Não     | `/auth`           | mostra        |
| Visitada         | Não     | `/`               | → `/auth`     |
| Visitada         | Não     | `/welcome`        | mostra        |
| Qualquer         | Sim     | `/` (ou prot.)    | mostra app    |
| Visitada (logout)| Não     | `/`               | → `/auth`     |
| Nova (após close)| Não     | `/`               | → `/welcome`  |

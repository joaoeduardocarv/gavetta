## Objetivo
Inserir a tag do Google Analytics 4 (`G-KE6N3TY6WJ`) no app Gavetta e garantir rastreamento correto das trocas de rota em SPA.

## Alterações propostas

### 1. Inserir snippet gtag.js no `index.html`
- Adicionar o script `https://www.googletagmanager.com/gtag/js?id=G-KE6N3TY6WJ` (async) no `<head>`, logo após as meta tags/JSON-LD.
- Adicionar o bloco de inicialização `window.dataLayer`, `gtag('js', new Date())` e `gtag('config', 'G-KE6N3TY6WJ')`.

### 2. Tipar `gtag` globalmente
- Criar/estender `src/types/gtag.d.ts` (ou ajustar `vite-env.d.ts`) com a declaração mínima de `window.dataLayer` e `gtag(...)` para evitar erros TypeScript.

### 3. Criar hook de rastreamento de rotas
- Criar `src/hooks/useAnalytics.ts` (ou similar) com:
  - Função `pageview(path: string)` que dispara `gtag('event', 'page_view', { page_path: path })`.
  - Listener de mudanças de rota usando `useLocation` do `react-router-dom`.

### 4. Integrar ao `App.tsx`
- Incluir o componente/hook de analytics dentro do `<BrowserRouter>` para que cada troca de rota envie um `page_view`.

### 5. Validação
- Verificar build sem erros TypeScript.
- Confirmar que o script `gtag.js` aparece no `<head>` e que navegações internas disparam eventos `page_view`.

## Notas
- A tag será hardcoded com o ID fornecido (`G-KE6N3TY6WJ`), já que o usuário passou o código pronto.
- Não serão adicionados eventos customizados nesta entrega, apenas pageviews de SPA.
# Tela de Troubleshooting de Cadastro

Uma página interna `/admin/signup-debug` onde você digita um email e recebe um diagnóstico completo de por que o cadastro foi (ou seria) negado.

## Acesso

Restrita ao seu handle `joaoeduardo` (founder). Outros usuários autenticados veem "Acesso negado". Não vamos criar tabela de roles agora — usamos verificação simples por handle no client + RPC.

## O que a tela mostra

Você digita um email (ex.: `filipe@sp.senai.br`) e clica "Diagnosticar". O sistema retorna um relatório com 5 seções:

### 1. Status no banco (`auth.users`)
- Existe? Sim/Não
- Se sim: `created_at`, `email_confirmed_at` (confirmou?), `last_sign_in_at`, `id`
- Tem profile correspondente em `public.profiles`? (detecta órfãos: usuário em auth sem profile = trigger falhou)

### 2. Validação de formato + domínio
- Regex de email válido?
- Domínio MX existe? (heurística — pular se complexo, só validar formato)
- Está em alguma lista de bloqueio do Supabase Auth?

### 3. Simulação do trigger `handle_new_user`
- Pega o local-part do email, gera o handle que seria criado
- Verifica se o handle resultante (após auto-suffix) seria válido
- Reporta se cairia no limite de 50 tentativas

### 4. Rate limit & tentativas recentes
- Conta quantas tentativas de signup com esse email apareceram nos `auth_logs` nas últimas 24h
- Mostra os últimos 5 eventos (signup, recovery, otp) com timestamp e status code
- Identifica padrões: 429 (rate limit), 422 (validação), 500 (erro de servidor/trigger)

### 5. Suppressão / bounce
- Se o sistema de emails Lovable estiver ativo, checa `suppressed_emails` (caso a tabela exista)
- Caso contrário, indica "verificar manualmente no provedor"

## Veredito final

No topo, um banner colorido com o diagnóstico em uma frase:
- ✅ "Email livre, cadastro deve funcionar"
- ⚠️ "Email já cadastrado e confirmado — usuário deve fazer login"
- ⚠️ "Email cadastrado mas não confirmado — reenvie email de verificação"
- ❌ "Registro órfão: existe em auth.users sem profile (trigger falhou) — limpar"
- ❌ "Rate limit atingido — aguardar X minutos"
- ❌ "Última tentativa retornou erro 500 — provável falha de trigger, ver detalhes"

Cada caso tem botão de ação correspondente (quando aplicável):
- "Reenviar confirmação" (chama `supabase.auth.resend`)
- "Limpar registro órfão" (RPC admin que deleta de auth.users via service role)

## Detalhes técnicos

### Nova edge function: `signup-debug`
- Verify JWT (precisa estar logado)
- Valida que o `handle` do chamador é `joaoeduardo` antes de qualquer query
- Usa `SUPABASE_SERVICE_ROLE_KEY` para acessar `auth.users` e `auth_logs` (analytics_query)
- Retorna JSON estruturado com as 5 seções acima

```ts
// Resposta esperada
{
  email: "filipe@sp.senai.br",
  verdict: { level: "error", code: "trigger_failed", message: "..." },
  authUser: { exists: true, id, createdAt, emailConfirmedAt, lastSignInAt } | null,
  profile: { exists: false } | { exists: true, handle, username },
  format: { valid: true, domain: "sp.senai.br" },
  triggerSimulation: { suggestedHandle: "filipe", available: true },
  recentLogs: [{ timestamp, action, status, errorMsg }],
  suppression: { listed: false } | { listed: true, reason }
}
```

### Nova edge function: `signup-cleanup-orphan`
- Mesma proteção (founder only)
- Deleta de `auth.users` via Admin API quando há registro órfão
- Loga a ação

### Nova página: `src/pages/AdminSignupDebug.tsx`
- Rota `/admin/signup-debug` em `App.tsx` dentro de `<ProtectedRoute>`
- Verifica handle do usuário logado; se ≠ `joaoeduardo`, mostra "Acesso negado" e botão voltar
- Form com input de email + botão "Diagnosticar"
- Renderiza o JSON de resposta em cards visuais (um por seção)
- Banner de veredito no topo, com cor por severidade
- Botões de ação contextuais (resend, cleanup)

### Não vamos:
- Criar tabela `user_roles` agora (overkill para 1 admin) — usar check por handle
- Mexer em RLS de outras tabelas
- Expor a página no menu — acesso por URL direta

## Arquivos

- `supabase/functions/signup-debug/index.ts` (novo)
- `supabase/functions/signup-cleanup-orphan/index.ts` (novo)
- `src/pages/AdminSignupDebug.tsx` (novo)
- `src/App.tsx` (adicionar rota)

## Fluxo de uso para o caso `filipe@sp.senai.br`

1. Você acessa `/admin/signup-debug`
2. Digita `filipe@sp.senai.br`
3. Em ~1s recebe: "Email não existe em auth.users. Logs mostram 0 tentativas nas últimas 24h."
4. Conclusão: o usuário nunca chegou a clicar "Cadastrar", ou o request travou no client antes de bater no Supabase. Você sabe onde investigar.

Para casos diferentes (ex.: usuário diz que cadastrou mas não recebeu email), você verá `email_confirmed_at: null` e o botão "Reenviar confirmação".

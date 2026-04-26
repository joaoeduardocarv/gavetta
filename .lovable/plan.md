## Diagnóstico

Testei o DNS e as respostas HTTP agora:

- ✅ `https://www.gavetta.com.br` → **HTTP 200** servindo o app Lovable (deployment id `bfa65fc2...`). Funcionando perfeitamente.
- ❌ `https://gavetta.com.br` (sem www) → **HTTP 421 Misdirected Request** vindo do Cloudflare. O DNS resolve e o tráfego chega no edge, mas o Lovable **não reconhece** o hostname porque o **domínio raiz nunca foi adicionado como Custom Domain** no projeto — só o `www` está cadastrado.

Confirmação: o painel do projeto lista apenas `https://www.gavetta.com.br` em Custom Domains.

---

## O que você precisa fazer (2 passos rápidos no Lovable + Cloudflare)

### Passo 1 — Adicionar o domínio raiz no Lovable

1. **Project Settings → Domains**.
2. Clique em **Connect Domain**.
3. Digite **`gavetta.com.br`** (sem o `www`) e confirme.
4. Como você usa Cloudflare, expanda **Advanced** e marque **"Domain uses Cloudflare or a similar proxy"** (caso o www tenha sido adicionado assim — mantenha o mesmo modo nos dois pra evitar inconsistência).
5. Anote os registros DNS exibidos (vai ser um A `185.158.133.1` ou um CNAME, dependendo do modo, + um TXT `_lovable`).

### Passo 2 — Definir o Primary Domain

Ainda em **Project Settings → Domains**, defina **`gavetta.com.br`** como **Primary**. O `www` passa a redirecionar pra raiz (boa prática SEO — evita conteúdo duplicado).

> 💡 Alternativa: se você prefere o `www` como principal (também válido), defina `www.gavetta.com.br` como Primary e o raiz redireciona pra ele. Mas precisa adicionar o raiz do mesmo jeito pra não dar 421.

### Passo 3 — Verificar/ajustar o Cloudflare

No painel do Cloudflare → DNS → Records, confirme que o registro do domínio raiz (`@`) está cadastrado:

- **Se você adicionou em modo DNS only no Lovable**: deve ser **A** `@` → `185.158.133.1`, proxy ⚪ **DNS only** (cinza).
- **Se em modo Proxied**: deve ser o **CNAME** que o Lovable mostrar, com proxy 🟠 ativo, e SSL/TLS em **Full (strict)**.

Se o registro `A @ → 185.158.133.1` já existir mas sem o domínio cadastrado no Lovable, é por isso que dá 421 — o passo 1 resolve.

Adicione também o **TXT `_lovable`** no Cloudflare (se ainda não existir) com o valor que o Lovable te der no Passo 1.

### Passo 4 — Aguardar verificação (~5 min via Cloudflare)

No painel Lovable, o status passa por **Verifying → Setting up → Active**. SSL automático.

---

## O que eu vou fazer (ao aprovar este plano)

Atualizar todas as referências de URL no código pra consolidar autoridade SEO em **`https://gavetta.com.br`** (assumindo que será o Primary). Isso evita conteúdo duplicado entre `gavetta.lovable.app`, `www.gavetta.com.br` e `gavetta.com.br`:

1. **`public/sitemap.xml`** — trocar `https://gavetta.lovable.app/welcome` e `/auth` por `https://gavetta.com.br/welcome` e `/auth`.
2. **`public/robots.txt`** — atualizar a linha `Sitemap: https://gavetta.com.br/sitemap.xml`.
3. **`index.html`** — atualizar:
   - `<link rel="canonical" href="https://gavetta.com.br/" />`
   - `og:url` → `https://gavetta.com.br/`
   - `og:image` → `https://gavetta.com.br/og-image.jpg`
   - `twitter:image` → `https://gavetta.com.br/og-image.jpg`
   - JSON-LD (`Organization` e `WebApplication`): campos `url`, `@id`, `logo`, `publisher.@id`.
4. **`src/pages/Welcome.tsx`** — se houver URLs absolutas no JSON-LD `FAQPage` ou nos `<Helmet>` por rota, atualizar pra `gavetta.com.br`.

> ⚠️ Faço essa atualização **independentemente** de você ter completado o Passo 1 ainda — quando o domínio raiz ficar Active, tudo já estará apontando pra ele. Enquanto não estiver, o `www` continua funcionando normalmente (Lovable serve o mesmo app, só não consolida ainda o canonical).

---

## Pergunta antes de aprovar

Você quer **`gavetta.com.br`** como Primary (recomendado, mais limpo) ou **`www.gavetta.com.br`**? Isso muda apenas qual URL eu uso como canônica nos arquivos de SEO. Por padrão vou de `gavetta.com.br` (sem www).
## Objetivo

Substituir o mockup ilustrativo da seção "Episódio por episódio. Temporada por temporada." (`src/pages/Welcome.tsx`, linha 311) por um **print real** capturado direto do app Gavetta, na tela `/trending` filtrada por **Séries**, no viewport mobile.

## Pré-requisito (você)

Antes de eu rodar, me envie no chat:
- **Email** e **senha** de uma conta de teste do Gavetta com acesso a `/trending`.

> Sugestão: se possível, use uma conta que tenha o filtro **Séries** com bons resultados em alta no dia (ex: Stranger Things, Last of Us, etc.) — isso melhora a apresentação na landing.

## Etapas que vou executar (após receber credenciais)

### 1. Capturar o screenshot real
- Abrir o preview no viewport **390×844** (iPhone 13/14 — mesma proporção dos assets atuais `mockup-series.png` 390w e `mockup-series-360.png` 360w).
- Navegar para `/auth`, fazer login com as credenciais de teste.
- Navegar para `/trending`.
- Clicar no filtro **Séries** (pill de filtro da página Trending).
- Aguardar o carregamento dos cards (TMDB API).
- Tirar screenshot da tela inteira via `browser--screenshot`.

### 2. Mostrar para você aprovar
- Colocar o screenshot bruto em `/mnt/documents/trending-series-preview.png` e te apresentar como `<lov-artifact>` para você revisar **antes** de eu substituir o asset.
- Se aprovar → próximo passo. Se não → recapturo com ajustes (filtro semanal/diário, scroll position, etc.).

### 3. Processar e gerar os 2 assets responsivos
- Recortar/redimensionar para **390×844** (asset principal).
- Gerar versão **360×800** (asset para telas menores, mantendo a mesma proporção e crop).
- Otimizar PNG (qualidade visual preservada, peso reduzido).
- Salvar em:
  - `src/assets/landing-mockup-series.png` (substitui)
  - `src/assets/landing-mockup-series-360.png` (substitui)

### 4. Validar no Welcome
- Não preciso editar `Welcome.tsx` — ele já importa esses paths e usa `srcSet`/`sizes` corretamente (verificado nas linhas 311-320).
- Capturar o `/welcome` final pra confirmar que o novo print aparece bonito dentro do frame de celular (border arredondada `rounded-[2.5rem]`, `border-[10px]`).

### 5. QA final
- Conferir que a imagem não está cortada, esticada ou com texto ilegível dentro do frame mockup.
- Verificar nos breakpoints: mobile (<640px usa o 360w) e desktop (usa o 390w).

## O que NÃO vai mudar

- Nenhuma alteração em `Welcome.tsx`, copy, layout ou outros assets.
- Nenhuma mudança em `/trending` ou em qualquer página do app — só captura.
- A conta de teste que você me passar **não será modificada** (só leitura/navegação).

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Conteúdo "em alta" muda com o tempo e o print fica datado | É inerente a qualquer print real; podemos reagendar uma nova captura quando quiser |
| Login falhar (Google-only, 2FA, etc.) | Você me confirma que é login por **email/senha**; se for só Google, precisamos de outra estratégia |
| Conteúdo sensível/pessoal da conta aparecer | Vou usar só `/trending` (lista pública de em alta) — não toco em perfil, drawers ou feed pessoal |
| Print ficar visualmente ruim | Etapa 2 (sua aprovação) existe justamente pra isso |

## Próximo passo

Aprove o plano e cole as credenciais de teste no chat. Aí eu já capturo, te mostro o preview, e finalizo.
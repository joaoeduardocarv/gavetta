# Importar filmes e séries citados em conteúdos de redes sociais

Sim, é possível — com uma ressalva importante sobre o que dá para "ler" de cada rede.

## Como funcionaria para o usuário

1. **Compartilhar direto no Gavetta** (Android/desktop, app instalado): o Gavetta aparece na lista nativa de "Compartilhar" do Instagram, TikTok, Spotify, YouTube.
2. **Colar o link** (funciona em todo lugar, inclusive iPhone): botão "Importar de um link" na busca, onde o usuário cola o link ou até cola o texto/legenda do post.
3. O Gavetta busca o texto público daquele conteúdo (título, legenda/descrição, descrição do episódio de podcast).
4. Uma IA lê esse texto e extrai **todos** os títulos citados.
5. Cada título é cruzado com o TMDB e vira um card.
6. Abre uma **fila de cards**: card do filme 1 → escolhe a gavetta (ou pula) → card do filme 2 → e assim por diante, com contador "3 de 10" e um resumo no fim.

## O que dá e o que não dá para ler

- **Funciona bem**: Spotify (título + descrição do episódio, via oEmbed/página pública), YouTube (título + descrição — normalmente onde ficam as listas), TikTok e Instagram Reels **públicos** (legenda via oEmbed/metadados).
- **Não funciona sozinho**: áudio falado sem estar na descrição, texto que só aparece dentro do vídeo, e posts privados/restritos do Instagram (a Meta bloqueia leitura sem login).
- **Plano B sempre disponível**: quando não conseguirmos ler o link, o app mostra um campo "cole aqui a legenda/descrição" e a IA extrai dali. Ou seja, o fluxo nunca trava.
- Transcrição de áudio do podcast é possível num segundo momento, mas é bem mais caro/lento — deixaria fora desta primeira versão.

## Precisão

A IA vai receber o texto e uma instrução para retornar apenas títulos de filmes/séries. Casos ambíguos (título genérico, remake, nome parcial) viram uma escolha rápida no card: mostramos o melhor palpite com opção "não é esse" e alternativas do TMDB. Nada é adicionado sem o usuário confirmar.

## Detalhes técnicos

- **Edge function `extract-titles`**: recebe `{ url? , text? }`, resolve o texto-fonte (oEmbed do TikTok/Instagram/YouTube/Spotify, fallback para leitura de meta tags Open Graph), chama a IA do Lovable (`google/gemini-3-flash`) com saída estruturada JSON (`[{ title, year?, type? }]`), e depois faz `search/multi` no TMDB por item, retornando os candidatos normalizados por `contentNormalizer`. Valida entrada com Zod, valida JWT em código, trata 429/402 do gateway.
- **PWA / Web Share Target**: adicionar `public/manifest.webmanifest` com `share_target` (`action: /import`, method GET, params `title/text/url`) e registrar um service worker mínimo — requisito para o app aparecer no menu de compartilhar do Android. No iOS o share target não existe; lá vale o fluxo de colar link (e futuramente um Atalho do iOS).
- **Nova rota `/import`** (protegida): lê `?url=`/`?text=`, ou mostra o campo de colar. Chama a function, exibe skeleton enquanto processa.
- **Novo componente `ImportQueueDialog`**: reaproveita `ContentDetailDialog`/`DrawerPickerPopover` para cada item, com navegação "próximo/pular", contador de progresso e tela final de resumo. Segue as regras já existentes de reset de estado ao fechar e z-index de diálogos.
- **Entradas na UI**: botão "Importar de link" em `Search.tsx` e um passo no onboarding.
- Sem mudanças de schema; nada é gravado além das atribuições de gaveta já existentes.

## Entrega em etapas

1. Edge function + rota `/import` com colagem de link/texto + fila de cards (cobre 100% dos usuários, iPhone incluso).
2. Manifest + service worker para o "Compartilhar → Gavetta" nativo no Android.
3. (Opcional, depois) Atalho do iOS e transcrição de áudio.

# Mais acessos e cadastros na página de boas-vindas

## O que os números mostram (últimos 14 dias)

- 289 visitantes e 655 visualizações no total — bem longe dos 1400 cliques. A maior parte de quem clica não chega a ver a página (fecha antes de carregar, ou o clique não vira visita real).
- 251 de 289 visitantes são de celular; a origem principal é o Facebook/Instagram (mais de 110 visitas), muitas dentro do navegador interno do app.
- A página de boas-vindas teve 152 visitas, mas a tela de criar conta só 27. Ou seja: 8 em cada 10 leem e não clicam.
- Taxa de saída sem interação alta (média 74%, chegando a 90% em vários dias) e tempo médio de sessão baixo.

Conclusão: dois problemas somados — muita gente perdida antes de ver a página, e pouca gente clicando em "Começar grátis".

## O que vou fazer

### 1. Menos perda entre o clique e a página
- Deixar a primeira dobra mais leve: a imagem grande de fundo do topo passa a carregar em versão reduzida para celular, e o print do app entra otimizado. Menos espera = menos gente desistindo.
- Ajustar a página para caber melhor no navegador interno do Instagram/Facebook, onde a maioria chega.

### 2. Primeira tela que convence em 3 segundos
- Título mais direto e concreto, no lugar do atual (algo como "Organize tudo que você assiste — filmes e séries, episódio por episódio").
- Botão principal fixo e visível no celular (barra inferior "Criar conta grátis") que acompanha a rolagem — hoje é preciso rolar de volta ao topo ou até o fim para achar um botão.
- Prova social real logo abaixo do botão (número de cinéfilos usando), no lugar de números genéricos.

### 3. Deixar experimentar antes de criar conta
Principal causa de saída: exigimos conta para ver qualquer coisa. Vou incluir uma amostra viva na própria página de boas-vindas — busca de filmes/séries funcionando ali mesmo, com alguns cards reais. Ao tentar guardar um título numa gaveta, aí sim aparece o convite para criar conta, já com o filme escolhido em mãos.

### 4. Cadastro mais curto
- Colocar "Entrar com Google" como primeira opção e em destaque na tela de conta (um toque, sem senha nem confirmação de e-mail).
- Reduzir o atrito visual do formulário de e-mail, deixando-o como alternativa recolhida.

### 5. Saber onde as pessoas desistem
- Marcar os cliques importantes (botões de "Começar grátis" do topo, do meio e do rodapé, e a conclusão do cadastro) para o painel de análise já existente, para as próximas mudanças serem decididas por dado e não por achismo.
- Preparar links com identificação de campanha para você usar nos posts e na bio do Instagram, e assim ver quais posts realmente trazem cadastro.

## Detalhes técnicos

- `src/pages/Welcome.tsx`: nova hero, CTA fixo em mobile, seção de demonstração, imagens responsivas (`landing-hero-bg` em versão mobile), remoção dos números fictícios.
- Novo componente `src/components/landing/LandingTryIt.tsx`: busca pública via a função `tmdb` existente (sem exigir sessão), reaproveitando `ContentCard` em modo somente leitura; ação de adicionar redireciona para `/auth?next=...`.
- `src/pages/Auth.tsx`: Google em destaque no topo, e-mail em bloco secundário; suporte a `?next=`.
- `src/hooks/useAnalytics.ts`: helper `trackEvent` para eventos de CTA e conclusão de cadastro (GA4 já instalado).
- Sem mudanças de banco de dados.

## Depois de aplicar
As mudanças só valem no site no ar depois de publicar.

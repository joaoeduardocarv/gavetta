# Painel de administração: uso real das funcionalidades

Hoje o app não tem nenhum conceito de administrador (não existe tabela de papéis) e o único dado de uso disponível é o Google Analytics, que mostra páginas visitadas — não mostra se as pessoas estão de fato criando gavettas, avaliando, importando de link, usando a Gavetta Mágica ou adicionando amigos.

A proposta é criar um acesso de admin dentro do próprio Gavetta, com um painel que lê os dados que o app já grava no banco.

## O que será construído

**1. Papel de administrador**
- Nova tabela de papéis de usuário (separada do perfil, por segurança) com o papel `admin`.
- Sua conta é marcada como admin; ninguém mais consegue se promover.
- Rota `/admin` protegida: quem não é admin é redirecionado.

**2. Painel `/admin` com visão geral**
- Total de usuários, novos usuários (7 / 30 dias), quantos concluíram o onboarding.
- Usuários ativos: quantos registraram alguma ação nos últimos 1, 7 e 30 dias.
- Gráfico simples de cadastros e de atividade por dia (últimos 30 dias).

**3. Uso por funcionalidade (o coração do pedido)**
Para cada funcionalidade, quantos usuários distintos a usaram e o volume total, com recorte de 7/30 dias e "desde sempre":
- Gavettas: itens adicionados em Para Assistir / Assistindo / Assistidos / personalizadas.
- Avaliações: notas em títulos e notas em episódios.
- Episódios marcados como vistos e rewatches.
- Gavettas personalizadas criadas e gavettas compartilhadas (convites e aceites).
- Amigos: pedidos enviados e aceitos; recomendações enviadas.
- Importar de link: jobs criados, concluídos, falhos e taxa de sucesso.
- Notificações: enviadas e taxa de leitura.
- Perfis públicos ativados.

**4. Atividade por usuário, dia a dia**
- Lista de usuários (busca por handle/e-mail) com: data de cadastro, nº de títulos em gavettas, nº de notas, episódios marcados, importações e **última atividade**.
- Ao clicar em um usuário: linha do tempo diária dos últimos 30/90 dias mostrando, por dia, se ele adicionou algo em alguma gavetta, avaliou, marcou episódio, importou de link ou interagiu com amigos — com o total de ações por dia (formato de "heatmap"/barras).
- Detalhe do dia: quais títulos foram adicionados e em qual gavetta.
- Indicador de "ativo hoje / últimos 7 dias / inativo há X dias" por usuário.
- Tabela "funcionalidade x % de usuários que já usaram", para ver o que ninguém está usando.

**5. Gavetta Mágica**
Essa é hoje 100% no cliente, então o banco não sabe quantas vezes foi usada. Será adicionado um registro leve de evento (usuário + funcionalidade + data) gravado quando a Gavetta Mágica é aberta/revelada, para aparecer no painel como as demais.


## Detalhes técnicos

- Migração: `app_role` enum, tabela `public.user_roles` (com GRANTs), função `has_role(uuid, app_role)` security definer, RLS.
- Tabela `public.feature_events` (user_id, feature, created_at) com insert só para o próprio usuário e leitura só para admin; usada pela Gavetta Mágica e facilmente extensível a outras ações.
- Todas as métricas vêm de funções security definer: `admin_usage_metrics()` (agregados globais) e `admin_user_activity(_user_id, _days)` (série diária e detalhe por usuário), agregando `profiles`, `user_drawer_assignments`, `episode_ratings`, `watched_episodes`, `user_custom_drawers`, `shared_drawer_members`, `friendships`, `recommendations`, `notifications`, `import_jobs` e `feature_events`. A atividade diária usa as datas de criação dessas tabelas convertidas para UTC−3. Ambas validam `has_role(auth.uid(), 'admin')` e falham para não-admins.
- Frontend: `src/pages/Admin.tsx` + `src/components/admin/*` usando cards e a lib de gráficos já presente (recharts), rota lazy em `App.tsx`, guarda `AdminRoute`.
- Nenhum dado pessoal sensível é listado além de handle/username e contadores.

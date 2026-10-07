# Notificações orientadas ao usuário — Gavetta

## Objetivo
Transformar o sino em um centro de decisões: **o que aconteceu, por que importa para mim e o que posso fazer agora**. A complexidade ficará na organização e na confiabilidade, não na quantidade de controles.

**Sua escolha será preservada:** abrir o sino marca os avisos recebidos até aquele momento como lidos e limpa o contador. Ler um aviso não significa aceitar um convite nem resolver uma pendência.

## O que foi confirmado
- A lista atual carrega os últimos 50 avisos e calcula o contador apenas com esses itens; a atualização em tempo real escuta somente inserções.
- Os botões de convite de gavetta dependem de o aviso estar não lido. Como abrir o sino marca todos como lidos, as ações podem desaparecer sem resposta.
- Indicações são abertas procurando a indicação mais recente do mesmo título, sem identificar exatamente a indicação que originou o aviso.
- Curtidas e comentários já geram notificações no banco. Hoje, o clique leva à aba de atividades, mas o feed consulta atividades dos amigos, não a atividade própria que recebeu a interação.
- As preferências atuais cobrem conteúdo, não as interações sociais. A verificação de conteúdo lê no máximo 1.000 registros de gavettas por execução.

## 1. Uma caixa de entrada com duas necessidades distintas
- **Pendências:** pedidos de amizade e convites de gavetta aguardando resposta. Permanecem acionáveis mesmo depois de lidos; aceitar, recusar ou resolver em outra tela atualiza o estado aqui.
- **Atualizações:** episódios, temporadas, disponibilidade, indicações e interações. Ordem cronológica clara, com separação por Hoje, Ontem e Anteriores.
- Filtros por **Tudo, Filmes e séries e Social**, com contagem de pendências separada do contador de não lidas.
- No sino, mostrar uma lista compacta e acesso ao histórico completo, com carregamento progressivo — sem perder avisos antigos por um limite fixo.
- Cada item terá avatar ou pôster quando disponível, texto específico, horário e ação adequada. Imagens ausentes terão alternativa estável, sem bloquear a leitura.
- Controles acessíveis por teclado e toque, nomes para ícones, foco previsível e animações discretas que respeitem redução de movimento.

## 2. Cada informação terá uma origem identificável
| Aviso | Origem | Informação útil | Destino e ação |
|---|---|---|---|
| Pedido de amizade | Pedido e perfil do solicitante | Quem pediu e se ainda está pendente | Aceitar/recusar; abrir a pessoa |
| Amizade aceita | Amizade e perfil | Quem aceitou | Abrir o perfil permitido |
| Convite de gavetta | Participação, gavetta e proprietário | Nome da gavetta, remetente e estado atual | Aceitar/recusar; abrir a gavetta aceita |
| Indicação | Indicação específica e título | Pessoa, produção e comentário | Abrir aquela indicação; adicionar à gavetta pelo fluxo existente |
| Curtida | Interação e atividade correspondente | Quem curtiu e qual produção | Abrir exatamente a atividade, inclusive quando for sua |
| Comentário | Comentário e atividade correspondente | Autor, trecho e produção | Abrir a conversa correta, com possibilidade de responder |
| Disponibilidade | Atualização do catálogo TMDB para o Brasil | Plataforma e modalidade: assinatura, aluguel ou compra | Abrir onde assistir no título |
| Episódio/temporada | Dados de episódios e temporadas do TMDB | Série, temporada, episódio e data | Abrir a seção correspondente |
| Estreia futura | Data informada pelo catálogo | Título, data e motivo do aviso | Abrir o título; diferenciar previsão de disponibilidade confirmada |

Os nomes e estados virão dos registros relacionados; o catálogo complementará imagens e detalhes. Datas de exibição não serão tratadas como prova de disponibilidade em uma plataforma brasileira.

## 3. Um clique deve terminar no lugar certo
- Criar destinos específicos para atividade, comentário, indicação e gavetta; ajustar as telas envolvidas somente para receber esses destinos.
- A atividade própria que recebeu uma interação poderá ser aberta diretamente, sem inseri-la artificialmente no feed dos amigos.
- Ao chegar por comentário, abrir a conversa e destacar brevemente o comentário relacionado; não exigir que o usuário procure no feed.
- Resolver os destinos com os dados disponíveis e carregar complementos depois. Não depender de uma consulta ao catálogo para mostrar informações já salvas.
- Conteúdo removido, convite revogado, amizade desfeita ou acesso perdido: explicar que o item não está mais disponível, sem revelar dados privados nem deixar um clique sem resposta.
- Mostrar estados como **Aceito, Recusado ou Não disponível** a partir do estado real da ação, e não do estado de leitura.

## 4. Menos ruído, mais relevância
- Agrupar curtidas da mesma atividade numa linha com quantidade e identificação das pessoas; permitir expandir. Comentários continuarão individualmente acessíveis.
- Consolidar atualizações compatíveis do mesmo título e evento, sem misturar assinatura, aluguel e compra nem esconder informações diferentes.
- Destacar pendências acionáveis e novidades próximas; manter a ordem temporal dentro de cada seção. Não usar um ranking opaco de IA.
- Evitar avisos de episódios já marcados como vistos e preservar a regra que suprime disponibilidade para títulos somente em Assistidos, salvo preferência contrária.
- Eventos de estreia serão identificados por temporada/episódio/data, para evitar reenviar a mesma novidade em verificações sucessivas ou após mudar o texto.
- Grupos indicarão atualizações novas sem inflar a lista. O contador do sino seguirá uma regra explícita baseada nos avisos não lidos, independente da paginação e dos grupos visuais.

## 5. Controle sem comprometer ações importantes
- Preferências organizadas em **Filmes e séries** e **Social**; adicionar controles para curtidas, comentários, indicações e avisos de amizade aceita.
- Pedidos de amizade e convites continuarão consultáveis como pendências até resposta; desligar avisos informativos não apagará ações recebidas.
- Manter as escolhas existentes e os padrões atuais para quem ainda não personalizou.
- Preferências terão indicação de salvamento, prevenção de gravações concorrentes e recuperação do valor anterior em falha.
- Ler, excluir e responder terão retorno imediato e restauração em caso de erro. Remover um aviso não cancelará uma amizade ou participação.
- Ao abrir o sino, registrar o momento da abertura: avisos que chegarem depois continuarão novos. Não apagar silenciosamente novidades durante a leitura.

## 6. Confiabilidade da informação
- Contagem de não lidas separada da consulta paginada do histórico.
- Sincronizar inserções, alterações e exclusões entre sino, histórico e marcadores nos pôsteres; reconferir ao voltar ao aplicativo.
- Vincular novos avisos ao evento exato, com dados estruturados mínimos para destino, contexto e deduplicação. Não extrair IDs ou estados de textos apresentados ao usuário.
- Fazer a geração social acompanhar a gravação do evento de origem, evitando que uma ação seja salva sem o aviso correspondente ou gere avisos duplicados.
- Paginar a verificação de títulos, preservar progresso e registrar falhas para retomada. Uma falha de entrega não deverá ser considerada uma atualização concluída.
- Não prometer tempo real para mudanças do catálogo: elas continuam dependendo da verificação periódica e da atualização da fonte.

## Detalhes técnicos
- Separar consulta/contagem, apresentação, resolução de destinos e regras de agrupamento em módulos reutilizáveis pelo sino e histórico.
- Reutilizar componentes e tokens visuais existentes, normalização central de conteúdo e fluxos atuais de avaliação e gavettas.
- Confirmar políticas, permissões, agendamento ativo e relações antes das mudanças no banco; o código histórico não será tratado como prova da configuração atual.
- Usar alterações aditivas para referências de eventos, preferências sociais e chaves de deduplicação. Preservar avisos existentes com resolução compatível e alternativas seguras quando não houver referência exata.
- Reaproveitar os gatilhos existentes de curtidas/comentários e remover duplicidade de geração apenas após verificar cada origem social.
- Toda consulta de destino respeitará as regras de acesso atuais. Dados auxiliares não poderão contornar a privacidade quando uma relação deixar de existir.

## Entrega e validação
1. Consolidar origem, identidade e estado dos eventos; corrigir pendências independentes da leitura e destinos incorretos.
2. Entregar caixa de entrada, histórico, agrupamento e preferências.
3. Fortalecer sincronização, deduplicação e verificação periódica.
4. Testar abertura do sino, chegada de aviso durante leitura, convites após reabrir, indicação correta entre várias do mesmo título, atividade própria, comentário específico, conteúdo removido, privacidade, falhas e histórico com mais de 50 avisos.
5. Validar no aplicativo autenticado em telas estreitas e largas; confirmar atualização do sino e dos pôsteres. Quando faltar uma segunda conta autorizada, informar o limite da validação entre usuários.

**Critério de sucesso:** abrir o sino limpa o contador, nenhuma pendência some sem resposta, cada aviso leva ao contexto correto e o usuário consegue reduzir ruído sem perder decisões importantes.

## Fora deste escopo
Push no celular, e-mail, WhatsApp, novos provedores de conteúdo e um sistema de recomendações por IA. Esta entrega melhora as notificações dentro da Gavetta, sem solicitar novas permissões ou criar canais externos.

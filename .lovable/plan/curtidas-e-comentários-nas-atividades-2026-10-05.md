# Curtidas e comentários nas atividades

## O que será criado

- Adicionar um botão de curtir em cada atividade, mostrando a quantidade e o estado curtido pelo usuário.
- Permitir abrir os comentários da atividade, ler os existentes e publicar um comentário de até 280 caracteres, com contador visível.
- Atualizar as interações imediatamente no feed e manter os dados sincronizados entre usuários.
- Enviar uma notificação ao dono da atividade quando um amigo curtir ou comentar, sem notificar ações próprias.
- Ao tocar na notificação, levar o usuário à aba de atividades dos amigos.

## Privacidade e comportamento

- Somente o autor da atividade e amizades aceitas poderão ver e interagir.
- Cada usuário poderá curtir uma atividade apenas uma vez e poderá desfazer a curtida.
- O autor do comentário poderá apagá-lo; comentários vazios ou acima do limite serão bloqueados também no banco.
- Notificações de curtida serão consolidadas por pessoa e atividade para evitar duplicação ao descurtir e curtir novamente.

## Detalhes técnicos

- Criar tabelas protegidas para curtidas e comentários ligadas à atividade existente e aos perfis.
- Aplicar regras de acesso por amizade aceita, índices e gatilhos seguros para gerar as notificações.
- Estender o feed e o menu de notificações usando os componentes e padrões visuais atuais.
- Adicionar testes para limite, contagem, estado de curtida e navegação da notificação; validar no preview autenticado.

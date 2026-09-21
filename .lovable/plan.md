# Um acesso, duas formas de entrar

## Objetivo
Permitir que Google e email com senha abram exatamente o mesmo perfil, preservando Gavettas, avaliações e ordem dos títulos.

## Implementação
- Manter a associação automática pelo email real e confirmado, sem criar outro perfil.
- Para quem entrou pelo Google, oferecer no Perfil a criação de uma senha pelo email da própria conta.
- Mostrar corretamente no Perfil quando a conta aceita Google, senha ou ambos.
- Manter a recuperação de senha apontando para a conta existente.
- Se surgirem contas duplicadas no futuro, não mesclar silenciosamente; preservar como principal a que possuir mais conteúdos nas Gavettas.

## Validação
- Confirmar que hoje não há emails duplicados antes de alterar o fluxo.
- Testar a criação de senha a partir de uma conta Google.
- Testar entrada pelo Google e por email/senha e confirmar o mesmo identificador de usuário e as mesmas Gavettas.
- Validar em celular e computador e confirmar que o app continua sem erros.

## Detalhes técnicos
- A identidade continua vinculada ao mesmo usuário autenticado; os dados não são copiados entre perfis.
- A criação inicial de senha usa o link seguro enviado ao email confirmado pelo Google.

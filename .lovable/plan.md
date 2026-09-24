# Avatar antes do onboarding e senha mais amigável

## Objetivo
Simplificar o cadastro sem reduzir a segurança: retirar a escolha de avatar do formulário, apresentá-la como primeira etapa após o acesso e explicar melhor quais senhas são aceitas.

## Fluxo do primeiro acesso
- Remover a grade de avatares do formulário de cadastro por email.
- Após a conta estar autenticada, abrir uma etapa obrigatória “Escolha seu avatar” antes do tour atual — tanto para cadastro por email quanto por Google.
- Exibir os avatares maiores e mais espaçados, em uma grade confortável no celular e no computador, mantendo a opção de enviar e recortar uma foto.
- Salvar a escolha no perfil e só então liberar o onboarding existente.
- Registrar separadamente que essa etapa foi concluída, para ela não reaparecer após recarregar, trocar de aparelho ou entrar novamente.
- Marcar os perfis já existentes como concluídos na migração, evitando mostrar a nova etapa retroativamente para usuários antigos.

## Senha mais flexível, sem perder segurança
- Manter a regra atual de no mínimo 6 caracteres e a proteção contra senhas conhecidas em vazamentos.
- Não exigir combinações artificiais de maiúsculas, símbolos ou números.
- Incluir orientação curta no próprio campo: uma frase ou combinação pessoal e incomum é válida.
- Quando uma senha for recusada pela proteção, explicar que ela apareceu em vazamentos — e não que faltou símbolo ou número — com sugestão clara para criar outra senha única.
- Aplicar a mesma linguagem no cadastro, recuperação e criação/alteração de senha quando essas telas exibirem a regra.

## Ordem da experiência
```text
Criar/entrar na conta
        ↓
Escolher avatar (obrigatório, uma vez)
        ↓
Tour curto existente
        ↓
Seleção inicial de até 5 títulos
        ↓
App
```

## Detalhes técnicos
- Adicionar ao perfil um marcador de conclusão da escolha inicial do avatar, com acesso restrito ao próprio usuário.
- Criar um controlador único do primeiro acesso para impedir que avatar, tour e seleção de títulos apareçam ao mesmo tempo.
- Reaproveitar a seleção e o recorte de imagem existentes, adaptando sua apresentação para a etapa inicial.
- Manter a proteção de senha vazada ativa nas configurações de autenticação.

## Validação
- Testar cadastro por email com confirmação e primeiro login.
- Testar primeiro acesso pelo Google.
- Confirmar a sequência avatar → tour → títulos e que ela não reaparece depois de concluída.
- Confirmar que usuários antigos entram normalmente, sem nova interrupção.
- Testar senha válida incomum, senha curta e senha conhecida em vazamentos, verificando mensagens claras.
- Conferir a grade de avatares e o recorte de foto em celular e computador.

# Novos títulos no topo das Gavettas

## Objetivo
Fazer todo filme ou série recém-adicionado aparecer como primeiro item da Gavetta de destino, preservando a ordem dos títulos que já estavam nela.

## Implementação
- Alterar a regra de posição salva: ao inserir um título, avançar os títulos existentes uma posição e gravar o novo como posição `0`.
- Aplicar a mesma regra aos fluxos de “Para Assistir”, “Assistindo”, “Assistidos”, Gavettas personalizadas e inclusão rápida do onboarding.
- Atualizar imediatamente a ordem mostrada na tela, sem esperar uma nova abertura da Gavetta.
- Manter intacta a ordenação manual relativa dos títulos anteriores.

## Validação
- Confirmar que um novo título entra no topo de cada tipo de Gavetta.
- Confirmar que a ordem personalizada anterior não muda, apenas desce uma posição.
- Executar os testes relacionados e validar o aplicativo sem erros.

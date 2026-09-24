# Otimizar o “Quero ver” do onboarding

## Objetivo
Fazer o próximo título aparecer quase imediatamente após o toque, sem perder a gravação na Gavetta “Para Assistir”.

## Alterações
1. **Resposta imediata ao toque**
   - Atualizar a seleção na tela de forma otimista e avançar para o próximo título sem esperar toda a sincronização.
   - Manter o botão protegido contra toques repetidos e mostrar um estado discreto de salvamento.
   - Se a gravação falhar, restaurar o item e informar claramente para tentar novamente.

2. **Reduzir chamadas desnecessárias**
   - Evitar que o onboarding espere detalhes, elenco e disponibilidade do TMDB antes de salvar um título que veio da lista de populares.
   - Salvar primeiro os dados normalizados já disponíveis e completar informações secundárias em segundo plano.

3. **Eliminar operações sequenciais caras**
   - Trocar as várias exclusões feitas uma por uma por uma única operação segura para mover/adicionar o título na Gavetta padrão.
   - Evitar recarregar a lista inteira de Gavettas após cada escolha; atualizar o estado local e fazer uma conferência silenciosa ao final.

4. **Antecipar o carregamento inicial**
   - Buscar as cinco sugestões enquanto o usuário ainda está no tour, para que os títulos e o primeiro pôster já estejam prontos ao abrir essa etapa.
   - Pré-carregar o pôster seguinte durante a visualização do título atual.

5. **Validação**
   - Adicionar testes para avanço imediato, prevenção de clique duplo, persistência correta e recuperação em caso de erro.
   - Medir o intervalo entre o toque e a troca do card em conexão rápida e lenta.
   - Validar o fluxo completo do primeiro acesso em celular e computador, além do estado final das Gavettas.

## Detalhes técnicos confirmados
Hoje, `QuickStartLibrary` aguarda `setDefaultDrawer` antes de avançar. Esse fluxo pode buscar três conjuntos de dados externos, executar exclusões sequenciais para combinações de IDs/Gavettas, inserir o título e então reler todas as atribuições. A otimização remove essas esperas do caminho visível sem alterar o resultado salvo.

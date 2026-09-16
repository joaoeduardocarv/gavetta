# Corrigir tela em branco após atualizações

## Objetivo
Evitar que uma versão antiga do app tente abrir um arquivo de tela que já foi substituído durante uma atualização.

## Implementação
- Detectar especificamente falhas ao carregar telas sob demanda.
- Recarregar a página uma única vez para obter a versão mais recente.
- Impedir ciclos de recarga e preservar erros não relacionados para diagnóstico.
- Validar a tela de perfil e o estado do app após a correção.

## Detalhes técnicos
A proteção ficará no ponto inicial do app, antes da renderização, usando um marcador temporário por endereço. O marcador será removido após uma inicialização bem-sucedida.

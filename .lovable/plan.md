# Corrigir erro 500 do catálogo

## Diagnóstico
Os pedidos com IDs `movie-1`, `movie-7` e `tv-8` vêm de três registros antigos de demonstração. Esses números eram IDs locais, não IDs reais do TMDB, mas a normalização atual passou a tratá-los como IDs do catálogo. O serviço externo responde 404 e a função retorna 500.

## Implementação
- Corrigir os três registros antigos para os IDs reais de Duna: Parte Dois, Interestelar e Succession, preservando nota, comentário, contagem de visualizações e posição; quando já existir uma cópia correta, consolidar sem duplicar.
- Fortalecer a normalização para que IDs numéricos antigos não sejam transformados automaticamente em IDs TMDB. Somente formatos canônicos (`movie-…`, `tv-…`) ou um `production_id` canônico poderão disparar consultas externas.
- Adicionar testes de regressão cobrindo registros legados e IDs canônicos.
- Validar a gavetta no preview autenticado e confirmar que não há novas chamadas para os IDs 1, 7 e 8, nem tela em branco.

## Detalhes técnicos
- A correção de dados será aplicada a todos os registros que correspondam exatamente aos três títulos legados conhecidos.
- Falhas reais do catálogo continuarão usando os dados já armazenados, sem impedir a abertura do conteúdo.

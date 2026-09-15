# Onboarding curto e exibido uma única vez

## O que será ajustado

- Reduzir o tour inicial aos recursos essenciais: Gavettas, Busca e Amigos.
- Reduzir a montagem inicial da estante de 20 para 5 títulos.
- Registrar o onboarding como concluído antes de abrir a seleção de títulos, inclusive quando o usuário pula ou fecha.
- Evitar que o onboarding reapareça no mesmo acesso enquanto a atualização do perfil é salva.
- Manter o comportamento atual para usuários antigos, que já estão marcados como integrados.

## Detalhes técnicos

- Usar `profiles.onboarded_at` como fonte definitiva por usuário.
- Adicionar uma trava temporária por usuário no navegador para impedir reabertura durante o primeiro acesso.
- Ajustar `OnboardingDialog` e `QuickStartLibrary`, sem mudanças no banco de dados.
- Validar o fluxo de primeiro acesso e o limite de títulos.

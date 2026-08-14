# Importar podcasts: a IA ouve o episódio inteiro

Hoje o `/import` só lê o que está no HTML do link (título + descrição curta). Para podcasts isso quase nunca contém os títulos citados. O plano faz o Gavetta **ouvir o episódio inteiro**, transcrever e extrair os filmes/séries do que foi falado. Para YouTube, usa a transcrição/legenda do vídeo.

## Como vai funcionar para o usuário

1. Cola o link do episódio (Spotify, Apple Podcasts, Deezer, YouTube ou link direto do feed).
2. O app tenta primeiro as notas do episódio (rápido, alguns segundos).
3. Em seguida entra no modo "ouvindo": mostra uma barra de progresso ("Ouvindo o episódio… 18 de 96 min") e o usuário pode fechar a tela — ao voltar, o trabalho continua de onde parou.
4. Ao terminar, abre a fila normal de cards para adicionar às gavettas, agora mostrando **em que trecho** cada título foi citado.

Aviso claro antes de começar: episódios longos levam alguns minutos e consomem créditos de IA (um episódio de 2h custa bem mais que um Reels).

## Etapas técnicas

### 1. Descobrir o áudio do episódio
Nenhuma plataforma entrega o MP3 pela URL do player, então a resolução é em cascata:
- Extrai o nome do episódio/programa da página (oEmbed + Open Graph).
- Busca o programa na iTunes Search API (pública, sem chave) para obter o `feedUrl` do RSS — verificado: retorna o feed corretamente.
- Lê o RSS, casa o episódio pelo título (normalizado) e pega o `<enclosure url>` — verificado: o feed traz o MP3 direto.
- Se o link colado já for RSS ou MP3, usa direto.
- Sem match: mantém o fluxo atual (notas do episódio) e explica que não foi possível localizar o áudio, oferecendo colar a descrição.

### 2. Transcrever o episódio inteiro
- Baixa o áudio em blocos via HTTP Range (não cabe tudo em memória).
- Fatia em pedaços abaixo do limite de upload, transcrevendo cada pedaço em `POST /v1/audio/transcriptions` com `openai/gpt-4o-mini-transcribe` e concatenando os textos em ordem, com um pequeno overlap entre blocos para não perder um título cortado na emenda.
- MP3 (formato da esmagadora maioria dos feeds) é fatiável por bytes com re-sincronização de frame. Para formatos não fatiáveis (ex.: m4a acima do limite), transcreve o que couber e avisa que só parte foi ouvida.
- Transcrição é guardada por episódio, então reimportar o mesmo link não gasta créditos de novo.

### 3. Extrair os títulos do que foi falado
- A transcrição vai para a extração já existente, agora processada em janelas com sobreposição e resultado deduplicado (uma transcrição de 2h não cabe em um prompt só).
- A trava anti-alucinação continua: o título precisa aparecer na transcrição.
- Cada resultado guarda o trecho onde foi citado, exibido no card.

### 4. YouTube
- Antes de qualquer coisa, tenta a faixa de legendas do vídeo (inclusive automática) e usa esse texto como fonte.
- Sem legenda disponível, cai para título + descrição como hoje.

### 5. Processamento em segundo plano
- Nova tabela `import_jobs` (dono, URL, status, progresso, fonte, resultado, erro) com RLS por usuário: cada um vê e cria apenas os próprios jobs.
- A edge function cria o job, responde na hora e segue processando em background; a tela acompanha o progresso em tempo real e reabre o job em andamento se o usuário voltar depois.
- Timeouts, feed fora do ar e limite de créditos viram mensagem clara no job, sem travar a tela.

## Arquivos afetados

- `supabase/functions/extract-titles/index.ts` — resolução de fonte + criação do job.
- Nova `supabase/functions/transcribe-episode/index.ts` — download, fatiamento, transcrição e extração em background.
- Nova migração — tabela `import_jobs` com GRANTs e políticas por usuário.
- `src/pages/ImportPage.tsx` — estado de progresso, retomada de job e aviso de custo/tempo.
- `src/components/ImportQueueDialog.tsx` — exibir o trecho citado.
- `src/lib/importFromLink.ts` — invocação e acompanhamento do job.

## Limitações honestas

- Áudio protegido por DRM (exclusivos Spotify/Amazon sem feed público) não pode ser ouvido; nesses casos só as notas do episódio.
- Vídeo do YouTube sem legenda alguma continua limitado à descrição (o áudio do YouTube não é acessível para download).
- Transcrição automática erra nomes ocasionalmente; por isso a fila de revisão continua exigindo a confirmação do usuário em cada card.

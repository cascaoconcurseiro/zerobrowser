# Handoff — Zero Browser

## Estado em 2026-10-27 (integração 0.1.5-dev)

- Árvore única: `main` com a integração commitada (`68e51f7` → `be7677f` → registro deste build). A paginação do
  `read_batch` (que estava sem commit) foi commitada, a branch `claude/analise-projeto-atual-bf8fc8` foi rebaseada
  sobre o `main` — 2 conflitos resolvidos — e aplicada por fast-forward. Histórico linear, sem merge commit e sem push.
- Verificação desta integração: `npm test` **177/177**; `node --check` em todo `src/`, `scripts/`, `bench/`, `test/`;
  `git diff --check` limpo; `npm audit --omit=dev` zero. Integrações Electron na árvore instalada:
  `test:electron` exit 0, `test:bench-store` PASS, `test:agent-download` PASS. Benchmark real: 44 e 33 passaram,
  com 5×5 na 44 depois do ajuste do journal (ver abaixo).
- **Build e instalação (2026-10-27):** `dist\Zero Browser Setup 0.1.5-dev.exe` (124.430.162 bytes,
  SHA-256 `4769f4eb2905f7710a4cd426fd1d9121d49603a821596e289ab8bdc5ce82bcc4`) foi instalado em
  `%LOCALAPPDATA%\Programs\navegante` após validação do `win-unpacked` em perfil isolado. O `app.asar` do build e
  da instalação coincidem: `3658148c12a1335a1ebf6988ae5f557c8d9ac3d3d226ebe182105acd4f606401`. O executável
  instalado informa `FileVersion 0.1.5-dev` (`ProductVersion 0.1.5.0`) e passou `scripts/installed-agent.integration.js`
  com `status: PASS` (AX, CUA, configurações, downloads, provedores mockados, aprovação/cancelamento, segunda instância).
  A instalação ANTERIOR (0.1.4, `app.asar` `b14007...`) está preservada em `backups/2026-10-27-before-0.1.5-dev/`
  (app 184 arquivos/374 MB, perfil 7.776 arquivos/763 MB, atalhos e instalador 0.1.4), com instruções de restauração
  em `LEIA-ME.md` da mesma pasta.
- **Produção agora roda um build `-dev`.** Ele não passou pelos gates de release (integrações Electron restantes,
  benchmark pareado, inspeção visual). Reverter é instalar o 0.1.4 do backup; o perfil não foi migrado.
- O instalador NSIS abre o app ao terminar: há processos `Zero Browser.exe` do perfil real desde 15:01. Isso não
  afeta o hash nem o backup (feito com o app fechado).
- Correção aplicada: `coverage.complete` voltou a significar "não falta mais nada". O último trecho de uma leitura
  paginada agora é `complete` (antes era sempre falso), e uma leitura por `tabId` não conta as outras abas como
  omitidas. Regra em `src/automation/batch-coverage.js`; detalhe, conflitos e reversão em
  `docs/REGISTRO_INTEGRACAO_0.1.5.md`.
- Versão: `package.json` e `package-lock.json` em 0.1.13-dev (o lock acompanha; teste `test/whats-new.test.js`).
- **Motor, salto 1 (2026-10-27):** `run_steps` aceita `expect {url,text,absent}` conferido pelo host (espera de até
  3 s, texto normalizado, parada quando a pós-condição não vem). Opt-in: só com `actionScripts`/`--scripts`.
  `npm test` 133/133; regra em `docs/EVOLUCAO_MOTOR.md`; restauração em `docs/PONTOS_DE_RESTAURACAO.md`
  (tag `motor-pre-leaps-2026-10-27`). Sem benchmark e AUSENTE do app instalado até um novo build.
- **Motor, salto 2 (2026-10-27):** journal de efeitos (`effectJournal` / `--journal`). Ação consequente é registrada
  antes de despachar; repetir depois de falha/timeout exige leitura da página; sucesso vira `alreadyDone`; entradas
  expiram em 30 min e persistem entre reinícios. `npm test` 141/141; limites e desenho em `docs/EVOLUCAO_MOTOR.md`.
  Opt-in, sem benchmark e ausente do app instalado.
- **Motor, salto 3 (2026-10-27):** risco por capacidade (`src/automation/risk.js`) substitui a regex única de
  aprovação. Níveis credential/destructive/commitment/write/none, precedência e motivo específico no diálogo;
  "Minha conta" e "Meus pedidos" deixaram de pedir aprovação. `npm test` 148/148; `--journal` e demais flags seguem
  opt-in e ausentes do app instalado.
- **Motor, salto 4 (2026-10-27):** verificação final por contrato (`verify` no `run_task`): url/text/absent/
  textCount/download conferidos pelo host, `requireVerification` recusa "concluído" sem prova e o trace guarda só
  booleanos. `npm test` 153/153; detalhe e limites em `docs/EVOLUCAO_MOTOR.md`. Não está no app instalado.
- **Motor, salto 5 (2026-10-27):** correção após verificação (`correctionRounds` 0–3): a falha volta ao agente com o
  motivo (sem texto da página) e gasta uma rodada; `requireVerification` agora recusa também quando o laço já
  verificou. `npm test` 155/155; sem benchmark e ausente do app instalado.
- **Motor, salto 6 (2026-10-27):** a verificação aprovada vira prova de efeito: confirma tentativas pendentes do
  journal (`proof: task-verification`); contrato falho mantém `attempted`. `npm test` 157/157.
- **Motor, salto 7 (2026-10-27):** gate do journal dentro de `run_steps` (`beforeStep`/`afterStep`): passo já
  confirmado é pulado, efeito desconhecido bloqueia o lote sem despachar, e falha/exceção liquidam a tentativa.
  `npm test` 161/161. Lacuna do salto 6 fechada.
- **Motor, salto 8 (2026-10-27):** extração estruturada (`extract_table`, opt-in): tabela por selector/índice,
  colunas por cabeçalho, deduplicação, limite e proveniência; trace só com contagens. `npm test` 168/168.
- **Motor, salto 9 (2026-10-27):** `check_task` consulta o contrato no meio da tarefa (somente leitura, `ok:false`
  como resultado normal, catálogo só com contrato). `npm test` 170/170.
- **Motor, salto 10 (2026-10-27):** ETL paralelo entre abas: `read_batch` com `extract` devolve linhas estruturadas
  por aba, com proveniência, `missingColumns`/`truncationReasons` e agregados; catálogo em 7.815 bytes.
  `npm test` 173/173.
- **Motor, salto 11 (2026-10-27):** receitas por site (`recipe`, opt-in): passos estáveis com `expect` obrigatório,
  armazenamento por origem e execução sem modelo. `npm test` 177/177. Sem captura automática e sem journal nos
  passos da receita.
- **Motor, salto 12 (2026-10-27):** canal alternativo para canvas: `clipboard` (read/write TSV, write com aprovação)
  e `key_sequence` (setas/Tab/F2/Ctrl com repetição; Enter/espaço com aprovação). `advancedInput` ligado por padrão,
  +1.020 bytes de catálogo. `npm test` 181/181; fluxo em `docs/PLANILHAS_E_SITES_DIFICEIS.md`.
- **Checkpoint 2 instalado (2026-10-27):** `dist\Zero Browser Setup 0.1.5-dev.exe` (124.443.992 bytes,
  SHA-256 `e57c20cc…580632`), `app.asar` `2658b925…06088b` igual em build/produção, integração do instalado
  `status: PASS`. Backup do checkpoint anterior em `backups/2026-10-27-before-clipboard/` (`ae7a6564…0ae96a`).
  `npm test` 181/181. Perfil intacto.
- **Checkpoint 3 instalado (2026-10-27):** build com `visual_click` e `sheets_accessibility`
  (instalador `a2339c55…ad151c`, `app.asar` `39cb96e1…7494f8`, integração `status: PASS`); backup em
  `backups/2026-10-27-before-visual/`. `npm test` 185/185.
- **Checkpoint 4 instalado (2026-10-28):** journal estreitado a efeito crítico (instalador `36104023…effaff`,
  `app.asar` `92940a8c…02b720`, `status: PASS`); backup em `backups/2026-10-27-before-journal-fix/`.
  Medição 5×5 na tarefa 44: 5/5 das duas condições, journal com −16,1% passos, −15,1% chamadas e −10,1% tokens;
  regressão do journal removida (prova estatística ainda requer 14 tarefas e outro modelo).
- **Checkpoint 5 instalado (2026-10-28):** versão **0.1.6-dev** (instalador `Zero Browser Setup 0.1.6-dev.exe`,
  SHA-256 `d493c626…2165df`, 124.447.459 bytes; `app.asar` `40f5be10…9257dd` igual em build/produção; integração
  `status: PASS`). Backup do estado anterior em `backups/2026-10-28-before-recipe-v2/`. Perfil intacto.
- **Checkpoint 6 instalado (2026-10-28):** versão **0.1.7-dev** com **mint automático** (`saveRecipe`), ferramenta
  **`sheets`** (read/write/goto A1 sem clicar em célula) e receitas v2 (schema de entrada + `possibleCommit`).
  Instalador `Zero Browser Setup 0.1.7-dev.exe` (SHA-256 `6740ee31…903f19`, 124.449.277 bytes); `app.asar`
  `a977bf32…8a59b2` igual em build/produção; integração `status: PASS`; `npm test` 194/194. Backup do 0.1.6-dev em
  `backups/2026-10-28-before-mint/` (`40f5be10…`).
- **Checkpoint 7 instalado (2026-10-28):** versão **0.1.8-dev** com **credencial com escopo de origem**
  (`authenticationOrigins`) e **autoridade de receita** (`read`/`write`). Instalador
  `Zero Browser Setup 0.1.8-dev.exe` (SHA-256 `3b76846c…f80278b`, 124.450.032 bytes); `app.asar`
  `55a0f841…33c52` igual em build/produção; integração `status: PASS`; `npm test` 198/198. Backup do 0.1.7-dev em
  `backups/2026-10-28-before-credential/` (`a977bf32…`).
- **Checkpoint 8 instalado (2026-10-28):** versão **0.1.9-dev** com **diagnóstico do `sheets`** (`diagnostics` e
  códigos `NAME_BOX_NOT_FOUND`/`CLIPBOARD_EMPTY`). Instalador `Zero Browser Setup 0.1.9-dev.exe` (SHA-256
  `fd752acc…1b09e`, 124.450.036 bytes); `app.asar` `1a769d28…c3033` igual em build/produção; integração
  `status: PASS`; `npm test` 199/199. Backup do 0.1.8-dev em `backups/2026-10-28-before-diagnostics/`.
- **Checkpoint 9 instalado (2026-10-28):** versão **0.1.10-dev** com **nome acessível padrão (accname W3C)** no
  snapshot e no locator. Instalador `Zero Browser Setup 0.1.10-dev.exe` (SHA-256 `e2f06273…2d27c6c`, 124.451.280
  bytes); `app.asar` `bf495150…5e045` igual em build/produção; integração `status: PASS`; `npm test` 202/202.
  Backup do 0.1.9-dev em `backups/2026-10-28-before-accname/`.
- **Checkpoint 10 instalado (2026-10-28):** versão **0.1.11-dev** com **contrato de saída por receita**: campos
  tipados por célula A1, validação sobre a grade realmente lida, `output`/`outputValid` ou `OUTPUT_INVALID` com
  problemas por campo; `sheets` (read/write/goto) passou a ser passo de receita. Regra em
  `src/automation/output-schema.js` e `src/automation/recipe-store.js`; teste `test/output-schema.test.js`.
  Instalador `Zero Browser Setup 0.1.11-dev.exe` (SHA-256 `229ee406…a901e2`, 124.454.153 bytes); `app.asar`
  `0d46e9db…b043a` igual em build/produção; integração `status: PASS`; `npm test` 208/208. Backup do 0.1.10-dev em
  `backups/2026-10-28-before-output-schema/`.
- **Checkpoint 11 instalado (2026-10-28):** versão **0.1.12-dev** com **Guardian determinístico** (recusa
  navegação não-HTTP, upload para origem estranha, formulário cross-site, receita de leitura que grava; revisa
  afirmação de efeito sem prova) e **cache de prefixo opt-in** (`promptCache`, `promptCache.cacheHitRate`).
  Instalador `Zero Browser Setup 0.1.12-dev.exe` (SHA-256 `cf33b29d…c53f3f`, 124.456.756 bytes); `app.asar`
  `aee7ee6e…ae91e21` igual em build/produção; integração `status: PASS`; `npm test` 218/218. Backup do 0.1.11-dev
  em `backups/2026-10-28-before-guardian/`.
- **Checkpoint 12 instalado (2026-10-28):** versão **0.1.13-dev** com **tarefa durável** (`JobStore` em disco, TTL
  20 min, aba recriada na retomada, `automation:jobs`), **receitas via MCP** (`recipe_list`/`recipe_run`) e
  **transformação isolada** (`transform` em processo filho com lista negra estática e timeout de 2 s). Instalador
  `Zero Browser Setup 0.1.13-dev.exe` (SHA-256 `0d2ae9b6…6fc03`, 124.459.785 bytes); `app.asar` `3e88f32c…bf6d0e`
  igual em build/produção; integração `status: PASS`; `npm test` 233/233. Backup do 0.1.12-dev em
  `backups/2026-10-28-before-durable-jobs/`.
- **Publicação (2026-10-28):** `main` em `c13447e` enviado a `origin/main` (26 commits desde 0.1.4); tag
  `motor-pre-leaps-2026-10-27` publicada. Nenhum build/instalador foi anexado a release no GitHub.
- **Primeiras execuções reais (deepseek-flash, 1 por condição):** tarefa 44 padrão 13 passos/13,0 s/47.456 tokens;
  44 `--journal` 18/28,5 s/117.753 (piorou — não promover sem 5 repetições); 33 padrão 12/13,7 s/52.871;
  33 `--scripts` 5/10,3 s/33.065. Todas 1/1. Detalhe e ressalvas em `docs/EVOLUCAO_MOTOR.md`.
- **Checkpoint instalado (2026-10-27):** build com os 11 saltos, `dist\Zero Browser Setup 0.1.5-dev.exe`
  (124.441.875 bytes, SHA-256 `9df4ed8b…a8545f`), instalado sobre o build anterior após `win-unpacked` passar.
  `app.asar` build/instalado: `ae7a6564…0ae96a`; integração do instalado `status: PASS`; `npm test` 177/177 na
  árvore. Backup do estado anterior em `backups/2026-10-27-before-motor-leaps/` (`3658148c…f606401`, 184 arquivos)
  com `LEIA-ME.md`. Perfil não foi tocado. Roteiro de teste em `docs/COMO_TESTAR.md`.
- Continua SEM verificação no app: perfis (menu ⋮), menu de contexto de abas, histórico persistente de downloads,
  atalhos com foco na página e todas as flags opt-in do motor (`--preinspect`, `--scripts`, `--diff`,
  `--cascade=`, `--stream`, `--journal`, `structuredExtraction`, `recipes`).
- Os registros de 2026-10-27 abaixo foram escritos ANTES desta integração e dizem "não commitado / suíte não
  rodada"; o estado vigente é o desta seção.

## Histórico (2026-10-26 e anteriores)

- 2026-10-27 (não commitado, SEM testes a pedido): perfis (menu ⋮ > Perfis: abrir/criar/excluir; processo separado por `ZERO_USER_DATA`; sem renomear), aliases `ZERO_*` (`src/env.js`) e prompt de sistema extraído para `src/automation/service/prompt.js`. Só `node --check` e conferência do texto do prompt foram feitos; `npm test`, `test:electron` e o app NÃO foram rodados. Fase B do nome, `appId`, pipe e o resto da divisão do `AutomationService` seguem pendentes. PRÓXIMO: `npm install` (se faltar) + `npm test`; abrir 2 perfis no app e conferir; depois os A/B das flags.

- 2026-10-27 (commit): histórico de downloads persistente, menu de contexto das abas, clique do meio fecha aba, plano de nome/perfis (`docs/PLANO_NOME_E_PERFIS.md`). Verificação: `npm test` 124/124 (3 execuções seguidas, sem repetir a falha 84/86 antiga), `test:electron` exit 0, `npm audit --omit=dev` zero. NÃO conferido no app: menu de aba, histórico de downloads após reiniciar. NÃO feito: perfis, migração do nome, divisão do `AutomationService`, A/B das flags novas.

- 2026-10-27: implementados opt-in e SEM benchmark: `run_steps` (`--scripts`), snapshot por diferença (`--diff`), cascata (`--cascade=modelo`), streaming (`--stream`, sem execução antecipada). Detalhes e riscos em `docs/EVOLUCAO_MOTOR.md` ("Próximos níveis implementados"). `npm test` 121/121. PRÓXIMO: A/B de cada flag contra a base (difícil, 3 rep, A B B A, `--comparar`); os caminhos dentro de `runAgent` ainda não rodaram no app.

- A/B `--preinspect` RODADO (difícil, 3 rep, A B B A, deepseek-flash): acerto 99% → 100%, chamadas −18%, tempo −21%, tokens não cacheados −14%, passos inconclusivo. Detalhe e ressalvas em `docs/EVOLUCAO_MOTOR.md` ("A/B `--preinspect`"). PRÓXIMO: repetir no conjunto básico, em `reais` e com outro modelo; depois decidir ligar por padrão. A/B de `calculate`/repeat-guard/href/retry contra 0.1.4 segue pendente.

- Sessão de análise (não commitada, testes adiados a pedido): permissão de localização Google só em HTTPS pela origem do pedido; `src/automation/injection-guard.js` (aviso de prompt injection nos resultados de ferramentas, ligado em `service/index.js`); helpers/schemas movidos para `src/automation/service/helpers.js`. Só `node --check` e `test/injection-guard.test.js` foram rodados; `npm test` completo, `test:electron` e benchmark NÃO foram rodados após essas mudanças. Esta cópia não tem `node_modules` (rodar `npm install` antes).
- Também feito (sem rodar a suíte): `src/automation/exfiltration-guard.js` (aprovação para navegação a outro site com dados na URL) e atalhos novos em `src/main/browser-shortcuts.js` + `handleBrowserShortcut` no renderer. Testes novos: `test/exfiltration-guard.test.js` (exige tldts instalado). Não feito: persistir histórico de downloads (hoje só da sessão), menu de contexto de abas, perfis; exigem o app rodando para validar.
- Motor (hipóteses, sem benchmark): retry em 429/5xx, ferramenta `calculate`, `repeat-guard`, href curto no snapshot, métrica `cachedInputTokens`. Detalhes e riscos em `docs/EVOLUCAO_MOTOR.md` (seção "Revisão do motor"). ATENÇÃO: o catálogo mudou de 6.747 para 7.148 bytes (teste atualizado, não rodado). Antes de promover a "seleção contextual de schemas" medir cache: ela pode piorar. Primeiro benchmark pareado: 0.1.4 vs esta versão, comparando `inputTokens - cachedInputTokens`.
- `preInspect` (opt-in, `src/automation/service/index.js` perto do bloco de retomada) e comparador pareado `bench/comparador.js` (`--comparar`). Testes novos escritos e rodados isoladamente: `test/comparador.test.js`, `test/engine-helpers.test.js` (11 passam). VERIFICAÇÃO (2026-10-26, após `npm install`): `npm test` 114/114 em 5 execuções seguidas; `npm audit --omit=dev` zero vulnerabilidades; `npm run test:electron` exit 0 (sem saída, igual ao 0.1.4). Uma primeira execução logo após o install deu 84/86 com 2 falhas que não reapareceram em 5 rodadas (causa não identificada; provável instabilidade de primeira execução, vigiar). Sem teste específico de `preInspect` (o caminho exige aba Electron real). PRÓXIMO PASSO: A/B do CHECKLIST (base x `--preinspect`); exige o app aberto com chave de provedor e gasta tokens reais, por isso aguarda autorização.
- Nome: os usos internos de "navegante" (partição `persist:navegante`, pasta de dados, pipe, `appId`) foram mantidos de propósito; renomear apagaria logins/perfil e quebraria a atualização. Só mudar com plano de migração.
- Próximo: `npm install` + `npm test`; depois os A/B do CHECKLIST (motor). Lacunas de navegador ainda abertas: menu de contexto de abas, histórico de downloads persistente, perfis (precisam do app rodando).

- Revisadas mudanças Antigravity e corrigidos bloqueio de `zero://newtab`, corrida de freeze/unfreeze, allowlist de pop-ups e permissões de extensão truncadas; release 0.1.3 foi publicado anteriormente.
- Para avançar o motor, `tabs.read_batch` agora relata páginas truncadas, falhas, abas omitidas e correspondências encontradas/devolvidas/omitidas. O trace inclui apenas contadores; nenhuma leitura textual foi adicionada às métricas. O prompt orienta o agente a continuar se `coverage.complete` for falso.
- Verificação 0.1.4: `npm test` 94/94; `npm audit --omit=dev` zero vulnerabilidades; `npm run test:electron` exit code 0; build Windows concluído; integração final do executável de produção passou (AX, CUA, configurações, downloads, aprovação/cancelamento e providers mockados).
- Instalação de produção em `%LOCALAPPDATA%\Programs\navegante` informa 0.1.4. SHA-256 final de `app.asar` no build e produção: `B14007B409DFC0ACB2F88F5873C9A9828F3970A264B0DAA8AE249F9464B6ACB9`. Desktop e menu Iniciar apontam para o executável de produção.
- Backup `backups/2026-10-26-before-0.1.4` preserva o executável anterior 0.1.3, atalhos, instalador 0.1.4 e perfil. Perfil e cópia: 7.571 arquivos e 762.275.248 bytes.
- O instalador temporário de validação, por compartilhar o `appId`, substituiu/removeu a instalação anterior; o caminho original foi restaurado instalando o 0.1.4 já validado. Evitar novas instalações isoladas do NSIS antes de planejar esse efeito colateral.
- A alteração do catálogo reduziu o JSON serializado de 6.764 para 6.747 bytes; não equivale a tokens reais e não prova ganho útil. Não há nova medição A/B de acerto, tokens ou latência nesta sessão.
- Release 0.1.4 commitado e enviado a `origin/main` como `e500667`.

## Próximo passo concreto

- Rodar `npm run test:electron` e abrir o app em perfil temporário para conferir o que só existe em teste unitário:
  perfis (abrir/criar/excluir), menu de contexto de abas, histórico de downloads após reiniciar e atalhos com foco
  na página.
- Benchmark pareado 0.1.4 vs 0.1.5-dev no conjunto difícil + básico, medindo `inputTokens - cachedInputTokens`,
  chamadas, passos e tempo com `bench/comparador.js`. A correção de `coverage.complete` precisa ser confirmada no
  modelo: a tarefa 44 deve parar de paginar quando o último trecho vier `complete`.
- A/B isolado de `--scripts` e de `--diff` (um por vez); só promover com acerto igual e custo menor.
- Repetir `--preinspect` no conjunto `reais` e com outro modelo antes de cogitar ligá-lo por padrão.
- Só depois de tudo isso: build, instalador isolado com backup restaurável e, com pedido explícito, push/publicação.

## Limites e bloqueios

- A integração empacotada usa fixtures locais e provider mock; não valida Google Planilhas autenticado, Amazon com conta ou todos os sites complexos.
- Memória persistente entre tarefas continua sem evidência de benefício; o teste de notas anterior aumentou tokens e tempo sem elevar acerto.
- O objetivo de navegador próprio, maior cobertura real e desempenho comprovado segue aberto. Não declarar paridade geral com base em fixtures ou no catálogo compacto.

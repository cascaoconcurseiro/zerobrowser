# Handoff — Zero Browser

## Estado em 2026-10-27 (integração 0.1.5-dev)

- Árvore única: `main` em `12681cf`. A paginação do `read_batch` (que estava sem commit) foi commitada, a branch
  `claude/analise-projeto-atual-bf8fc8` foi rebaseada sobre o `main` — 2 conflitos resolvidos — e aplicada por
  fast-forward. Histórico linear, sem merge commit e sem push.
- Verificação desta integração: `npm test` **127/127**; `node --check` em todo `src/`, `scripts/`, `bench/`, `test/`;
  `git diff --check` limpo; `npm audit --omit=dev` zero. NÃO rodados: `test:electron`, `test:bench-store`,
  `test:agent-download`, `test:installed`, app aberto, benchmark com modelo real, build/instalação e push.
  A produção continua em 0.1.4.
- Correção aplicada: `coverage.complete` voltou a significar "não falta mais nada". O último trecho de uma leitura
  paginada agora é `complete` (antes era sempre falso), e uma leitura por `tabId` não conta as outras abas como
  omitidas. Regra em `src/automation/batch-coverage.js`; detalhe, conflitos e reversão em
  `docs/REGISTRO_INTEGRACAO_0.1.5.md`.
- Versão: `package.json` e `package-lock.json` em 0.1.5-dev (o lock estava em 0.1.4).
- Continua SEM verificação no app: perfis (menu ⋮), menu de contexto de abas, histórico persistente de downloads,
  atalhos com foco na página e todas as flags opt-in do motor (`--preinspect`, `--scripts`, `--diff`,
  `--cascade=`, `--stream`).
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

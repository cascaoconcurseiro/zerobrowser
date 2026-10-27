# Registro de integração — 0.1.5-dev (2026-10-27)

Documento de evidência da sessão que corrigiu a cobertura de `tabs.read_batch` e integrou a branch
`claude/analise-projeto-atual-bf8fc8` ao `main`. Registra o que mudou, como foi verificado, o que continua sem
verificação e como reverter. Não substitui `HANDOFF.md` (estado) nem `docs/EVOLUCAO_MOTOR.md` (evolução do motor).

## Ponto de partida

O repositório tinha três fluxos separados, com risco de divergência:

| Fluxo | Onde estava | Estado |
|---|---|---|
| 0.1.4 (release publicado) | `main` em `0936f6d` | estável, 95 testes |
| Paginação do `read_batch` | árvore de trabalho do `main`, não commitada | funcional, testes atualizados |
| 0.1.5-dev (perfis, guardas, motor opt-in) | worktree `.claude/worktrees/...`, branch `claude/...` | 3 commits, 124 testes, base anterior à paginação |

A branch não continha a paginação e alterava o mesmo arquivo (`src/automation/service/index.js`), então
qualquer integração passaria por conflito.

## Sequência executada

1. **Commit da paginação** — `68e51f7 feat: paginate batch reads with tab and content versions`.
   Publicou o que já estava na árvore: `tabOffset`/`tabVersion` para abas, `contentOffset`/`contentVersion` para
   texto, com versões derivadas do conteúdo para reiniciar a leitura quando a página muda.
2. **Correção de cobertura** — `e72b991 fix: make batch coverage describe what still remains` (detalhe abaixo).
3. **Rebase da branch sobre o `main`** — os 3 commits reaplicados em ordem, com 2 conflitos resolvidos.
4. **Fast-forward do `main`** — `git merge --ff-only`, sem merge commit; histórico linear.
5. **Ajuste de versão** — `package-lock.json` estava em 0.1.4 enquanto `package.json` já era 0.1.5-dev.

## Correção: `coverage.complete` em leitura paginada

### Sintoma

Toda continuação era marcada como truncada (`previous_content`), e uma leitura pedida por `tabId` contava as
outras abas da tarefa como omitidas (`tabsOmitted = total − 1`). Consequência: `coverage.complete` era **sempre
falso**, inclusive no último trecho, quando não restava nada a ler. O prompt manda continuar enquanto
`complete` for falso — o sinal de parada se contradizia.

### Regra nova

- `truncated`, por página, significa **o que ainda falta nesta página**: texto além da janela de 600 caracteres
  (`remaining_content`) ou correspondências ainda não alcançadas (`remaining_matches`).
- `matchesOmitted` conta apenas o que fica **depois** da janela atual; trechos já entregues não são omissão.
- `tabsOmitted` só existe no modo lista (`tabOffset`); leitura por `tabId` não omite as outras abas.
- `complete` continua sendo `sem falhas && sem página truncada && sem aba omitida && sem correspondência omitida`.
  Agora a última chamada de uma paginação bem-sucedida devolve `true`.

Arquivos: `src/automation/service/index.js` (script da página + montagem do resultado + nota),
`src/automation/batch-coverage.js` (soma de `matchesRemaining`, com fallback para o cálculo antigo).

Testes: 3 novos em `test/batch-coverage.test.js` (último trecho completo, trecho com correspondências à frente,
contrato antigo preservado) e 4 asserções novas em `test/batch-pagination.test.js` (último trecho `complete`,
`nextContentOffset` ausente, intermediários incompletos, `tabsOmitted` zero em leitura por `tabId`).

## Conflitos do rebase e resolução

| Commit | Arquivo | Conflito | Resolução |
|---|---|---|---|
| `48ab965` | `test/agent-tool-registry.test.js` | ambos mudaram o tamanho serializado do catálogo | mantido o catálogo da branch (com `calculate`) e recalculado o valor real: **7329 bytes** (6928 da paginação + 401 do `calculate`) |
| `1625715` | `src/automation/service/index.js` | branch substituiu o prompt literal por `buildBasePrompt(...)`; a paginação havia alterado o mesmo literal | mantida a extração para `service/prompt.js` e **transportado o texto novo** (offsets de continuação + semântica de `complete`) para dentro de `buildBasePrompt` |

O `src/automation/service/index.js` auto-mergeou no restante: imports da branch + `createHash` da paginação
coexistem, e o bloco de `read_batch` permanece com a versão paginada.

## Evidências

| Verificação | Resultado |
|---|---|
| `npm test` no `main` antes da sessão | 95/95 |
| `npm test` após a paginação (já commitada) | 95/95 |
| `npm test` após a correção de cobertura | 97/97 |
| `node --test` na branch isolada (antes do rebase) | 124/124 |
| `npm test` após correção + rebase + fast-forward | **127/127** |
| `node --check` em todos os `.js` de `src`, `scripts`, `bench`, `test` | sem erro |
| `git diff --check` | sem espaços/erros |
| `npm audit --omit=dev` | 0 vulnerabilidades |

Os testes extras em relação à branch (124 → 127) são os 3 novos de cobertura; o total do `main` subiu de 95 para
127 porque incorporou os 32 testes da branch mais os novos.

## O que NÃO foi verificado

- **App rodando**: perfis (abrir/criar/excluir), menu de contexto de abas, histórico persistente de downloads,
  atalhos com foco na página, `preInspect`, `run_steps`, `--diff`, `--cascade`, `--stream` não foram exercitados
  em janela real. Os testes cobrem módulos puros e caminhos do serviço com fixtures, não a UI.
- **Integrações Electron**: `npm run test:electron`, `test:bench-store`, `test:agent-download` e `test:installed`
  não foram rodados nesta sessão (exigem GUI/build).
- **Benchmark com modelo real**: nenhum A/B novo. O efeito da correção de cobertura no comportamento do agente
  (parar de paginar no fim) é **esperado, não medido**.
- **Build/instalação/publicação**: nada foi compilado, instalado ou enviado a `origin`. A produção segue 0.1.4.

## Riscos e pendências herdados da branch

- `--preinspect` tem A/B favorável (difícil, 3 repetições, A B B A), mas segue **desligado por padrão** até
  repetir no conjunto básico, em `reais` e com outro modelo.
- `--scripts`, `--diff`, `--cascade=`, `--stream` são opt-in sem benchmark; o diff exige que o modelo junte base
  e diferenças, o que pode custar acerto.
- Guarda de injeção é aviso, não bloqueio; guarda de exfiltração cobre navegação com dados na URL, não
  formulário/script.
- `AutomationService` continua em um arquivo grande (~2,4 mil linhas); só prompt e helpers saíram.

## Como reverter

- Antes da sessão: `git reset --hard 0936f6d` (descarta paginação, correção e integração).
- Só a correção de cobertura: `git revert e72b991`.
- Só a integração 0.1.5-dev: `git reset --hard e72b991` (o `main` volta a 0.1.4 + paginação + correção).

## Próximos passos sugeridos

1. Rodar `npm run test:electron` e abrir o app para conferir perfis, menu de abas e downloads persistentes.
2. Benchmark pareado 0.1.4 vs 0.1.5-dev (difícil + básico), medindo `inputTokens - cachedInputTokens`.
3. A/B de `--scripts` e `--diff` isoladamente; promover só com acerto igual.
4. Repetir `--preinspect` em `reais` antes de cogitar ligá-lo por padrão.

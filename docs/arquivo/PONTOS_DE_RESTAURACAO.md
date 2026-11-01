# Pontos de restauração

Regra daqui em diante: **cada evolução do motor entra em um commit próprio, com testes e documentação, e o estado
anterior fica recuperável por tag, commit ou backup**. Nada de mudanças acumuladas sem volta.

## Estado de referência (antes dos saltos do motor)

- Tag: **`motor-pre-leaps-2026-10-27`** → commit `5015071` (`docs: record 0.1.5-dev build and production install`).
- O que havia nesse ponto: 0.1.5-dev integrado, `npm test` 127/127, build instalado em produção
  (`app.asar` `3658148c…f606401`) e backup do 0.1.4 em `backups/2026-10-27-before-0.1.5-dev/`.

### Voltar o código para esse ponto

```bash
git reset --hard motor-pre-leaps-2026-10-27
```

Se houver trabalho novo que precise ser preservado, use `git branch resgate/<data>` antes do reset.

### Voltar o aplicativo instalado para 0.1.4

```bash
# com o Zero Browser fechado
backups/2026-10-27-before-0.1.5-dev/installer/"Zero Browser Setup 0.1.4.exe"
```

O `LEIA-ME.md` da pasta traz os hashes esperados e como restaurar o perfil.

## Histórico de saltos

| Data | Salto | Commit | Testes | Reversão |
|---|---|---|---:|---|
| 2026-10-27 | Pós-condições verificadas em `run_steps` (`expect: {url,text,absent}`), com espera de até 3 s e falha que interrompe o roteiro | `git log --oneline --grep="postconditions"` | 133/133 | `git revert <commit>` ou reset para a tag acima |
| 2026-10-27 | Journal de efeitos com idempotência (`effectJournal`/`--journal`): bloqueia repetição sem verificação, `alreadyDone` após sucesso, TTL de 30 min e persistência entre reinícios | `git log --oneline --grep="effect journal"` | 141/141 | `git revert <commit>` ou reset para a tag acima |
| 2026-10-27 | Risco por capacidade (`src/automation/risk.js`): níveis credential/destructive/commitment/write, precedência e motivos específicos; remove falso positivo de "conta"/"pedido" isolados | `git log --oneline --grep="risk"` | 148/148 | `git revert <commit>` ou reset para a tag acima |
| 2026-10-27 | Verificação final por contrato (`verify`/`requireVerification`): url, text, absent, textCount e download conferidos pelo host, com prova no resultado e no trace | `git log --oneline --grep="verification"` | 153/153 | `git revert <commit>` ou reset para a tag acima |
| 2026-10-27 | Correção após verificação (`correctionRounds` 0–3): falha volta ao agente com o motivo e gasta uma rodada; recusa vale também quando o laço já verificou | `git log --oneline --grep="correction"` | 155/155 | `git revert <commit>` ou reset para a tag acima |
| 2026-10-27 | Verificação aprovada como prova de efeito: `confirmAttempted` confirma tentativas pendentes do journal (`proof: task-verification`); contrato falho mantém `attempted` | `git log --oneline --grep="proof"` | 157/157 | `git revert <commit>` ou reset para a tag acima |
| 2026-10-27 | Gate do journal dentro de `run_steps`: passo confirmado é pulado, efeito desconhecido bloqueia o lote sem despachar, falha/exceção liquidam a tentativa | `git log --oneline --grep="run_steps gate"` | 161/161 | `git revert <commit>` ou reset para a tag acima |
| 2026-10-27 | Extração estruturada (`extract_table`, opt-in): tabela por selector/índice, colunas por cabeçalho, deduplicação, limite e proveniência (`url`, `totalRows`, `missingColumns`, `truncated`) | `git log --oneline --grep="extract"` | 168/168 | `git revert <commit>` ou reset para a tag acima |
| 2026-10-27 | `check_task`: consulta do contrato no meio da tarefa (somente leitura, `ok:false` como resultado normal, catálogo só com contrato) | `git log --oneline --grep="check_task"` | 170/170 | `git revert <commit>` ou reset para a tag acima |
| 2026-10-27 | ETL paralelo entre abas: `read_batch` com `extract` devolve linhas estruturadas por aba, proveniência, `missingColumns`/`truncationReasons` e agregados | `git log --oneline --grep="batch extract"` | 173/173 | `git revert <commit>` ou reset para a tag acima |
| 2026-10-27 | Receitas por site (`recipe`, opt-in): passos estáveis com `expect` obrigatório, armazenamento atômico por origem e execução sem modelo | `git log --oneline --grep="recipe"` | 177/177 | `git revert <commit>` ou reset para a tag acima |
| 2026-10-27 | Checkpoint instalado com os 11 saltos: instalador `9df4ed8b…a8545f`, `app.asar` `ae7a6564…0ae96a` igual em build/produção, backup do app anterior em `backups/2026-10-27-before-motor-leaps/` | build, não commit | 177/177 | reinstalar/copiar `backups/2026-10-27-before-motor-leaps/app` |
| 2026-10-27 | Checkpoint com clipboard/teclado: instalador `e57c20cc…580632`, `app.asar` `2658b925…06088b`, backup anterior em `backups/2026-10-27-before-clipboard/` | build, não commit | 181/181 | copiar `backups/2026-10-27-before-clipboard/app` |
| 2026-10-27 | Checkpoint com clique visual/acessibilidade: instalador `a2339c55…ad151c`, `app.asar` `39cb96e1…7494f8`, backup em `backups/2026-10-27-before-visual/`; primeiras execuções reais (44 e 33) passaram | build, não commit | 185/185 | copiar `backups/2026-10-27-before-visual/app` |
| 2026-10-28 | Checkpoint com journal estreitado: instalador `36104023…effaff`, `app.asar` `92940a8c…02b720`, backup em `backups/2026-10-27-before-journal-fix/`; 5×5 na tarefa 44 sem regressão | build, não commit | 185/185 | copiar `backups/2026-10-27-before-journal-fix/app` |
| 2026-10-28 | Checkpoint 5 / **0.1.6-dev**: instalador `d493c626…2165df`, `app.asar` `40f5be10…9257dd`, receitas v2 + menu Novidades; backup em `backups/2026-10-28-before-recipe-v2/` | build, não commit | 187/187 | copiar `backups/2026-10-28-before-recipe-v2/app` |
| 2026-10-28 | Checkpoint 6 / **0.1.7-dev**: instalador `6740ee31…903f19`, `app.asar` `a977bf32…8a59b2`, mint automático + ferramenta `sheets`; backup em `backups/2026-10-28-before-mint/` | build, não commit | 194/194 | copiar `backups/2026-10-28-before-mint/app` |
| 2026-10-28 | Checkpoint 7 / **0.1.8-dev**: instalador `3b76846c…f80278b`, `app.asar` `55a0f841…33c52`, credencial por origem + autoridade de receita; backup em `backups/2026-10-28-before-credential/` | build, não commit | 198/198 | copiar `backups/2026-10-28-before-credential/app` |
| 2026-10-28 | Checkpoint 8 / **0.1.9-dev**: instalador `fd752acc…1b09e`, `app.asar` `1a769d28…c3033`, diagnóstico do `sheets`; backup em `backups/2026-10-28-before-diagnostics/` | build, não commit | 199/199 | copiar `backups/2026-10-28-before-diagnostics/app` |
| 2026-10-28 | Checkpoint 9 / **0.1.10-dev**: instalador `e2f06273…2d27c6c`, `app.asar` `bf495150…5e045`, nome acessível padrão (accname); backup em `backups/2026-10-28-before-accname/` | build, não commit | 202/202 | copiar `backups/2026-10-28-before-accname/app` |

| 2026-10-28 | Checkpoint 39 / **0.1.41-dev**: escala tipográfica única (teste de UI mede 13 px), `app.asar` `351b931d…8dc2`; backup em `backups/2026-10-28-before-type-scale/` | build + instalado | 285/285 | copiar backup |
| 2026-10-28 | Checkpoint 38 / **0.1.40-dev**: índice de configurações com chip por seção, `app.asar` `9819cf50…1f584`; backup em `backups/2026-10-28-before-settings-index/` | build + instalado | 283/283 | copiar backup |
| 2026-10-28 | Checkpoint 37 / **0.1.39-dev**: botão + colado na última aba (teste de UI mede posição/visibilidade), `app.asar` `ef1c4873…bd74b`; backup em `backups/2026-10-28-before-newtab-button/` | build + instalado | 284/284 | copiar backup |
| 2026-10-28 | Checkpoint 36 / **0.1.38-dev**: cabeçalho compacto + skeleton de modelos, `app.asar` `eef2f319…8c30`; backup em `backups/2026-10-28-before-header/` | build + instalado | 284/284 | copiar `backups/2026-10-28-before-header/app` |
| 2026-10-28 | Checkpoint 35 / **0.1.37-dev**: módulos executáveis no painel + memória editável, `app.asar` `41b10337…5201` | build + instalado | 284/284 | reinstalar anterior se necessário |
| 2026-10-28 | Checkpoint 34 / **0.1.36-dev**: lista de tarefas pausadas com Continuar/Descartar, `app.asar` `266fbfbe…2266` | build + instalado | 284/284 | reinstalar anterior se necessário |
| 2026-10-28 | Checkpoint 33 / **0.1.35-dev**: receitas listadas e executáveis no painel, `app.asar` `4839e594…3f47` | build + instalado | 284/284 | reinstalar anterior se necessário |
| 2026-10-28 | Checkpoint 32 / **0.1.34-dev**: renomear/fixar/apagar conversa + teste de módulo menos sensível a carga, `app.asar` `25a714cc…0948` | build + instalado | 284/284 | reinstalar anterior se necessário |
| 2026-10-28 | Checkpoint 31 / **0.1.33-dev**: aprovação no chat opt-in + correção do harness de aceitação, `app.asar` `a91796a4…cd8e` | build + instalado | 284/284 | reinstalar 0.1.32 se necessário |
| 2026-10-28 | Checkpoint 30 / **0.1.31-dev**: copiar resposta e conversa em Markdown, `app.asar` `08710899…6464`; backup em `backups/2026-10-28-before-copy/` | build + instalado | 284/284 | copiar `backups/2026-10-28-before-copy/app` |
| 2026-10-28 | Checkpoint 29 / **0.1.30-dev**: tempo e tokens por resposta (evento done), `app.asar` `dcf8c8d1…2bb75`; backup em `backups/2026-10-28-before-stats/` | build + instalado | 284/284 | copiar `backups/2026-10-28-before-stats/app` |
| 2026-10-28 | Checkpoint 28 / **0.1.29-dev**: stream de eventos no painel (progresso ao vivo + linha do tempo), `app.asar` `662c324e…cf6f6`; backup em `backups/2026-10-28-before-stream-ui/` | build + instalado | 284/284 | copiar `backups/2026-10-28-before-stream-ui/app` |
| 2026-10-28 | Checkpoint 27 / **0.1.28-dev**: etiqueta de código no erro do painel + suite corrigida para toolsUsed, `app.asar` `76888506…5720`; backup em `backups/2026-10-28-before-error-code/` | build + instalado | 283/283 | copiar `backups/2026-10-28-before-error-code/app` |
| 2026-10-28 | Checkpoint 26 / **0.1.27-dev**: rodapé com ferramentas usadas por resposta (lote 1 do plano de UX), `app.asar` `f54d4f4a…e6ef8`; backup em `backups/2026-10-28-before-toolsused/` | build + instalado | 283/283 | copiar `backups/2026-10-28-before-toolsused/app` |
| 2026-10-28 | Checkpoint 25 / **0.1.26-dev**: instalador de estado vazio acionável (3 exemplos), `app.asar` `e28f5b0c…f6f1`; smoke exige os exemplos; backup em `backups/2026-10-28-before-empty-state/` | build + instalado | 282/282 | copiar `backups/2026-10-28-before-empty-state/app` |
| 2026-10-28 | Checkpoint 24 / **0.1.25-dev**: instalador de UX (foco visível, largura de respostas, contraste), `app.asar` `952614b3…b950`; backup em `backups/2026-10-28-before-ux/` | build + instalado | 282/282 | copiar `backups/2026-10-28-before-ux/app` |
| 2026-10-28 | Checkpoint 23 / **0.1.24-dev**: instalador `5539b336…c717`, `app.asar` `db0aec1f…7ca2`, fallback visual (sugestão de see_page quando DOM tem <=3 controles); extras 5/6 com Planilhas aprovada; backup em `backups/2026-10-28-before-vision/` | build + instalado | 282/282 | copiar `backups/2026-10-28-before-vision/app` |
| 2026-10-28 | Checkpoint 22 / **0.1.23-dev**: instalador `71e86885…edb8`, `app.asar` `8c18eba0…b4a9`, allowCredentials para sites de QA, suítes extras/email e mensagem de recusa específica; backup em `backups/2026-10-28-before-extras/` | build + instalado | 280/280 | copiar `backups/2026-10-28-before-extras/app` |
| 2026-10-28 | Checkpoint 21 / **0.1.22-dev**: instalador `6eed528f…750d2`, `app.asar` `04c2bbaf…276f`, conteúdo principal + títulos no `inspect_page`; sites reais difíceis **6/6** (1–4 rodadas cada) na 3ª rodada; backup em `backups/2026-10-28-before-realsites/` | build + instalado | 280/280 | copiar `backups/2026-10-28-before-realsites/app` |
| 2026-10-28 | Checkpoint 20 / **0.1.21-dev**: instalador `bd606f71…27209c`, `app.asar` `ba103cba…c0878`, token do pipe com ACL só para o usuário (icacls por SID) e remoção no stop; backup em `backups/2026-10-28-before-pipe-acl/` | build + instalado | 273/273 | copiar `backups/2026-10-28-before-pipe-acl/app` |
| 2026-10-28 | Checkpoint 19 / **0.1.20-dev**: instalador `72648c4a…e8680`, `app.asar` `6f318904…6d92d`, `run_steps` ligado no painel (12 passos por rodada); backup em `backups/2026-10-28-before-runsteps/` | build + instalado | 269/269 | copiar `backups/2026-10-28-before-runsteps/app` |
| 2026-10-28 | Checkpoint 18 / **0.1.19-dev**: instalador `618f6d3d…b9f7`, `app.asar` `439fe807…3749`, guardião de progresso, pré-inspeção padrão, limite de ações configurável e pausa com diagnóstico; backup em `backups/2026-10-28-before-progress/` | build + instalado | 269/269 | copiar `backups/2026-10-28-before-progress/app` |
| 2026-10-28 | Checkpoint 17 / **0.1.18-dev**: instalador `c659c7a3…36da8`, `app.asar` `ab0b381c…1b9f1`, CSP nas páginas locais + `newtab.css/js` externos, extensions API e cliente WS; `npm run test:ui` PASS; backup em `backups/2026-10-28-before-csp/` | build + instalado | 261/261 | copiar `backups/2026-10-28-before-csp/app` |
| 2026-10-28 | Checkpoint 16 / **0.1.17-dev**: instalador `61a9ef50…d61eb`, `app.asar` `389b4f7c…c36868`, auditoria geral — pipe MCP autenticado, retomada com id, módulos no Guardian, batch+contrato e recursos ligados na UI; relatório em `docs/AUDITORIA_2026-10-28.md`; backup em `backups/2026-10-28-before-audit/` | build + instalado | 260/260 | copiar `backups/2026-10-28-before-audit/app` |
| 2026-10-28 | Checkpoint 15 / **0.1.16-dev**: instalador `ff3e6aae…bf7b8`, `app.asar` `b72f59d3…a411`, `sheets batch` (12 operações numa chamada), snapshot compacto no Planilhas e teto de 40 ações; backup em `backups/2026-10-28-before-sheets-batch/` | build + instalado | 253/253 | copiar `backups/2026-10-28-before-sheets-batch/app` |
| 2026-10-28 | Checkpoint 14 / **0.1.15-dev**: instalador `c9477125…bed1b`, `app.asar` `c6909e1a…df33`, painel com histórico de conversas, texto em parágrafos, retomada visível e memória do agente; motor com módulos de operação, `recipe_export`/`recipe_import`; benchmark difícil 14/14; backup em `backups/2026-10-28-before-panel-history/` | build + instalado | 249/249 | copiar `backups/2026-10-28-before-panel-history/app` |
| 2026-10-28 | Checkpoint 13 / **0.1.14-dev**: instalador `f0ad77fa…a2467`, `app.asar` `24fb5659…570d81f`, Guardian limita a recusa de upload a fluxos com URL inicial; backup em `backups/2026-10-28-before-guardian-upload/` | build + instalado | 233/233 | copiar `backups/2026-10-28-before-guardian-upload/app` |
| 2026-10-28 | Checkpoint 12 / **0.1.13-dev**: instalador `0d2ae9b6…6fc03`, `app.asar` `3e88f32c…bf6d0e`, tarefa durável + receitas via MCP + transformação isolada; backup em `backups/2026-10-28-before-durable-jobs/` | build + instalado | 233/233 | copiar `backups/2026-10-28-before-durable-jobs/app` |
| 2026-10-28 | Checkpoint 11 / **0.1.12-dev**: instalador `cf33b29d…c53f3f`, `app.asar` `aee7ee6e…ae91e21`, Guardian determinístico + cache de prefixo opt-in; backup em `backups/2026-10-28-before-guardian/` | build + instalado | 218/218 | copiar `backups/2026-10-28-before-guardian/app` |
| 2026-10-28 | Checkpoint 10 / **0.1.11-dev**: instalador `229ee406…a901e2`, `app.asar` `0d46e9db…b043a`, schema de saída por receita + `sheets` como passo determinístico; backup em `backups/2026-10-28-before-output-schema/` | build + instalado | 208/208 | copiar `backups/2026-10-28-before-output-schema/app` |

Ao adicionar um salto, acrescente a linha aqui **no mesmo commit** da mudança.

## O que um ponto de restauração precisa conter

1. Commit (ou tag) com o código exato.
2. Resultado da suíte no commit.
3. Se houve build/instalação: hash do `app.asar` e do instalador, mais o backup do app anterior.
4. O que não foi verificado, para ninguém tratar como pronto.

## Builds e instaladores

- O build instalado hoje é `0.1.14-dev` (`dist/Zero Browser Setup 0.1.14-dev.exe`, SHA-256
  `f0ad77fac5276fda5b1b97ef29608eaddab1e7cfd722c329fe4dd95a2cba2467`).
- Mudanças de motor em `src/` **não** alteram o app instalado até um novo build. Enquanto isso, o código mais novo
  só existe no repositório; o app em produção continua no build de 27/10.
- Antes de qualquer novo build: `npm test`, `npm run build`, validação do `win-unpacked` em perfil isolado, backup
  do app atual e só então instalar.

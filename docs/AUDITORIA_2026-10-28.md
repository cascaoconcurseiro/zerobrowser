# Auditoria geral — 2026-10-28 (0.1.17-dev)

Varredura completa do código: 57 arquivos JS, ~12.200 linhas em `src/`, mais `bench/` e `scripts/`.
Método: checagem de sintaxe em todos os arquivos, suíte de testes, comparação automática de canais IPC × preload,
comparação de IDs do DOM × renderer, leitura dirigida dos fluxos críticos (agente, pipe MCP, permissões do Electron,
armazenamento de credenciais, banco de histórico) e testes de regressão para cada defeito encontrado.

## Corrigidos nesta rodada

| # | Severidade | Defeito | Correção | Prova |
|---|---|---|---|---|
| 1 | crítica | `socket.destroy(new Error(...))` sem listener de `error` no pipe MCP derrubava o processo | handler de erro + `destroy()` sem argumento | `test/pipe-auth.test.js`, `test/startup.test.js` |
| 2 | alta | Pipe MCP local sem autenticação: qualquer processo local podia chamar ferramentas e dirigir o navegador | token por execução em `<dados>/automation/pipe-token` (0600), primeira linha da conexão autentica; `mcp-stdio.js` e `bench/avaliar.js` atualizados | `test/pipe-auth.test.js` (3 casos) |
| 3 | alta | “Continuar tarefa” não funcionava para pausa da mesma sessão: `listJobs()` devolvia `id: ''` | `id` gravado dentro do estado pausado | `test/audit-regressions.test.js` |
| 4 | alta | Guardian recusava `module run` sem `code` (que usa o código salvo) | só valida código quando ele veio na chamada; `save` sem código continua recusado | `test/audit-regressions.test.js` |
| 5 | alta (funcional) | Receitas, cálculo/módulos e cache de prefixo existiam no serviço, mas o painel nunca os ativava | três opções em Configurações → Agente · recursos; IPC repassa `recipes`, `transforms`, `promptCache` | leitura do fluxo + suíte |
| 6 | média | Receita com leitura dentro de `sheets batch` não alimentava `output`/`outputValid` (“nenhuma leitura”) | runner guarda a última leitura do lote | `test/audit-regressions.test.js` |
| 7 | baixa | Cartão de retomada no topo do chat ficava desatualizado após pausar/terminar | `refreshJobsBanner()` no `finally` do envio | leitura do fluxo |

Também removido um binding morto (`browserView`, id que não existe no HTML).

## Verificado e sem defeito

- **Sintaxe**: 57/57 arquivos passam `node --check`.
- **IPC × preload**: 57 handlers registrados; nenhum `invoke` órfão. Dois handlers sem uso no preload
  (`automation:list-tools`, `navegante-ext:call` — o segundo é usado pelo worker de extensões).
- **DOM**: 74 `getElementById` distintos; todos os ids existem no HTML (o único ausente era o binding morto acima).
- **Electron**: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`;
  `setWindowOpenHandler` limita a HTTP(S)/newtab; permissões passam por diálogo com o usuário.
- **Credenciais**: AES-256-GCM com chave mestra protegida por `safeStorage`; logs não imprimem chave; IPC devolve só
  a dica mascarada.
- **Banco local**: consultas com prepared statements e transação com `ROLLBACK` em erro.
- **Higiene**: nenhum `TODO/FIXME`, nenhum `forEach(async)`, nenhum `parseInt` sem base.

## Riscos conhecidos que ficaram abertos (deliberadamente)

1. **Token do pipe no Windows**: `mode 0600` é POSIX; no Windows a proteção efetiva é a ACL da pasta do perfil.
2. **Extensões**: `management.uninstall` não apaga arquivos do usuário; orienta usar ⋯ → Extensões → Remover.

Itens resolvidos em 0.1.18-dev: CSP nas duas páginas locais (com `newtab.css`/`newtab.js` externos e classes no
lugar de `style=""`), `automation:list-tools` removido, cliente WebSocket rejeitando pendências no disconnect,
`management.getAll`/`setEnabled` implementados. Verificação: `npm run test:ui` (Electron carrega as duas páginas e
falha em qualquer violação de CSP).

## Números

- `npm test`: **260/260**.
- Build `0.1.17-dev`: `app.asar` `389b4f7c…c36868`, instalador `61a9ef50…d61eb`, `status: PASS` no executável
  instalado.
- Benchmark de fumaça no build instalado: tarefas 33 e 44 passaram.
- Backup do estado anterior: `backups/2026-10-28-before-audit/`.

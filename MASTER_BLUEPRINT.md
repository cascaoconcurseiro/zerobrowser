# Master Blueprint — Navegante

## Visão geral
Navegador desktop (Electron) com agente de IA que lê a página pela árvore de acessibilidade e age com confirmação do usuário. Também pode ser controlado de fora por MCP.

## Stack
- Linguagem: JavaScript (Node.js, CommonJS)
- Framework: Electron 45, electron-builder 26 (instalador NSIS no Windows)
- Dados: electron-store (configurações e chaves, só dica mascarada na interface); `node:sqlite` para favoritos e histórico (`biblioteca.sqlite` na pasta de dados)
- Extensões: Flame (`lume-aipex/extension`) carregado por `session.extensions`, com as APIs `chrome.*` que faltam no Electron completadas por um shim
- Validação de ferramentas: zod
- Provedores de modelo: OpenRouter e DeepSeek (API estilo chat-completions)
- Testes: `node --test`

## Estrutura de diretórios
```
/
├── src/main/          processo principal, janela, abas, políticas
├── src/main/extensions/  host de extensões (shim chrome.*, painel lateral, executor do Flame)
├── src/main/library/  favoritos, histórico, sugestões e importação de outros navegadores
├── src/automation/    serviço de automação (agente, AX, MCP no pipe), catálogo de modelos
├── src/ipc/           ponte renderer ↔ main (chaves, config do agente)
├── src/preload/       API exposta à interface
├── src/renderer/      interface (painel do agente)
├── src/store/         persistência
├── scripts/           integrações e ponte stdio para MCP
├── bench/             benchmark: 20 tarefas locais, servidor, executor, resultados
└── test/              testes automatizados
```

## Decisões de arquitetura
| Data | Decisão | Motivo |
|------|---------|--------|
| 2026-10 | Rede dos provedores via `net.fetch` do Electron | Usa o repositório de certificados do Windows sem desligar TLS |
| 2026-10 | Servidor MCP JSON-RPC em pipe nomeado do Windows, caminho único por usuário/pasta de dados (`src/automation/pipe-path.js`) | Controle externo sem abrir porta de rede |
| 2026-10-25 | Ferramenta `run_task` e políticas de aprovação por aba (`ask`, `local-fixture`, `deny`) | Medir o agente sem diálogo, mantendo senha/cartão e site externo sempre recusados |
| 2026-10-25 | Benchmark local inspirado no BrowserGym (tarefa + página + verificador) | Saber a taxa de sucesso real antes e depois de cada melhoria |
| 2026-10-25 | Um perfil único `persist:navegante` para todas as abas; pop-ups viram abas com `window.opener` | Login feito numa aba vale nas outras; "Entrar com Google" volta para a aba de origem |
| 2026-10-25 | Flame hospedado como extensão sem alterar o código dele; o que falta vai em `chrome-shim-preload.js` + `extension-host.js` | Reaproveitar o Flame inteiro e comparar os dois agentes no mesmo benchmark (`--motor=flame\|navegante`) |
| 2026-10-25 | Favoritos/histórico em SQLite no formato do `chrome.bookmarks`/`chrome.history`; sessão salva a cada mudança | Serve a interface e o Flame sem conversão; abas voltam mesmo após travamento |
| 2026-10-25 | Menus de pastas de favoritos nativos e página "congelada" em imagem enquanto as sugestões estão abertas | As páginas (WebContentsView) ficam por cima do HTML da interface |

## Regras do projeto
- Ação que altera página passa por `confirmConsequentialAction`; nada contorna essa função.
- Chave de API nunca aparece em log, trace ou tela; só os 4 últimos caracteres mascarados.
- Texto digitado pelo agente não vai para o trace, só o tamanho.
- Sem commit, publicação ou instalador novo sem pedido do usuário.
- Não editar o Flame para ele funcionar no Navegante: corrigir no host/shim.
- "Limpar dados ao sair" apaga dados dos sites e histórico, mas preserva o armazenamento das extensões.

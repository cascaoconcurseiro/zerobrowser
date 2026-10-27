# Master Blueprint — Zero Browser

## Visão geral
Navegador desktop próprio, pensado para navegação humana e controle amplo e supervisionável por IA, baseado no projeto aberto Chromium. O runtime atual é Electron com Chromium embutido e permanece como ponte até a migração passar por gates de compatibilidade, segurança e benchmark. O motor de automação e suas capacidades devem ser preservados, não reescritos durante a troca da casca.

## Stack
- Runtime atual: JavaScript (Node.js, CommonJS), Electron 45, electron-builder 26 (instalador NSIS no Windows)
- Runtime de destino: fork próprio do Chromium upstream; interface nativa Zero e bridge de controle para IA ainda precisam ser provadas em protótipo
- Dados: electron-store (configurações e chaves, só dica mascarada na interface); `node:sqlite` para favoritos e histórico (`biblioteca.sqlite` na pasta de dados)
- Extensões: Flame (`lume-aipex/extension`) carregado por `session.extensions`, com as APIs `chrome.*` que faltam no Electron completadas por um shim
- Validação de ferramentas: zod
- Provedores de modelo: OpenRouter e DeepSeek (API estilo chat-completions)
- Testes: `node --test`

## Estrutura de diretórios
```
/
├── src/main/          processo principal, janela, abas, políticas, perfis, downloads
├── src/main/extensions/  host de extensões (shim chrome.*, painel lateral, executor do Flame)
├── src/main/library/  favoritos, histórico, sugestões e importação de outros navegadores
├── src/automation/    serviço de automação (agente, AX, MCP no pipe), helpers/prompt, guardas, cascata
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
| 2026-10 | Servidor MCP JSON-RPC em pipe nomeado do Windows, caminho único por usuário/pasta de dados; WebSocket de compatibilidade em loopback exige token aleatório e rejeita cabeçalho Origin | Controle local autenticado sem aceitar conexão de páginas/websites |
| 2026-10-25 | Ferramenta `run_task` e políticas de aprovação por aba (`ask`, `local-fixture`, `deny`) | Medir o agente sem diálogo, mantendo senha/cartão e site externo sempre recusados |
| 2026-10-25 | Benchmark local inspirado no BrowserGym (tarefa + página + verificador) | Saber a taxa de sucesso real antes e depois de cada melhoria |
| 2026-10-25 | Um perfil único `persist:navegante` para todas as abas; pop-ups viram abas com `window.opener` | Login feito numa aba vale nas outras; "Entrar com Google" volta para a aba de origem |
| 2026-10-25 | Flame hospedado como extensão sem alterar o código dele; o que falta vai em `chrome-shim-preload.js` + `extension-host.js` | Reaproveitar o Flame inteiro e comparar os dois agentes no mesmo benchmark (`--motor=flame\|navegante`) |
| 2026-10-25 | Favoritos/histórico em SQLite no formato do `chrome.bookmarks`/`chrome.history`; sessão salva a cada mudança | Serve a interface e o Flame sem conversão; abas voltam mesmo após travamento |
| 2026-10-25 | Menus de pastas de favoritos nativos e página "congelada" em imagem enquanto as sugestões estão abertas | As páginas (WebContentsView) ficam por cima do HTML da interface |
| 2026-10-26 | Direção de produto: Zero será um navegador próprio baseado em Chromium, unindo navegação diária completa com agente nativo; Electron permanece durante a transição | A meta de compatibilidade ampla com extensões e integração profunda de IA pede controle de navegador que o shim parcial de Electron não garante; aprovar a migração só após paridade do motor, segurança e dados |
| 2026-10-27 | Integrar a branch 0.1.5-dev por rebase + fast-forward, com 0.1.4 ainda em produção | Elimina os três fluxos paralelos e mantém histórico linear; release só depois de app, integrações Electron e benchmark |
| 2026-10-27 | Perfis como processos separados via `ZERO_USER_DATA`, sem renomear nem migrar o perfil atual | Isola dados sem tocar no perfil existente; renomear partição, pasta e `appId` exige migração e backup (Fase B) |
| 2026-10-27 | Aceitar `ZERO_*` ao lado de `NAVEGANTE_*` durante a mudança de nome | Scripts, testes e atalhos antigos continuam válidos; a identidade interna só muda com plano de migração |

## Migração arquitetural planejada
- Plano completo: `docs/PLANO_ZERO_CHROMIUM_AI.md`.
- Não começar um fork de motor de renderização do zero; acompanhar Chromium upstream e aplicar marca/interface/integração próprias.
- Separar a orquestração do agente de `webContents` por um contrato de runtime; manter adaptador Electron para comparação com o adaptador Chromium.
- Não trocar a instalação de uso diário até passar os benchmarks pareados e provar backup, importação de perfil, atualização e rollback.
- “Controle total” significa controle amplo do próprio browser sob permissões e auditoria; não significa contornar sandbox, OS, login, 2FA, CAPTCHA ou proteções de site.

## Regras do projeto
- Ação que altera página passa por `confirmConsequentialAction`; nada contorna essa função.
- Chave de API nunca aparece em log, trace ou tela; só os 4 últimos caracteres mascarados.
- Texto digitado pelo agente não vai para o trace, só o tamanho.
- Sem commit, publicação ou instalador novo sem pedido do usuário.
- Não editar o Flame para ele funcionar no Navegante: corrigir no host/shim.
- "Limpar dados ao sair" apaga dados dos sites e histórico, mas preserva o armazenamento das extensões.

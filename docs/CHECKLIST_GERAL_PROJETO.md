# Checklist Geral do Projeto — Zero Browser

Data de consolidação: `31/10/2026`
Versão atual (código e instalada): `0.1.54-dev`

Este documento consolida **tudo o que já foi entregue (`[x]`)** e **tudo o que falta (`[ ]`)** no Zero Browser, unificando `CHECKLIST.md`, `HANDOFF.md`, `docs/CHECKLIST_HISTORICO.md`, `docs/CHECKLIST_PLANOS_2026-10-31.md`, `docs/EVOLUCAO_MOTOR.md`, `docs/PLANO_MATURIDADE_4.md` e todos os planos específicos em `docs/PLANO_*.md`.

---

## 1. Base do Navegador, Segurança e Releases (`0.1.1` até `0.1.51`)

### 1.1 Arquitetura, WebContentsView e UI Base
- [x] Migração de `<webview>` para `WebContentsView` no processo principal (`src/main/main.js`) com isolamento `contextIsolation: true`, `nodeIntegration: false` e `sandbox: true`.
- [x] Múltiplas abas, criação/fechamento, navegação (`Voltar`, `Avançar`, `Recarregar`), barra de endereço com busca/URL, zoom por aba e atalhos globais (`Ctrl+T`, `Ctrl+W`, `Ctrl+L`, `Ctrl+Tab`, `F5`, `Ctrl+F`).
- [x] Busca na página (`findInPage`) embutida e responsiva.
- [x] Favoritos e Histórico persistidos em SQLite (`src/main/library-store.js`) com busca sem diferenciação de acento (`normalizeSearchText`) e paginação.
- [x] Gerenciador de Downloads persistente com retomada, abertura na pasta e limpeza.
- [x] Configurações completas persistidas em disco (buscador padrão, página inicial, privacidade, limpeza seletiva de dados, provedores de IA, modo avançado do agente).
- [x] Menu principal (`⋮`) redesenhado com ações rápidas, zoom, perfis/bots, extensões, biblioteca e configurações.
- [x] Moldura visual Aurora Boreal (`zero-aurora-pan`, `.ai-working-banner`, `setAuroraActive`) indicando quando a IA está trabalhando na aba.

### 1.2 Segurança, Cofre, Guardiões e Isolamento Local
- [x] Cofre de segredos criptografado (`src/main/secret-vault.js`) com DPAPI no Windows + AES-256-GCM e chave mestre separada; chaves de API nunca ficam em texto puro no renderer.
- [x] Guardian de privacidade e rede (`src/main/guardian.js`): bloqueio de rastreadores, cabeçalho DNT/GPC e proteção contra vazamento de metadados.
- [x] `injection-guard` (`src/automation/service/injection-guard.js`) e `exfiltration-guard` (`src/automation/service/exfiltration-guard.js`) contra prompt injection em páginas e exfiltração de dados sensíveis.
- [x] `repeat-guard` (`src/automation/service/repeat-guard.js`) contra loops infinitos do agente na mesma ação/alvo.
- [x] Servidor WebSocket loopback (`127.0.0.1`) com validação obrigatória de token por sessão e bloqueio de `Origin` externo.
- [x] Servidor MCP em pipe nomeado autenticado (`scripts/mcp-stdio.js` / `src/main/mcp-pipe.js`) com ACL restrita ao SID do usuário logado no Windows e token de sessão.
- [x] Aprovações de ações sensíveis integradas diretamente ao fluxo do chat (`0.1.50`), substituindo modais bloqueantes antigos.

### 1.3 Suporte a Extensões Chrome (MV2/MV3)
- [x] Instalação de extensões desempacotadas, por pasta/ZIP/CRX ou Chrome Web Store (`src/main/extensions.js`, `src/main/extension-store.js`).
- [x] Shim de compatibilidade MV2/MV3 (`tabs.query`, `tabs.sendMessage`, `scripting.executeScript`, `storage`, `runtime`, `action` popup) e concessão de `activeTab` apenas após gesto humano real (`0.1.41`–`0.1.45`).
- [x] Correção de escopo de variáveis no popup de extensões como Dark Reader (`0.1.49`).

### 1.4 Modo Delegar, Trilho e Central de Bots (`0.1.46` até `0.1.51`)
- [x] Modo Delegar com trilho lateral de Bots (`#delegation-rail`), avatares de pixel art (200 sprites em `pixel-animals-01` e `pixel-animals-02`) e painel lateral dedicado (`#ai-panel`).
- [x] Central de Bots responsiva em grade, com busca por nome/ID, criação de novos Bots, troca de nome, escolha de avatar e seletor de nível de autonomia (`0.1.51`).
- [x] Isolamento de Bots em processos e diretórios próprios (`ZERO_USER_DATA`), com nível inicial `always-ask`, confirmação humana para subir nível e bloqueios técnicos (credenciais, área de transferência, CDP bruto, JS livre e modo Flame).

---

## 2. Entrega Atual `0.1.52-dev` (`CHECKLIST.md` & `HANDOFF.md`)

- [x] Central de Bots substitui visualmente a conversa do `#ai-panel` enquanto está aberta (`inert = true`, `aria-hidden = 'true'`), sem sobrepor o histórico de chat ao fundo.
- [x] Central separa claramente **Bots ativos** e **Bots arquivados**, com botão `Arquivar` nos ativos (exceto o Bot em uso no momento) e `Restaurar` nos arquivados.
- [x] Coordenação de leitura/escrita em `perfis.json` (`src/main/profiles.js`) para evitar que outra janela do Zero ou de um Bot sobrescreva mudanças feitas na Central.
- [x] Painel do modo Delegar abre mais amplo por padrão (`min(480px, 34vw)`) em janelas largas, respeitando o mínimo de `320px` da página web.
- [x] Divisor vertical arrastável (`#delegation-resizer`) entre o painel do modo Delegar e a página web (mouse, toque, teclado com `ArrowLeft`/`ArrowRight`/`Home`/`End` e duplo clique para restaurar largura padrão).
- [x] Avatares dos Bots centralizam cada bichinho no quadrado (`src/renderer/app.js` / `src/renderer/styles.css`) usando a caixa real dos pixels visíveis do sprite.
- [x] Documentação atualizada (`package.json`, `README.md`, `docs/NOVIDADES.md`, `CHECKLIST.md`, `HANDOFF.md`).
- [x] Suíte de testes automatizados passando (`npm test`, `npm run test:delegation-layout`, `npm run test:ui`, `npm run test:bot-runtime`).
- [x] Gerar pacote da `0.1.52-dev` (`npm run build`) e calcular hashes SHA-256 dos artefatos.
- [x] Concluir validação da `0.1.52-dev` no executável empacotado com perfil QA isolado, fazer backup da `0.1.51` instalada (`backups/2026-10-31-before-0.1.52-install/`), criar commit local (`6e037d1`) e instalar a `0.1.52-dev` verificando o perfil normal (`Principal`, sem `ZERO_USER_DATA`).

---

## 3. Decisões Aprovadas em `31/10/2026` (`docs/CHECKLIST_PLANOS_2026-10-31.md`)

- [x] **Decisão 1 — Núcleo intocável:** A IA pode controlar todo o navegador, exceto desligar o botão "Parar tudo", desligar o firewall de intenção e recibo, desligar/apagar o log de auditoria, aprovar ações financeiras/envio externo sozinha, ler o cofre de segredos em texto puro, alterar limites de gasto de si mesma ou instalar atualização sem assinatura.
- [x] **Decisão 2 — Paridade com escopo limitado:** Sincronização entre dispositivos e app de celular ficam fora do foco atual; entram apenas os itens essenciais de `docs/PLANO_PARIDADE_E_SALTO.md`.
- [x] **Decisão 3 — Aposta principal de diferenciação:** Reversibilidade explícita (`reversível`, `parcial`, `irreversível` por padrão) e botão `Desfazer` visível.
- [x] **Decisão 4 — Conceito de Bot:** Espaço isolado criado pelo usuário (perfil próprio, memória visível/editável nunca gravada por conteúdo de página, autonomia em degraus onde subir exige confirmação humana e descer é automático, sem guardar senhas).
- [x] Incorporar os 10 documentos de plano da worktree de análise em `docs/` da pasta principal e atualizar `docs/LEIA_ME_PRIMEIRO_IA.md`.

---

## 4. Design, UX, Fluxo e UI (`docs/PLANO_DESIGN_UX.md`)

- [x] Mockup de referência do modo Delegar aprovado (`docs/conceitos/zero-browser-modo-delegar-0.1.45-dev.png` e `docs/CONCEITO_VISUAL_MODO_DELEGAR.md`).
- [x] Preservação da moldura/banner Aurora Boreal (`zero-aurora-pan`, `.ai-working-banner`, `setAuroraActive`) quando a IA trabalha na aba.
- [x] **Tokens de estado e cores (`PLANO_DESIGN_UX.md` §3 — concluído na `0.1.53-dev`):**
  - [x] Anel de estado dos avatares sem depender só de cor: combina texto acessível + formato do traço + selo + cor (`Parado`, `Trabalhando`, `Precisa de você` com `!`, `Erro` com `×`, `Pausado por você` traço duplo com `‖`).
  - [x] Respeita `prefers-reduced-motion: reduce`.
  - [x] Paleta fixa de 8 cores de destaque de Bots (`BOT_ACCENT_PALETTE`) com contraste mínimo ≥ `3:1` verificado automaticamente no tema escuro e claro (`test/bot-avatar-catalog.test.js`).
  - [x] Espaçamentos padronizados na escala de `4px` (`4, 8, 12, 16, 24, 32, 48`).
- [x] **Indicador na aba controlada e botão `Assumir` (`PLANO_DESIGN_UX.md` §4.2 — concluído na `0.1.53-dev`):**
  - [x] Destaque `.tab-controlled` na aba controlada e faixa `#tab-control-banner`: `"Aba controlada por [Nome do Bot]"` com botão `Assumir`.
  - [x] Acionar `Assumir` pausa o Bot imediatamente, muda o estado para `"Pausado — você assumiu o controle"` e exibe botão `"Devolver ao bot"`.
- [ ] **Cartão de aprovação e botão `Desfazer` (`PLANO_DESIGN_UX.md` §4.1 e §5.3):**
  - [ ] Cartão de aprovação na conversa mostrando o que vai acontecer, onde, etiqueta de reversibilidade (`Reversível`, `Parcialmente reversível`, `Não reversível`) e botões `Aprovar uma vez`, `Sempre neste site` (quando aplicável) e `Cancelar`.
  - [x] Recibo pós-ação com botão `Desfazer` visível pelo tempo em que a reversão estiver disponível (`0.1.54-dev`).
- [ ] **Fluxo de ensinar tarefa e criar Bot (`PLANO_DESIGN_UX.md` §5.2):**
  - [ ] Botão `"Ensinar"` na conversa para gravar demonstração passo a passo, gerar resumo numerado editável e oferecer `"Salvar como Bot"` ou `"Repetir agora"`.
- [ ] **Protótipo clicável e validação humana (`PLANO_DESIGN_UX.md` §6):**
  - [ ] Protótipo HTML clicável dos 3 fluxos (criar/ensinar, aprovar, assumir) validado com 5 pessoas antes de fechar o contrato de UI.
- [ ] **Barra de comando única e personalização segura (`PLANO_DESIGN_UX.md` §8 e `PLANO_NAVEGADOR_NATIVO_IA.md`):**
  - [x] Barra de comando única (`Ctrl+K`) por intenção em português claro (`0.1.54-dev`).
  - [ ] Comandos declarativos `ui.*` versionados (com botão `"Voltar layout anterior"` e `"Modo seguro de visual"`), mantendo o núcleo intocável sempre visível e fixo.
- [ ] **Revisão de acessibilidade e demais telas (`PLANO_DESIGN_UX.md` §7):**
  - [ ] Testar navegação completa por teclado (`Tab`, `Shift+Tab`, `Enter`, `Escape`), foco visível (`2px`), leitor de tela (NVDA) e zoom `125%`/`150%` na Central, Configurações, Biblioteca e Menu `⋮`.

---

## 5. Motor do Agente: Velocidade, Tokens e Custo (`docs/EVOLUCAO_MOTOR.md` & `docs/PLANO_MOTOR.md`)

### 5.1 Módulos já implementados no código (`0.1.33`–`0.1.45`)
- [x] Extração de `runAgent` para `src/automation/service/agent-runtime.js` sem depender do Electron.
- [x] Provedores configuráveis: OpenRouter, DeepSeek direto, OpenAI direto (com filtro de modelos de chat e temperatura condicional) e Ollama local opt-in.
- [x] `observeAfterActions` (padrão ativo): observa o estado após cada passo para evitar clique cego.
- [x] `preInspect` (`src/automation/service/pre-inspect.js`): pré-inspeção antes da 1ª chamada à IA (economia medida em mock: `-50%` chamadas e `-48,9%` caracteres enviados).
- [x] `run_steps` com pós-condições (`urlIncludes`, `textIncludes`, `selectorExists`, `TargetMismatch`).
- [x] `snapshot-diff` (`src/automation/service/snapshot-diff.js`): envia apenas diferenças quando a página mudou pouco (`-19,2%` caracteres em mock).
- [x] `model-cascade` (`src/automation/service/model-cascade.js`): modelo econômico por padrão, escalando para modelo forte apenas em falha/repetição/página densa (`-75%` chamadas ao modelo forte em mock).
- [x] `stream-parser` (`src/automation/service/stream-parser.js`), `deduplicate-snapshots` (`-31,8%` caracteres em mock), espera pós-hover adaptativa (`-81%` espera em páginas estáveis), ferramenta `calculate` local e `repeat-guard`.
- [x] Ferramentas avançadas sob demanda (`advancedInput: 'auto'` em `src/automation/service/tool-selection.js`, `-19%` no prompt inicial) e telemetria real de custo/cache (`usage.cost`, `cachedTokens`, `promptCache`).

### 5.2 Validação em Provedor Real e Próximas Etapas (`docs/PLANO_MOTOR.md`)
- [ ] **Etapa 0 — Linha de base congelada:** rodar `scripts/benchmark-motor.js` com provedor real nas 7 tarefas representativas (3 repetições por tarefa) quando orçamento for autorizado, salvando em `docs/benchmarks/`.
- [ ] **Etapa 1 — A/B de Scripts de Site (`--scripts`):** medir ganho real em tarefas com receita conhecida e validar fallback quando seletor falha.
- [ ] **Etapa 2 — A/B de `preInspect` em produção:** confirmar redução ≥ 15% de tokens sem queda de sucesso para mantê-lo ativo por padrão em chamadas reais.
- [ ] **Etapa 3 — Cache de prefixo (`promptCache`):** validar `cached_tokens > 0` a partir do 2º turno no provedor real e redução ≥ 25% no custo de entrada.
- [ ] **Etapa 4 — Seletor de ferramentas avançadas:** confirmar nos 7 cenários reais que nenhuma tarefa falha por falta de ferramenta.
- [ ] **Etapa 5 — Decomposição de tempo:** separar no relatório `tempo_modelo_ms`, `tempo_navegador_ms`, `tempo_espera_fixa_ms` e `tempo_rede_site_ms`, atacando o maior gargalo.
- [ ] **Etapa 6 — Comparação de modelos e cascata real:** comparar 3 modelos reais + modo `--cascade` (meta: cortar custo por tarefa em pelo menos 40% mantendo taxa de sucesso).

---

## 6. Bots Autoexecutáveis (`docs/PLANO_BOTS.md`)

- [x] Espaços de Bots isolados por processo/diretório, criação/edição/arquivamento na Central e bloqueios de segurança da Fase 1.
- [ ] **Fase 1 (restante) — Ficha do Bot e Executor Manual Somente Leitura:**
  - [ ] `src/bots/bot-store.js`: persistência de Bots de tarefas (nome, objetivo, sites permitidos, ferramentas permitidas, limites de passos/tempo/gasto, agendamento, histórico).
  - [ ] `src/bots/runner.js`: execução manual ("Rodar agora") em aba oculta (`show: false`), somente leitura (`snapshot`, `extract_table`, `Wait`), salvando resumo e log de passos.
  - [ ] Botão `"Parar todos os Bots"` encerrando execuções em menos de 1 segundo.
- [ ] **Fase 2 — Agendamento e Bandeja do Sistema:**
  - [ ] `src/bots/scheduler.js`: agendamento por horário fixo ou intervalo (`a cada X horas`), despertar após suspensão do Windows e opção `"Iniciar com o Windows na bandeja"`.
  - [ ] Notificação nativa do Windows quando o Bot encontra mudança relevante.
- [ ] **Fase 3 — Modelos Prontos (1 clique):**
  - [ ] Modelo `"Pesquisador de preços"` (monitora URL, extrai preço, grava histórico e avisa se baixar da meta).
  - [ ] Modelo `"Preço de ação / ativo"` (consulta cotação e alerta variação).
- [ ] **Fase 4 — Aprender por Demonstração ("Ensinar uma tarefa"):**
  - [ ] `src/bots/recorder.js`: grava cliques, campos e seleção final de elemento da demonstração do usuário e converte em roteiro estruturado do Bot.
- [ ] **Fase 5 — Ações com Escrita sob Aprovação e Exclusão Segura:**
  - [ ] Fila de aprovação humana para qualquer passo de escrita antes de executar na página.
  - [ ] Detecção de processos de Bots ativos na Central e exclusão permanente segura de Bot arquivado (com dupla confirmação e remoção do diretório isolado).

---

## 7. Controle Total por IA e Servidor MCP (`docs/PLANO_CONTROLE_TOTAL_IA.md`)

- [x] Servidor MCP em pipe nomeado autenticado (`scripts/mcp-stdio.js`) com 22 ferramentas inventariadas e testadas em fixture (`npm run test:bot-runtime`).
- [ ] **Fase 1 — Contrato Comparativo:** tabela completa `docs/MCP_TOOLS_COMPARATIVO.md` cruzando Playwright MCP, Chrome DevTools MCP e Zero MCP.
- [ ] **Fase 2 — Pareamento, Níveis de Permissão e Auditoria:**
  - [ ] Tela de pareamento por cliente externo com nome, nível (*Apenas observar*, *Interagir em abas*, *Desenvolvedor*, *Controle total*), validade (`1 sessão`, `7 dias`, `30 dias`) e revogação em 1 clique.
  - [ ] Indicador visível quando cliente externo controla o Zero + log de auditoria em disco.
- [ ] **Fase 3 — Ferramentas de Alto Nível (Leitura e Diagnóstico):**
  - [ ] `console_messages`, `page_errors`, `network_requests`, `network_request_detail` (com redação de `Authorization`/`Cookie` salvo nível *Controle total*), `performance_trace`, `storage_cookies` e `storage_local`.
- [ ] **Fase 4 — Ferramentas de Interação Completa:**
  - [ ] `emulate_device`, `emulate_network`, `handle_dialog`, `file_upload`, `pdf_save` e suporte a `frameId` (`iframes`) nas ferramentas de leitura/interação.
- [ ] **Fase 5 — Controle do Próprio Navegador via MCP:**
  - [ ] Ferramentas MCP para listar/criar/trocar perfis, ler/alterar configurações não sensíveis, consultar histórico/favoritos/downloads e acionar Bots.
- [ ] **Fase 6 — Servidor HTTP Local e Porta CDP:**
  - [ ] Servidor HTTP opcional em `127.0.0.1` com `Authorization: Bearer <token>` expondo as mesmas ferramentas MCP e endpoint `/cdp/info` para clientes Playwright/Puppeteer no nível *Controle total*.
- [ ] **Fase 7 — Documentação e Exemplos:** `docs/COMO_CONECTAR_IA_EXTERNA.md` e scripts de exemplo em `examples/`.

---

## 8. Navegador Nativo para IA (`docs/PLANO_NAVEGADOR_NATIVO_IA.md`)

- [x] Decisão do núcleo intocável aprovada.
- [x] **Fase 0 — Inventário:** `docs/CATALOGO_COMANDOS_NAVEGADOR.md` listando todas as ações de abas, navegação, histórico, favoritos, downloads, extensões, perfis, bots, configurações e janelas (`0.1.54-dev`).
- [x] **Fase 1 — Registro Único de Comandos:** `src/main/command-registry.js` com `id`, `nivel` (`leitura`, `reversivel`, `sensivel`, `bloqueado`), `desfazer`, `executar` e `auditar` (`0.1.54-dev`).
- [ ] **Fase 2 — Migrar UI para o Registro:** cliques de botão, atalhos, barra `Ctrl+K`, chat interno e MCP passam pelo mesmo registro.
- [ ] **Fase 3 — Expor todos os comandos no MCP** respeitando os níveis de pareamento.
- [ ] **Fase 4 — Conectores Nativos de Serviço (`src/connectors/`):**
  - [ ] Fase 4a (somente leitura): Gmail/IMAP, Google Calendar/ICS, Google Drive/arquivos locais, Notion, GitHub.
  - [ ] Fase 4b (escrita com rascunho e aprovação): enviar e-mail, criar evento, criar issue/PR, postar mensagem.
- [ ] **Fase 5 — Zero como Cliente MCP:** conectar servidores MCP externos (arquivos locais, SQLite/Postgres, Git) para uso pelo agente interno e Bots.
- [ ] **Fase 6 — Ponte com Mensageria (Telegram):** bot opcional pareado ao `chat_id` do dono para comandar Bots e receber aprovações à distância.
- [ ] **Fase 7 — Extensões do Zero e Personalização pela IA:** formato declarativo de plugins (`.json` + `.js` restrito) e comandos `ui.*` com histórico de versões e Modo Seguro.

---

## 9. Rotas Aprendidas, Firewall de Intenção, Apps Vivos e Paridade/Salto

### 9.1 Rotas Aprendidas (`docs/PLANO_ROTAS_E_FIREWALL.md` Parte A)
- [ ] **Fase 0 — Experimento:** testar em 5 sites reais se chamada direta de API da sessão é ≥ 3x mais rápida e gasta ≥ 70% menos tokens que repetir cliques com IA.
- [ ] **Fase 1 — Observador de Rede:** capturar chamadas `fetch`/`XHR` durante tarefa guiada, removendo valores de credenciais.
- [ ] **Fase 2 — Compilador de Rota:** transformar chamadas em receita parametrizada (`dominio`, `intencao`, `metodo`, `url`, `parametros`, `tipoEfeito`, `reversivel`).
- [ ] **Fase 3 — Executor com Fallback:** rodar rota aprendida na sessão da aba e voltar para navegação visual se retornar `401/403/404/5xx` ou mudar formato.
- [ ] **Fase 4 — Suporte a WebMCP:** consumir ferramentas declaradas pela própria página, passando pelo firewall de intenção.

### 9.2 Firewall de Intenção e Recibo (`docs/PLANO_ROTAS_E_FIREWALL.md` Parte B)
- [x] `injection-guard` e `exfiltration-guard` iniciais em operação no runtime.
- [ ] **Fase 1 — Suíte de 50+ Ataques:** fixtures cobrindo 5 famílias (texto oculto, imitação de sistema, exfiltração por URL/form, troca de destinatário/valor, redirecionamento para domínio terceiro).
- [ ] **Fase 2 — Etiquetas de Origem:** separar estruturalmente `origem: "usuario"` de `origem: "externo"` até o momento de executar cada ferramenta.
- [ ] **Fase 3 — Política de Efeitos:** bloquear envio de dados para domínio novo, submissão de form e escrita cruzada quando originados de conteúdo externo sem confirmação humana.
- [ ] **Fase 4 — Recibo Verificado:** gerar recibo estruturado antes de ações sensíveis (ação, site, campos alterados, reversibilidade) e gravar no log de auditoria.

### 9.3 Reversibilidade, Autonomia Conquistada e Paridade Essencial (`docs/PLANO_PARIDADE_E_SALTO.md` & `docs/PLANO_MATURIDADE_4.md`)
- [x] **Salto 1 — Reversibilidade e `Desfazer`:** campo `reversibilidade` obrigatório em toda ferramenta de escrita + executor de sequência de compensação validado em 5 fixtures (`test/command-registry.test.js`, `0.1.54-dev`).
- [ ] **Salto 2 — Autonomia Conquistada:** promoção gradual por tarefa e site após N execuções aprovadas sem erro, rebaixamento automático na 1ª falha e painel `"Confiança"`.
- [ ] **Salto 3 — Ensaio em Gêmeo Local:** simular ações irreversíveis em cópia local da página antes de apresentar o recibo de aprovação.
- [ ] **Paridade Essencial:**
  - [ ] Importador de favoritos (HTML/Chrome/Edge) e senhas (CSV para o cofre criptografado, apagando o CSV temporário).
  - [ ] Bloqueador de anúncios e rastreadores por listas públicas (EasyList/EasyPrivacy) integrado ao Guardian com contador por página e exceção por site.
  - [ ] Leitor de PDF com ação `"Perguntar sobre este PDF"` enviando texto selecionado/página ao painel da IA.
  - [ ] Divisão de tela (2 abas lado a lado na mesma janela) para comparação assistida pela IA.
  - [ ] Atualização assinada com verificação de hash SHA-512, assinatura digital e rollback automático (`docs/PLANO_ATUALIZACAO_ASSINADA.md`).

### 9.4 Apps Vivos (`docs/PLANO_APPS_VIVOS.md`)
- [ ] **Fase 0 — Protótipo Manual:** painel `"Meus vencimentos da semana"` em HTML local juntando 3 fontes para validar utilidade diária.
- [ ] **Fase 1 — Formato de App Vivo:** manifesto `app.json` + armazenamento SQLite próprio + visualização HTML sem acesso direto à rede.
- [ ] **Fase 2 — Coleta via Rotas/Bots:** atualizar tabelas do App Vivo usando rotas aprendidas ou Bots somente leitura.
- [ ] **Fase 3 — Criação por Conversa:** gerar `app.json` e visualização a partir do pedido do usuário após aprovar as fontes.
- [ ] **Fase 4 — Ações a partir do App Vivo:** botões de ação no painel passando pelo firewall de intenção e recibo de aprovação.


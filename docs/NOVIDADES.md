# Novidades — Zero Browser 0.1.78-dev

## 0.1.78-dev — Bots na barra lateral e nas Configurações

- **Lateral:** três seções fixas: Bots, Histórico e Configurações. Os bots que você criou aparecem como avatares e "Parar tudo" fica sempre visível (desabilitado quando não há tarefa).
- **Painel Bots:** lista "Seus bots" com estado (trabalhando ou pronto). O botão "+ Criar bot" fica no topo.
- **Central de Bots:** saiu da barra superior e agora fica em Configurações > Bots, junto dos perfis.
- **Textos:** rótulos menores que 11px foram aumentados e o contraste do texto secundário ficou mais forte. Termos como "ordem" e "agente" saíram do primeiro nível.
- **Remoções:** a lista de modelos prontos e os cartões de exemplo ("Apps locais", "Conexões indisponíveis") não aparecem mais.

## 0.1.77-dev — Painel Bots mais simples

- **Conversa e Detalhes:** o painel tem duas abas por bot. Agenda, Memória, Rotas e Histórico ficam dentro de Detalhes.
- **Aviso de privacidade e linha de rota:** voltam a aparecer na conversa.
- **Textos:** o cabeçalho diz Bots e a caixa de texto pergunta o que o bot deve fazer.

## 0.1.76-dev — Correção de inicialização

- **Início do app:** removida uma chamada a uma função que não existia mais, que interrompia a inicialização antes de atualizar o aviso de tarefas.

## 0.1.75-dev — Central de Bots abre a conversa

- **Central de Bots:** clicar na linha de um Bot abre a conversa dele no painel Delegar.
- **Janela:** cada Bot ativo (que não está aberto nesta janela) tem o botão "Janela" para abrir o perfil em janela própria.

## 0.1.74-dev — Clicar no bot abre a conversa

- **Lateral de bots:** clicar em um bot abre a conversa dele no painel Delegar, em vez de abrir uma janela nova.

## 0.1.73-dev — ## 0.1.73-dev — Abas do Bot de volta à Conversa

- **Agenda, Memória, Rotas e Histórico** voltam à linha de abas da Conversa, como antes.

## 0.1.72-dev — ## 0.1.72-dev — Escolha de mascote e Conversa mais enxuta

- **Mascote na criação:** a tela de criar Bot especialista tem a etapa 3, com os 40 mascotes em grade. Começa com o mascote da especialidade e você troca clicando. A escolha fica salva no Bot e aparece no selo da aba.
- **Conversa mais enxuta:** a aba Conversa do painel Delegar oculta a linha de roteamento, o aviso de privacidade repetido, os botões duplicados do cartão do Bot e a explicação de modos. Agenda, Memória, Rotas e Histórico saíram dessa tela.

## 0.1.71-dev — ## 0.1.71-dev — Mascote em todos os bots

- **Lateral de bots com mascotes:** todo bot aparece com seu mascote pixel art fixo; os ícones genéricos (lupa, carrinho, envelope) saíram. Bots sem número de avatar recebem um mascote derivado do id, sempre o mesmo.

## 0.1.70-dev — ## 0.1.70-dev — Painel Bots com abas, 9 especialistas e mascotes

- **Painel Delegar com duas abas:** "Bots" (padrão) lista os bots com busca, acesso rápido, filtros e favoritos; "Conversa" mostra o chat normal. Clicar em um bot abre a conversa com ele.
- **9 especialistas prontos:** Monitor de preço, Pesquisador, Analista de Dados, Operador ERP, Redator, Assistente Pessoal, Planejador, Resumo de e-mail e Conferir pedidos. Cada um tem permissão definida (Só ler, Rascunho ou Com aprovação). A lista vem de uma única fonte (`src/bots/bot-store.js`).
- **Mascotes:** cada bot usa um mascote pixel art fixo (40 opções em `assets/bots/mascotes/`).
- **Paleta azul:** a cor de ação saiu do verde e passou para azul (#0254EC no tema claro).
- **Textos e ícones:** "GrokBot" saiu dos textos visíveis; emojis de cadeado, carrinho, pasta e relógio foram trocados por ícones SVG.
- **Favoritos:** ficam guardados neste computador (não são sincronizados).

## 0.1.69-dev — Bots autoexecutáveis em 2º plano, isolamento e honestidade

- **O Bot executa a missão pelo agente (A1/A2):** o executor do Bot conecta passos e missões em texto livre diretamente ao agente (`src/bots/agent-executor.js`) em aba oculta, sem roubar foco da navegação do usuário e com encerramento limpo ao terminar, falhar ou cancelar.
- **Perfil isolado e política de site (A3):** cada Bot ganha uma partição de sessão isolada (`persist:navegante-bot-<id>`). A guarda de rede (`src/bots/bot-site-guard.js`) intercepta o tráfego e cancela URLs fora da allowlist autorizada. O agente opera com `isolatedTabs: true`, sem visibilidade ou interferência nas abas do usuário.
- **Agenda persistente e fuso local (A4):** o agendador (`src/bots/scheduler.js`) opera em fuso horário local e grava `lastRunAt` em `bot-tasks.json`, impedindo execuções duplicadas ao reabrir o navegador.
- **Segundo plano real e medição minimizada (A5):** bandeja do sistema nativa (Tray) com menu ("Abrir Zero Browser", "Parar tudo", "Sair"), opção de fechar para a bandeja e suporte a suspensão do PC (`powerMonitor`). Medição real com janela minimizada comprovando taxa de 10,0 ticks/s sem estrangulamento (`setBackgroundThrottling(false)`).
- **Avisos e recibos auditáveis na tela (A6):** toasts informativos na interface e cartões de recibo auditáveis (`ai-receipt-card`) na conversa e histórico para cada ação do Bot.
- **Honestidade de dados (E1):** métricas simuladas foram removidas de `src/main/main.js` (ataques de firewall nulos com ponteiro para a fixture de benchmark de 50 ataques; rotas de exemplo zeradas com `isExample: true`; valores em apps ao vivo rotulados como exemplo).
- **Cobertura completa:** 450 testes unitários passando (`npm test`) e testes de integração de background, UI, bot-runtime e layout passando 100%.

## 0.1.68-dev — Orquestrador no modo Delegar

- Pedidos claros de preço, mercado e e-mail recebem uma sugestão local de perfil especialista; pedidos comuns, mistos ou sem perfil salvo ficam com o agente geral.
- O compositor mostra a rota e permite corrigir a sugestão. A classificação não faz chamada extra ao provedor.
- O envio principal aplica a orientação local do perfil especialista e informa que execução, aba e login continuam no agente geral e no perfil atual. Não há runtime autônomo por Bot nesta fatia.
- O envio em 2º plano não seleciona um Bot automaticamente quando o pedido não corresponde a uma especialidade.
- Suíte cobre classificação, ambiguidades, UI da rota e layout.

## 0.1.67-dev — Identidade dos Bots e continuidade de dados

- Perfis de Bot agora usam símbolos lineares individuais dentro de anéis coloridos. A associação deriva do identificador estável do avatar.
- A interface deixou de carregar as folhas de retratos pixelados; o símbolo centraliza pelo layout e tem movimento discreto durante trabalho, respeitando redução de movimento.
- Atualizações continuam usando o perfil `navegante` e a partição `persist:navegante`. Chaves, sessão Google/Gmail e demais dados não são copiados para pastas por versão; builds de QA seguem isoladas.
- A suíte verifica a estabilidade da identidade visual e os identificadores que preservam dados entre versões.

## 0.1.66-dev — Legibilidade do painel de Bots

- Cartões de orientação “Enviar” e “Em 2º plano” usam as cores de texto do tema com contraste mínimo verificado de 4,5:1.
- Em janelas estreitas, as orientações ficam em uma coluna para preservar leitura.
- Ainda não é uma reformulação visual completa do Zero Browser.

## 0.1.65-dev — Bots e Central mais honestos

- A Central separa perfis de navegação de tarefas especialistas e mostra a quantidade de perfis reais, sem contar imagens do catálogo como Bots.
- A Central descarta atualizações assíncronas antigas, evitando duplicar ou reintroduzir seções depois de uma atualização mais recente.
- Apps locais de demonstração e autorização simulada do Telegram não aparecem como serviços conectados.
- O painel de detalhes deixou de exibir tempos, percentuais e resultados de ataques fixos como se fossem métricas desta execução.
- Tarefas em segundo plano informam que usam o perfil de navegação atual. Cancelamento pedido, cancelamento confirmado, pausa por limite e fim da execução são estados distintos.
- A suíte da interface usa uma sessão temporária limpa e valida que a UI apresenta a resposta do motor sem fabricar passos, aprovação ou tarefa verificada.
- Ainda não há isolamento do perfil por tarefa especialista, executor real de agenda, conectores externos funcionais nem limite de gasto aplicado por Bot.

## Conceito Visual Completo das 5 Imagens de Referência + Motor, MCP, Firewall e Personalização GrokBot — 0.1.63-dev — 31/10/2026

- **Alinhamento Visual e Funcional às 5 Imagens de Conceito (`src/renderer/index.html`, `src/renderer/styles.css`, `src/renderer/app.js`):**
  - **Barra Superior (`#toolbar`):** botão vermelho pílula **`Parar tudo`** (`#btn-stop-task`) visível ao lado de **`Central`** (`#btn-bot-central`) no modo Delegar em telas desktop, acionando `stopAll` (< 1 s).
  - **Cabeçalho do Bot Ativo (`#grokbot-briefing-bar`):** anel circular colorido `38x38px` com ícone geométrico, título da especialidade (**`Preços`**), pílula verde **`● Trabalhando` / `● Pronto`** (`#grokbot-active-status`) e descrição da missão.
  - **Banner de Controle da Aba (`#tab-control-banner`):** faixa verde-menta **`Navegador controlado por Preços`** com selo circular `🛒` e botão **`Assumir`**.
  - **Linha do Tempo Vertical Conectada (`.grokbot-stepper`):** passos encadeados com círculos verdes de check (`✓`) e horários (`10:21 Abrindo loja` → `10:22 Comparando preços` → `10:23 Preparando resumo`).
  - **Faixa Verde de Ação Recente com Desfazer (`.grokbot-inline-receipt`):** exibe a última ação (`Filtro aplicado: até R$ 150 · 10:22`) com botão pílula **`↺ Desfazer`** imediato.
  - **Cartão Rico `Confirmar envio?` / `Confirmar compra?` (`.grokbot-confirm-card`):** prévia estruturada (`Para`, `Assunto`, `Mensagem`, destaque de produto `★ 4,7 · R$ 129,90`) e botões **`✓ Aprovar`** e **`✕ Recusar`** que geram recibo SHA-256.
  - **Gaveta `</> Técnico` (`.grokbot-tech-drawer`):** exibe ao vivo a decomposição do motor (`tempo_modelo_ms`, `tempo_navegador_ms`, `tempo_espera_fixa_ms`), orçamento de bytes (`-27,3%`), status do Controle Total MCP/CDP (`127.0.0.1 Bearer`), Firewall de Intenção (`50/50`) e botões de **Personalização Visual (`Visual Claro (Conceito)`, `Visual Escuro`, `Modo Seguro Visual`)**.
  - **IA e Segurança em Cartões (`#ai-provider-cards`):** cartões selecionáveis para `OpenAI`, `OpenRouter`, `DeepSeek` e `Ollama` + selo azul **`🔒 Credenciais ficam no perfil isolado`**.

## Experiência Completa GrokBot na Interface: Barra do Especialista Ativo, 5 Abas Operacionais, Mandatos, Rotas, Gêmeo Local, Apps Vivos e Conectores — 0.1.62-dev — 31/10/2026

- **Cabeçalho GrokBot do Bot Especialista Ativo (`#grokbot-briefing-bar` em `src/renderer/index.html`, `src/renderer/app.js`, `src/renderer/styles.css`):** mostra permanentemente o anel geométrico e cor do Bot Especialista ativo (`#grokbot-active-ring`), nome (`#grokbot-active-name`), especialidade + degrau de autonomia + modo de execução (`#grokbot-active-meta`) e botões de 1 clique **`2º plano`** (`#btn-grokbot-run-bg`, que roda o Bot na aba de segundo plano e traz a aba automaticamente para a frente ao atingir a meta) e **`Gravar`** (`#btn-grokbot-teach-quick`, gravador interativo `TeachTaskRecorder`).
- **5 Abas Operacionais Completas no Painel do Bot (`#bot-panel-tabs`):**
  1. **`Conversa`:** conversa com o Bot Especialista + gravador **"Ensinar tarefa por demonstração"** (`bots:teach:start`, `bots:teach:record-event`, `bots:teach:stop`, `bots:teach:save-as-bot`) e botão **`Ensaiar no Gêmeo Local`**.
  2. **`Agenda`:** rotinas agendadas por horário + **Gatilhos por Evento** (`price-below-target`, `page-changed`, `new-email` via `bots:register-trigger`) + **Mandato Delegado com Envelope** (ação autorizada, teto em R$, prazo e limite de usos via `bots:create-mandate`) + **Execução com Zero Fechado** (`bots:windows-task-spec` gerando comando auditável `schtasks` do Windows).
  3. **`Memória`:** **Escada de Autonomia Conquistada (`Degrau 1 → 2 → 3`)** com promoção confirmada pelo usuário (`bots:promote-autonomy`) + **"O que este Bot sabe"** protegido pelo Firewall de Intenção (`bots:add-memory`).
  4. **`Rotas`:** ordem de preferência GrokBot (`1. WebMCP → 2. Rota HTTP Aprendida → 3. Receita Determinística → 4. Interface Visual`), captura de rota da aba ativa (`routes:capture-current`), ensaio em **Gêmeo Local (`LocalTwinSandbox` via `routes:rehearse-twin`)** e biblioteca de **Rotas Aprendidas (`LearnedRouteLibrary`)** com ativação/pausa.
  5. **`Histórico`:** recibos verificados com hash SHA-256 (`receiptHash`), duração em `ms`, economia sem modelo (`0 tokens`), compensação **`Desfazer`** e exportação JSON.
- **Central de Comando GrokBot (`#bot-central`):** além dos perfis isolados, exibe os cartões interativos de **Bots Especialistas GrokBot** (pré-semeados com *Bot Caçador de Preços*, *Bot Radar de Mercado* e *Bot Triagem Executiva*), **Apps Vivos do Navegador** (*Painel de Vencimentos da Semana* + gerador de App Vivo por conversa), **Conectores Nativos (`Gmail/Outlook`, `Google Agenda`, `Drive`, `Notion`, `GitHub`, `Slack`) & Ponte Telegram** e **Firewall de Intenção 50/50 + Parar todos os Bots**.

## GrokBot dos Navegadores: Bots Especialistas + Execução em 2º Plano com Auto-Foreground e Integração IPC — 0.1.61-dev — 31/10/2026

- **Criador de Bot Especialista (`#bot-specialist-modal` em `src/renderer/index.html`, `src/renderer/app.js`, `src/renderer/styles.css`):** ao clicar em `+ Criar Bot` na barra lateral ou na Central, o usuário escolhe entre 6 especialidades prontas (`Pesquisador de Preços`, `Radar Financeiro e Ações`, `Triagem de E-mail e Agenda`, `Operador de Trabalho e ERP`, `Vigia de Editais, Vagas e Estoque` e `Especialista Personalizado`).
- **Dois Modos de Execução de Aba (`EXECUTION_MODES` em `src/bots/bot-store.js` e `src/bots/runner.js`):**
  1. **Trabalhar em 2º plano e trazer para frente (`background-auto-foreground`, padrão GrokBot):** cria uma aba silenciosa exclusiva do Bot identificada com a cor e o selo dele (`.tab-bot-badge`) sem roubar o foco da aba atual do usuário. Assim que o Bot **atinge a meta (`goal_reached`)**, **pede aprovação de escrita (`approval_needed`)** ou **encontra verificação humana/CAPTCHA (`human_intervention`)**, o Zero Browser traz automaticamente a aba do Bot para a frente (`bringSpecialistBotToFront`), destaca a aba (`.tab-bot-attention`) e abre o painel com o motivo.
  2. **Aba exclusiva visível agora (`dedicated-tab`):** abre e foca imediatamente a aba dedicada do Bot Especialista para acompanhamento ao vivo.
- **Integração IPC Completa no Processo Principal (`src/main/main.js` e `src/preload/preload.js`):** `bots:get-presets`, `bots:list-tasks`, `bots:create-task`, `bots:run-now`, `bots:stop-all`, `bots:run-missed-schedules`, `bots:attention`, `live-apps:list` e `live-apps:create-weekly-due` conectados fim a fim.

## Conclusão de Design/UX, Decomposição do Motor, Controle Total MCP (Fases 4–6) e Paridade — 0.1.60-dev — 31/10/2026

- **Design e UX do navegador completo (`src/renderer/index.html`, `src/renderer/app.js`, `src/renderer/styles.css`, `src/main/bot-avatar-catalog.js`):** 24 símbolos de traço (`BOT_STROKE_SYMBOLS`), iniciais de 2 letras (`formatBotInitials`), sugestão sem repetição de par símbolo+cor (`suggestNextFreeBotIdentity`), abas internas do painel do Bot (`Conversa`, `Agenda`, `Memória`, `Histórico` com exportação JSON de recibos), itens `Central de Bots`, `Dividir tela` e `Perguntar sobre PDF` no menu `⋮`, seções `Bots`, `Clientes de IA` e `Limites de gasto` (`tabular-nums`) em Configurações, galeria dos 3 modelos prontos na Central e moldura com `--active-bot-accent`.
- **Decomposição do Motor e Orçamento de Bytes (`src/automation/service/time-decomposition.js`):** separação de `tempo_modelo_ms`, `tempo_navegador_ms`, `tempo_espera_fixa_ms` e `tempo_rede_site_ms` (`decomposeRunTiming`) e verificador de estabilidade de prefixo e orçamento de bytes (`verifyPromptPrefixStabilityAndByteBudget`).
- **Controle Total por IA Fases 4, 5 e 6 (`src/automation/mcp-diagnostics.js`, `src/automation/mcp-http-server.js`):** ferramentas de página (`cookies_storage` com redação de `httpOnly`/sessão, `emulate_device`, `emulate_network`, `handle_dialog`, `file_upload`, `pdf_export`, `accessibility_tree`, `drag_and_drop`, `press_key`, `iframe_select`), ferramentas do navegador restritas ao nível `total` (`browser_history`, `browser_bookmarks`, `browser_downloads`, `browser_settings`, `browser_profiles`, `browser_extensions`, `browser_tab_groups`) e servidor HTTP/CDP loopback (`127.0.0.1`) com `Authorization: Bearer <token>` (`/mcp` e `/cdp/info`).
- **Cobertura de Comandos da UI, Bloqueador de Rastreadores e Relatórios Públicos:** `verifyUiCommandCoverage` em `src/main/command-registry.js`, `AdTrackerListFilter` e `PdfQuestionBridge` em `src/main/parity-essentials.js`, `docs/COMPATIBILIDADE_EXTENSOES_CHROME.md` e `docs/PLANO_ROTAS_E_FIREWALL.md`.

## Bots Fases 2–5 (scheduler, modelos, gravador Ensinar) e comandos visuais versionados — 0.1.57-dev — 31/10/2026

- Agendador de Bots (`src/bots/scheduler.js`) com intervalo, horário diário e dia do mês, execução única de tarefa perdida ao iniciar (`runMissedSchedulesOnce`) e pausa automática de Bots sem verificação por 14 dias (`pauseStaleBots`).
- Modelos prontos (`src/bots/templates.js`): Pesquisador de preços (com confirmação humana obrigatória do produto na 1ª execução, medição de taxa sem modelo e alerta de preço-alvo/mínimo histórico) e Preço de ação/ativo somente leitura.
- Gravador `"Ensinar uma tarefa"` (`src/bots/recorder.js` e botão `Ensinar` em `src/renderer/index.html` / `src/renderer/app.js`) que omite senhas, gera resumo numerado editável, salva como Bot e enfileira aprovação humana para passos de escrita.
- Personalização visual versionada (`src/main/ui-customizer.js`) com `rollbackPreviousLayout`, `enterSafeMode` (`Modo seguro de visual`) e proteção estrita do núcleo intocável, mais protótipo HTML clicável dos 3 fluxos (`docs/prototipos/fluxos-delegar-prototipo.html`).

## Bots Fase 1 (store, runner, Parar tudo < 1s) e MCP comparativo/diagnóstico — 0.1.56-dev — 31/10/2026

- Ficha persistente de Bots (`src/bots/bot-store.js`) com limites de passos/tempo/gasto, proteção da memória contra conteúdo externo, autonomia em degraus e exportação/importação sem segredos.
- Executor em segundo plano (`src/bots/runner.js`) em modo somente leitura por padrão, bloqueando ações consequentes, gravando comprovante SHA-256 (`receiptHash`) no histórico e parando todos os Bots em menos de 1 segundo (`stopAllBots`).
- Contrato comparativo MCP (`docs/COMO_CONECTAR_IA_EXTERNA.md`) e registro de permissões/diagnóstico (`src/automation/mcp-diagnostics.js`) com níveis `observar`, `interagir`, `desenvolvedor` e `total`, revogação individual e ferramentas `console_messages`, `page_errors` e `network_requests` com redação automática de segredos.

## Firewall de Intenção, etiquetas de origem, recibo verificado e suíte de 50 ataques — 0.1.55-dev — 31/10/2026

- Firewall de Intenção (`src/automation/service/intent-firewall.js`) com etiquetas de origem (`usuario` vs. `externo`), propagação de contaminação e proteção da memória do Bot contra gravação de instruções de origem externa.
- Política de efeitos que bloqueia dados externos em parâmetros críticos (destinatário, valor, conta, URL de envio) e sinaliza campos livres com texto externo.
- Recibo verificado (`createVerifiedReceipt` / `verifyReceiptMatchesRequest`) com hash SHA-256 canônico e redação de segredos, garantindo igualdade exata entre o recibo aprovado e a requisição enviada.
- Suíte aberta de 50 ataques em 5 famílias (`test/intent-firewall-attacks.test.js`: encaminhamento de e-mail, exfiltração por página/URL, texto oculto, pagamento falso/PIX e instrução em PDF/arquivo) passando com 50/50 bloqueios e zero efeito indevido.

## Registro de comandos, núcleo intocável, recibo Desfazer e barra Ctrl+K — 0.1.54-dev — 31/10/2026

- Registro único de comandos (`src/main/command-registry.js` e `docs/CATALOGO_COMANDOS_NAVEGADOR.md`) com classe de reversibilidade obrigatória (`reversivel`, `parcial`, `irreversivel` por padrão) e `Desfazer` em sequência de compensação (`undoReceipt` / `undoSequence`).
- Proteção ativa do núcleo intocável (`UNTOUCHABLE_CORE_IDS` / `UntouchableCoreError`), impedindo que IA, Bot ou MCP desativem o botão Parar tudo, o firewall de intenção, o recibo, o log de auditoria, aprovações financeiras, o cofre de segredos ou a verificação de assinatura.
- Barra de comando por intenção (`Ctrl+K` / `Ctrl+L`) com sugestões de comandos (`fechar abas duplicadas`, `alternar tema`, `abrir central`, `desfazer`, `nova aba`, `histórico`, `favoritos`, `downloads`) e cartão de recibo pós-ação (`.ai-receipt-card`) com botão `Desfazer` funcional.

## Tokens de estado, paleta 8 cores, indicador de aba controlada e Assumir — 0.1.53-dev — 31/10/2026

- Paleta de 8 cores de Bots (`BOT_ACCENT_PALETTE`) e cores de estado (`BOT_STATE_COLORS`) calibradas com contraste WCAG ≥ `3:1` em fundos claros e escuros.
- Anel de estado nos avatares combinando cor, formato do traço (`solid`, `dashed`, `dotted`, `double`), selo (`!`, `×`, `‖`) e nome acessível (`trabalhando`, `precisa de você`, `pausado por você`, `erro`).
- Indicador na aba controlada (`.tab-controlled` + faixa `#tab-control-banner`) com botão `Assumir` que pausa o agente na hora e oferece `Devolver ao bot`.
- Cartão de aprovação no chat exibe explicitamente a classe de reversibilidade (`Reversível`, `Parcialmente reversível`, `Não reversível`).

## Central de Bots e painel Delegar — 0.1.52-dev — 31/10/2026

- A Central substitui visualmente o chat enquanto está aberta, impede foco/interação com o painel por trás e devolve o foco ao fechar.
- Perfis Bot ficam em seções Ativos e Arquivados, com ações Arquivar/Restaurar. O arquivamento só altera metadados: preserva cookies, login, pasta e associação do avatar; Bots arquivados não podem ser abertos novamente.
- As gravações do registro de perfis são coordenadas entre processos, para criação e arquivamento simultâneos não sobrescreverem a lista um do outro.
- O painel Delegar começa mais estreito (`min(480px, 34vw)`) e pode ser ajustado pelo divisor com mouse/toque ou teclado; a página mantém uma largura mínima. A Central acompanha o mesmo limite.
- Os avatares pixel ficam centralizados dentro do círculo; os alvos principais de clique mantêm pelo menos 44px em layouts compactos.
- Validação local: `npm test` 374/374; `npm run test:ui` PASS; `npm run test:delegation-layout` PASS em seis tamanhos (1584x966, 1402x901, 700x800, 700x600, 400x800 e 400x600). Revisão independente estática sem falha concreta. Build e inspeção visual no executável .52 ainda pendentes.
- Limite: arquivar não encerra uma janela Bot já aberta em outro processo; o Zero ainda não mantém uma lista confiável desses processos. Nenhuma chamada a provedor de IA foi feita.

## Histórico do layout Delegar — 0.1.51-dev — 31/10/2026

- A Central agora ocupa o mesmo painel reservado pelo processo principal do navegador; a página nativa deixa de cobrir a lista e os controles.
- A Central tem título, contagem, lista rolável independente, estado do Bot atual e ação Criar Bot sempre acessível. Em janelas estreitas, usa o espaço restante ao lado do trilho.
- Barra superior, painel de conversa e página seguem as proporções do conceito visual do modo Delegar. O campo de endereço ganhou contraste legível e a barra vazia de favoritos deixa de consumir espaço.
- Validação local: `npm test` 370/370, `npm run test:ui` PASS e `npm run test:delegation-layout` PASS em 1584x966, 1402x901, 700x800 e 400x800. `test:installed` PASS com perfil temporário e provedor mockado em loopback. Nenhuma chamada a provedor externo.

## Aprovações e autonomia de Bots — 31/10/2026

- O pedido de aprovação em Delegar agora aparece como cartão no chat quando o usuário habilita “Mostrar pedidos de aprovação no chat do agente”. O cartão mostra origem, ação e conteúdo da página identificado como não confiável; oferece apenas “Permitir uma vez” e “Cancelar”. O foco inicial fica em Cancelar.
- Aprovações no chat só são usadas com o painel Delegar ativo. Fechar ou trocar de painel cancela pedidos pendentes; a interface exibe quando a ação foi cancelada ou o pedido expirou. Com o painel fechado, permanece o diálogo nativo.
- O teste de Bots verifica perfil novo em `Sempre perguntar`, recusa e aceite humano ao elevar autonomia, redução automática de autonomia e proteções técnicas ainda ativas em `Permitir todas automaticamente`.
- Validação local: `npm test` 370/370, `npm run test:ui` PASS, `npm run test:bot-runtime` PASS. O smoke do executável empacotado passou em Permitir/Cancelar via Enter, fechamento do painel e diálogo nativo. Revisão independente sem bypass; risco residual baixo apenas de ordem visual na transição. Nenhum endpoint externo foi chamado.
- Após o commit `ddac732`, instalador 0.1.50-dev instalado em QA (exit code 0); versão/hashes/atalhos confirmados e smoke completo passou. A janela está aberta em perfil QA separado. O app e o instalador não têm assinatura Authenticode.

## Histórico — 0.1.49-dev

## Correção do smoke instalado — 31/10/2026

- O smoke `test:installed` agora segue o fluxo da tela: salva a chave no cofre, sincroniza o catálogo, seleciona o modelo e espera o handshake com um servidor local. O cenário mockado responde com uma ferramenta e depois uma resposta final, evitando repetição infinita.
- A abertura do painel de IA no roteiro é idempotente e deixa de alternar um painel que já está aberto.
- `npm run test:installed` passou contra o executável 0.1.48 instalado, usando perfil temporário e endpoints loopback mockados. Não houve chamada paga nem conexão com provedor real.
- Depois do commit `fabe822`, 0.1.49 foi instalado; versão, hashes e atalhos foram conferidos e o smoke completo passou contra o executável instalado com perfil temporário. O produto não recebeu mudança de comportamento nesta versão.

## Histórico — 0.1.48-dev

## Motor, Bots e modo Delegar — 31/10/2026

- Em `advancedInput: 'auto'`, intenções explícitas de planilha/canvas/ferramentas avançadas em português ou inglês recebem o catálogo logo no primeiro pedido. Tarefas comuns continuam com carregamento sob demanda; instruções negativas e o override explícito `false` não devem ativar a pré-carga.
- Fixtures: tarefa comum serializa 8.096 bytes de esquema inicial contra 11.139 pré-carregado (27,3% a menos); tarefa explícita de planilha evita uma chamada simulada ao seletor. Bytes de request não são tokens faturados, custo, latência real nem prova de acerto geral.
- Cobertura Bot/MCP: navegação arriscada e submissão POST param quando a aprovação de fixture é recusada; o pipe responde a `ping` e `tools/list` depois de recusas e ferramenta inexistente. Nenhuma página envia dados nem recebe tráfego externo nestes testes.
- A Central de Bots se ajusta a janelas de 700 e 400 px, usa alvos de 44 px para fechar/criar, e Escape fecha o painel e devolve o foco ao acionador. Smoke executa com IPC mockado, não no instalador.
- Nenhuma chamada real ou paga a provedor foi feita nesta versão.

## Histórico — 0.1.47-dev

## Delegar e equipe Bot — 31/10/2026

- O Zero abre diretamente em Delegar; o botão composto retorna a Navegar. O campo superior aceita endereço, pesquisa e comandos para o Bot.
- A equipe Bot aparece no trilho lateral e na Central, com perfis isolados e identidades pixel art. São 200 retratos indexados em duas folhas guardadas no SQLite do perfil; cada Bot mantém uma associação estável. Os retratos não representam 200 agentes já configurados.
- O avatar do perfil atual anima enquanto a tarefa está em execução; a preferência por movimento reduzido é respeitada.
- O teste de UI verifica a abertura em Delegar e a renderização da Central; o teste de catálogo verifica armazenamento, associação e remoção de perfis obsoletos.
- O carregamento sob demanda das ferramentas avançadas reduziu o esquema serializado do primeiro pedido de 11.139 para 8.096 bytes (27,3%) na fixture. Isso não mede tokens faturados, latência ou precisão com provedor real.
- Avaliação comparativa atualizada em `docs/concorrencia/COMPARATIVO_CONCORRENTES_2026-10-28.md`; a nota mede prontidão pública, não desempenho pareado.

## Histórico — 0.1.46-dev

## Modo Delegar — 31/10/2026

- O botão da barra alterna entre Navegar e Delegar. Em Delegar, a conversa fica à esquerda e a página controlada permanece visível à direita.
- O trilho de perfis Bot abre o menu de perfis existente para criar ou trocar de perfil. A ação “Parar” interrompe a tarefa atual pelo mecanismo já existente.
- A Central e takeover completo ainda não estão ligados; o layout não os apresenta como ações disponíveis.
- `npm run test:ui` passou e `npm test` passou 362/362. O instalador foi gerado, commitado e instalado em perfil QA; a tela foi conferida no app instalado.

## Validação de Bots e conceito do modo Delegar — 31/10/2026

- Smoke Electron isolado confirmou que o perfil ativo é `Bot Fixture` e bloqueou tentativas de preencher senha e identificador de login sem formulário, mesmo com `allow-all` previamente preparado apenas nos dados temporários de teste. O campo permaneceu vazio nos dois casos; validação pelo IPC da interface, sem chamada de modelo. Ainda falta validar o caminho MCP.
- Incluído o conceito visual do modo Delegar em `docs/arquivo/CONCEITO_VISUAL_MODO_DELEGAR.md`. É uma proposta de layout, não uma tela implementada ou versão pronta para instalar.

## Espaços de Bots — 31/10/2026

- Cada Bot abre em processo e perfil de dados próprios, criado pelo menu de perfis; bots começam em “Sempre perguntar”. A interface ainda não oferece exclusão de Bots.
- O login é feito manualmente pelo usuário; o cadastro do Bot não tem campo para senha. Depois do login, os cookies da sessão ficam no perfil isolado do Bot.
- Aumentar a autonomia pede confirmação explícita; reduzir o nível é imediato. Para bots, são recusados preenchimento de credenciais, leitura da área de transferência, leitura de planilhas via clipboard, sequências de teclas, JavaScript livre, CDP bruto/eventos e motor Flame.
- Screenshots são negados quando controles sensíveis são detectados ou a inspeção não é completa. Entrada visual em controles de shadow DOM, iframes ou foco indefinido também é recusada. Formulários personalizados sem sinais semânticos ainda podem escapar à classificação; login deve ser feito pelo usuário.

## Continuação da auditoria (28/10/2026)

- Provider Ollama local opt-in: catálogo dos modelos já instalados e chat pela API nativa em loopback. Não pede credencial, não baixa modelos e não tenta fallback para nuvem.
- Proteções de navegação de extensão, permissões por origem/sessão e endurecimento de IPC seguem incluídos; módulos e transformações continuam desativados até haver isolamento seguro comprovado.
- Biblioteca com estados acessíveis anunciados e navegação por teclado. Limites de validação atuais estão registrados em `HANDOFF.md`.

Versão de desenvolvimento com foco no motor de IA e em sites difíceis (planilhas, canvas, editores).

## Navegador

- **Botão + ao lado da última aba**: nova aba com um clique, no lugar de sempre Ctrl+T; o resto da barra continua arrastável. O teste de UI exige o botão visível e encostado na última aba.

## Painel mais legível

- **Título da nova aba restaurado** para “Novo Separador · Zero Browser”, alinhado ao teste de aceitação.

- **Biblioteca com abas**: Histórico, Favoritos e Downloads no mesmo painel, e um botão Biblioteca no painel do agente.

- **Escala tipográfica única**: 10,5 / 11,5 / 13 / 15 px, aplicada ao chat, rodapés, ações e textos secundários; o teste de UI mede 13 px no cartão do agente.

- **Índice das configurações**: chips fixos no topo, um por seção, levam direto ao bloco (gerado do próprio conteúdo, sem desatualizar).

- **Cabeçalho compacto**: uma linha, sem kicker e subtítulo redundantes (medido no teste de UI).
- **Skeleton ao sincronizar modelos**: barra de carregamento no status em vez de texto estático.

- **Módulos no painel**: a execução de código está atualmente desativada até existir isolamento seguro validado; módulos salvos podem ser listados e apagados. **Memória editável**: botão Editar em cada fato.

- **Tarefas pausadas**: o painel lista até três, cada uma com Continuar e Descartar (sem reiniciar o app).

- **Receitas no painel**: botão Receitas lista as do site atual e executa sem modelo, mostrando passos e contrato de saída.

- **Gestão de conversas**: renomear, fixar no topo (★) e apagar pelo seletor — tudo salvo no perfil.

- **Aprovação no chat (opt-in)**: com ligado e o painel aberto, a confirmação de ação aparece como cartão (Permitir uma vez / Sempre neste site / Negar). Painel fechado continua usando o diálogo do sistema; sem resposta em 60 s, a ação é negada.

- **Copiar**: cada resposta tem botão Copiar; a barra de conversas copia a conversa inteira em Markdown.

- **Tempo e tokens da execução**: cada resposta termina com “Concluído em 8,3 s · 12.345 tokens”, vindo do evento de fim da tarefa.

- **Progresso ao vivo**: durante a tarefa o painel mostra “Ação N de MAX · ferramenta” em vez de “Executando…”.
- **Linha do tempo**: cada resposta traz um resumo recolhível das ferramentas executadas, com passo e falha/código quando houver.

- **Erro com código**: a mensagem de falha mostra a etiqueta do código (, , …) para diagnosticar sem abrir o trace.

- **Transparência da resposta**: cada resposta mostra quais ferramentas consumiram rodadas (), no rodapé do cartão. É o primeiro item do lote 1 do plano de UX.

- **Estado vazio acionável**: três exemplos clicáveis (ler planilha, preencher formulário, resumir página) preenchem a caixa de comando com um clique. O smoke de UI passou a exigir isso.

- **Foco visível em toda a casca**: botões, selects, abas e caixa de texto ganham anel de foco — navegação por teclado deixa de ser às cegas.
- **Respostas mais largas**: mensagens do agente usam até 96% da largura; as suas ficam em 78%, separando quem falou.
- **Contraste dos textos secundários** elevado (nota de privacidade e dicas).

## Fallback visual

- **Sugestão de captura quando o DOM é pobre**: se encontra 3 controles ou menos (canvas, app visual), o resultado orienta uma única e proíbe repetir inspeção — menos rodadas e menos token em sites que o DOM não descreve.

## Fluxos com login sob autorização explícita

- **`allowCredentials` em tarefas de QA**: uma tarefa pode liberar campos de senha **apenas** nos hosts declarados
  e somente quando o chamador passa essa opção. Sem ela, senha/código continuam recusados — nada muda no uso normal.
- **Motivo real da recusa**: quando uma ação é negada por política, a mensagem agora traz o motivo específico
  (antes mostrava só “cancelada pelo usuário”).
- **Suíte `--conjunto=reais-extras`**: carrinho (SauceDemo), cadastro e carrinho (Automation Exercise), app de RH
  (OrangeHRM demo), e-mail descartável (Yopmail) e Google Planilhas.
- **Suíte `--conjunto=email`** com fixture local: mover mensagem para pasta, marcar como lida, salvar rascunho e
  enviar.

## Sites reais difíceis

- **Conteúdo principal no snapshot**: `inspect_page` passou a extrair o texto de `main`/`article`/`#content` em vez
  do `body` inteiro. Em portais pesados, menu e rodapé ocupavam o limite de texto e a manchete ficava de fora.
- **Títulos da página**: o snapshot agora traz até 12 títulos (`headings`) para o modelo se orientar sem gastar uma
  rodada extra de leitura.
- **Aceita string ou objeto**: a leitura continua compatível com páginas que devolvem texto simples.

## Segurança do canal local

- **Token do pipe restrito ao seu usuário**: no Windows, o arquivo `pipe-token` agora recebe ACL explícita
  (`icacls /inheritance:r`) só para o SID atual e SYSTEM — outros usuários locais deixam de poder lê-lo, mesmo com
  acesso à pasta do perfil. O token é apagado quando o app fecha e só é gravado depois que a instância possui o pipe
  (uma segunda instância não sobrescreve a primeira). Usa SID, não nome de conta, então perfil roaming ou
  redirecionado continua funcionando.

## Menos rodadas, mais progresso

- **Guardião de progresso**: se o agente só lê por 3 rodadas, o host injeta um aviso para agir ou concluir; na 5ª,
  manda parar de inspecionar. No meio e no fim do orçamento, lembra quantas ações restam e pede para agrupar
  ferramentas no mesmo turno.
- **`run_steps` ligado por padrão no painel**: até 12 passos conhecidos (preencher campos, marcar itens, clicar)
  numa única rodada, com pós-condição conferida pelo host em cada passo. É o maior corte de rodadas em formulários.
- **Pré-inspeção ligada por padrão no painel**: a primeira leitura da página chega pronta antes do primeiro turno do
  modelo, economizando uma rodada inteira em toda tarefa.
- **Limite de ações configurável**: 20, 40 (padrão) ou 60 em Configurações → Agente · recursos.
- **Pausa com diagnóstico**: ao parar no limite, a mensagem diz quais ferramentas gastaram as rodadas e qual foi o
  último erro, além do botão **Continuar** com o histórico.
- **Planilhas em uma chamada**: o exemplo de `sheets batch` (ler intervalo e gravar total) entrou no prompt, junto da
  proibição de inspecionar antes numa planilha.

Versão de desenvolvimento com foco no motor de IA e em sites difíceis (planilhas, canvas, editores).

## Auditoria e correções

- **CSP nas páginas locais**: a casca (painel, menus) e a nova aba agora recusam script/estilo inline e conexões de
  rede. Para isso, o estilo e o script da nova aba saíram do HTML para `newtab.css` e `newtab.js`, e as cores dos
  atalhos viraram classes. Um teste de UI com Electron (`npm run test:ui`) falha se a CSP bloquear qualquer coisa.
- **APIs de extensão**: `management.getAll` lista as extensões realmente carregadas; `management.setEnabled(id,false)`
  descarrega uma extensão de terceiros na sessão; `uninstall` aponta para ⋯ → Extensões → Remover em vez de apagar
  arquivos do usuário.
- **Cliente de automação**: requisições pendentes são rejeitadas na hora em que a conexão cai, sem esperar 30 s.
- **Sem código morto**: o canal IPC `automation:list-tools` (sem consumidor) foi removido.

- **Pipe MCP autenticado**: o canal local que clientes como Claude Code e Codex usam agora exige um token criado a
  cada início (arquivo `pipe-token` na pasta de dados do usuário). Antes, qualquer processo local podia dirigir o
  navegador; agora a primeira linha da conexão precisa provar acesso à pasta do perfil.
- **Retomada funcionando de verdade**: ao pausar no limite de ações na mesma sessão, a tarefa agora vai para a lista
  com id; antes o cartão **Continuar tarefa** aparecia, mas o botão não fazia nada.
- **Histórico — módulos**: naquela versão, o Guardian passou a aceitar `module run` sem `code` para selecionar o módulo salvo. A execução foi desativada posteriormente após a descoberta de escape do sandbox; o pacote e a árvore atuais não devem ser descritos como executando módulos.
- **Contrato de saída com lote**: receita que lê dentro de `sheets batch` agora alimenta `output`/`outputValid`; antes
  falhava com “nenhuma leitura”.
- **Histórico — recursos**: uma versão anterior ligou receitas, transformações e cache por configuração. Hoje a execução de transformações/módulos está bloqueada; não interprete este registro histórico como estado atual.

Versão de desenvolvimento com foco no motor de IA e em sites difíceis (planilhas, canvas, editores).

## Painel e conversas

- **Planilhas com menos ações**: `sheets` ganhou `action: "batch"` (até 12 operações — ler, gravar, ler de novo —
  numa única chamada, com uma só aprovação de escrita). O agente não precisa mais gastar uma rodada por intervalo.
- **Inspeção barata no Planilhas**: `inspect_page` numa planilha devolve só título, seleção e abas (célula não
  existe no DOM) em vez de uma árvore de acessibilidade inútil; o retorno já orienta a usar `batch` e proíbe
  clique em célula. É isso que fazia a tarefa “demorar e pedir 30 ações”.
- **Orçamento maior**: o padrão do painel subiu de 30 para 40 ações; com batch, o caso normal cabe em 4–6.

- **Histórico de conversas**: cada conversa fica salva com título e data; você alterna pelo seletor no topo do
  painel, cria uma **Nova** e continua de onde parou depois de fechar o app.
- **Resposta organizada**: o texto do modelo agora sai em parágrafos, listas, títulos, negrito e blocos de código,
  em vez de um bloco único. O parser não injeta HTML — o texto do modelo continua sendo texto.
- **Retomar tarefa**: se uma tarefa foi pausada (inclusive antes de fechar o app), aparece um cartão
  **Continuar tarefa** no topo do chat, com modelo, horário e endereço.
- **Memória do agente**: botão **Memória** mostra o que foi guardado (fatos por site e ações concluídas), com
  validade de 30 dias e opção de apagar. Senha, token e cartão são recusados na hora de guardar.
- **Módulos de operação (histórico, execução hoje desativada)**: uma versão anterior permitia gravar código por site e tentava executá-lo no sandbox. O bloqueio foi aplicado após o escape; armazenamento/listagem não comprovam execução segura.
- **Receitas como artefato**: `recipe_export`/`recipe_import` levam uma receita de um perfil a outro sem banco.

## Motor de IA

- **Tarefa durável**: quando o agente para no limite de rodadas, o histórico é gravado em disco e sobrevive a
  fechar o app (TTL de 20 min). Ao reabrir, a aba é recriada no último endereço e "Continuar" retoma de onde parou;
  até 8 tarefas, sem chave de API no arquivo.
- **Receitas como integração (MCP)**: `recipe_list` e `recipe_run` expõem as receitas salvas a qualquer cliente MCP.
  Rodam sem modelo, exigem a aba na origem certa, respeitam entradas obrigatórias e devolvem o contrato de saída.
- **Transformação — alegação histórica revogada**: o texto original desta versão dizia que `transform` rodava em processo isolado sem `require`, rede ou disco. A auditoria encontrou escape de sandbox; a execução atual está desativada e essa garantia não é válida para o código anterior.
- **Guardian independente**: cada ação passa por um revisor determinístico antes de executar. Ele recusa navegação
  fora de HTTP/HTTPS, URL com usuário e senha, envio de arquivo para origem diferente da tarefa (ou de uma origem
  de login declarada) em fluxos com URL inicial declarada (run_task/MCP), formulário cross-site e receita que grava
  em modo leitura. No uso interativo, o upload depende apenas da sua aprovação no diálogo. A resposta final também
  é revisada: se o agente afirma um efeito específico (salvei, enviei, apaguei) sem contrato de verificação, o
  resultado traz `guardian` com o motivo.
- **Cache de prefixo opt-in**: `promptCache` envia `prompt_cache_key` só a provedores que têm esse campo
  (OpenAI/OpenRouter) e um breakpoint `cache_control` no system para modelos Claude. O resultado traz
  `promptCache.cacheHitRate` e diz para desligar quando o provedor não devolve token cacheado.
- **Saída com contrato por receita**: a receita declara `output` — cada campo aponta para uma célula A1 do
  intervalo lido. O host valida os valores lidos (não o que o modelo diz ter lido), converte número no padrão
  brasileiro (`R$ 1.234,56` → `1234.56`), booleano e lista, e devolve `output` + `outputValid`. Contrato quebrado
  devolve `OUTPUT_INVALID` com os problemas por campo, em vez de texto solto.
- **`sheets` como passo de receita**: ler/gravar intervalo A1 faz parte das receitas determinísticas
  (`read`, `write`, `goto`), com a mesma autoridade `read`/`write` e sem clique em célula.
- **Nome acessível padrão**: snapshot e locators usam a ordem do accname (labelledby, aria-label, rótulo nativo,
  title, placeholder, conteúdo), o que reduz clique no controle errado em qualquer site.
- **Diagnóstico do Planilhas**: `sheets` devolve `diagnostics` (caixa de nome, seleção, intervalo aplicado) e códigos
  como `NAME_BOX_NOT_FOUND` e `CLIPBOARD_EMPTY`, para saber exatamente onde falhou.
- **Credencial com escopo de origem**: campo sensível só é preenchido quando o formulário envia para a origem da
  página ou para uma origem de autenticação declarada; formulário cross-origin é recusado antes de digitar.
- **Autoridade de receita**: `read` só navega e espera; `write` pode clicar. A receita recusa cliques quando é de
  leitura.
- **Mint automático**: tarefa verificada que usou passos estáveis vira receita sozinha, sem o modelo precisar salvar.
- **Receitas v2**: schema de entrada (`{{campo}}`), validação de obrigatórios e `possibleCommit` com
  “leia antes de repetir”.
- **Pós-condições verificadas** em `run_steps`: cada passo declara `expect` e o host confere antes de seguir.
- **Journal de efeitos**: envio/compra/exclusão não se repetem às cegas; só efeito crítico entra no journal.
- **Risco por capacidade**: aprovação por credencial/destrutivo/compromisso/escrita, com motivo específico.
- **Verificação por contrato**: `url`, `text`, `absent`, `textCount` e `download`, com `check_task` e correção.
- **Extração estruturada**: `extract_table` e `read_batch` com `extract` em paralelo entre abas.

## Sites difíceis

- **Clipboard**: ler/gravar texto e TSV para colar uma tabela inteira de uma vez.
- **Sequências de teclado**: setas ×N, Tab, F2, Ctrl+seta, para navegar em grades sem clicar em célula.
- **Clique visual**: `visual_click` em coordenadas 0–1000 da captura, para o que só existe na imagem.
- **Acessibilidade do Planilhas**: alterna o modo de leitor de tela (Ctrl+Alt+Z) para tentar expor células.

## Navegador

- Perfis locais no menu ⋮, menu de contexto das abas, histórico de downloads persistente e atalhos com foco na
  página.
- O perfil e a instalação anterior permanecem recuperáveis pelos backups em `backups/`.

## Limites conhecidos

- O modo de acessibilidade do Planilhas ainda não foi validado numa conta real.
- Grounding visual depende de um modelo com visão.
- Integração por API (Sheets e afins) ainda não existe.
- Módulos rodam só sobre dados já lidos: não executam código dentro da página nem clicam sozinhos.
- Nada disto substitui o teste numa conta/site real: os números do benchmark são de fixtures locais e um modelo.

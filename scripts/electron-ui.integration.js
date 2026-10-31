// Smoke de UI: garante que a CSP não bloqueou a casca (app.js, markdown.js, CSS) e que a nova aba executa.
// Roda com: npm run test:ui  (electron scripts/electron-ui.integration.js)
const { app, BrowserWindow, ipcMain } = require('electron');
const assert = require('node:assert/strict');
const path = require('node:path');

const rendererDir = path.join(__dirname, '..', 'src', 'renderer');
const failures = [];
const messages = [];
let newTabCalls = 0;
let downloads = [];
let extensionActionCalls = 0;
let delayNextHistory = false;
let deferredHistoryResolve = null;
let testWindow = null;
let sidePanelOpen = false;
let sidePanelPosition = 'left';
let sidePanelWidth = null;
let botProfiles = [
  { id: 'bot-fixture', name: 'Bot Fixture', avatarId: 'pixel-001', avatar: { sheetId: 'pixel-animals-01', frameIndex: 0, columns: 10, rows: 10, accent: '#129b78' } },
  { id: 'bot-other', name: 'Bot Outro', avatarId: 'pixel-002', avatar: { sheetId: 'pixel-animals-01', frameIndex: 1, columns: 10, rows: 10, accent: '#1686d9' } }
];

function mockSidePanelLayout() {
  const width = testWindow?.getContentBounds().width || 1200;
  const compact = width <= 800;
  const railWidth = sidePanelOpen && sidePanelPosition === 'left' ? (compact ? 64 : 80) : 0;
  const available = Math.max(0, width - railWidth - (compact ? 160 : 320));
  const maximum = Math.min(760, available);
  const minimum = Math.min(compact ? 160 : 240, maximum);
  const defaultWidth = compact
    ? (width <= 480 ? maximum : Math.min(360, Math.floor(width * 0.4)))
    : Math.min(480, Math.floor(width * 0.34));
  sidePanelWidth = Math.max(minimum, Math.min(maximum, sidePanelWidth ?? defaultWidth));
  return {
    open: sidePanelOpen,
    panelWidth: sidePanelWidth,
    railWidth,
    contentTop: 112,
    bounds: sidePanelOpen && sidePanelPosition === 'left'
      ? { x: railWidth + sidePanelWidth, y: 112, width: Math.max(1, width - railWidth - sidePanelWidth), height: 600 }
      : null
  };
}

// O painel conversa com o main por IPC; aqui basta responder o suficiente para o init não travar.
const stubs = {
  'store:getAll': () => ({}),
  'store:get': () => null,
  'store:set': () => true,
  'browser:get-last-session': () => [],
  'browser:get-tabs': () => [],
  'browser:get-side-panel-layout': () => mockSidePanelLayout(),
  'browser:get-bots': () => ({ bots: botProfiles.map((bot) => ({ ...bot })), avatars: 200, currentProfileId: 'bot-fixture' }),
  'browser:get-bot-avatar-sheet': () => null,
  'browser:app-info': () => ({ version: '0.1.47-dev', profile: 'Principal' }),
  'browser:freeze-page': () => null,
  'browser:set-side-panel-open': (_event, state) => {
    const normalized = state && typeof state === 'object' ? state : { open: state === true };
    sidePanelOpen = normalized.open === true;
    sidePanelPosition = normalized.position === 'left' ? 'left' : 'right';
    return mockSidePanelLayout();
  },
  'browser:set-side-panel-width': (_event, width) => {
    sidePanelWidth = width;
    return mockSidePanelLayout();
  },
  'browser:archive-bot': (_event, id) => {
    const bot = botProfiles.find((profile) => profile.id === id);
    if (!bot) throw new Error('Bot não encontrado');
    bot.archived = true;
    return { ...bot };
  },
  'browser:restore-bot': (_event, id) => {
    const bot = botProfiles.find((profile) => profile.id === id);
    if (!bot) throw new Error('Bot não encontrado');
    delete bot.archived;
    return { ...bot };
  },
  'automation:jobs': () => [],
  'automation:run-agent': () => ({ success: true, message: 'Resultado do motor de fixture.' }),
  'automation:cancel-agent': () => ({ success: false, error: 'Não há execução ativa.' }),
  'bots:get-presets': () => [],
  'bots:get-symbols': () => [{ id: 'radar', label: 'Radar', svgPath: 'M12 3a9 9 0 1 0 9 9' }],
  'bots:list-tasks': () => [
    { id: 'bot-spec-fixture', name: 'Bot Caçador de Preços', specialty: 'price-hunter', specialtyTitle: 'Pesquisador de Preços', executionMode: 'background-auto-foreground', defaultUrl: 'https://www.google.com/shopping', accent: '#168f72', autonomyStep: 1, memory: ['Regra inicial'], history: [] },
    { id: 'bot-spec-market', name: 'Bot de Mercado', specialty: 'market-watch', specialtyTitle: 'Monitor de mercado', executionMode: 'background-auto-foreground', defaultUrl: 'https://example.test', accent: '#2480d2', autonomyStep: 1, memory: [], history: [] },
    { id: 'bot-spec-inbox', name: 'Bot de E-mail', specialty: 'inbox-triage', specialtyTitle: 'Triagem de e-mail', executionMode: 'dedicated-tab', defaultUrl: 'https://example.test', accent: '#8966d4', autonomyStep: 1, memory: [], history: [] }
  ],
  'bots:create-task': (_e, spec) => ({ id: `bot-task-smoke-${Date.now()}`, ...spec }),
  'bots:run-now': () => ({ status: 'completed', shouldBringToFront: true, attentionReason: 'goal_reached', summary: 'Menor valor encontrado.', receipt: { receiptHash: 'abc123456789' } }),
  'bots:stop-all': () => ({ stoppedCount: 0, elapsedMs: 0 }),
  'bots:run-missed-schedules': () => [],
  'bots:add-memory': () => ({ ok: true }),
  'bots:promote-autonomy': () => ({ autonomyStep: 2 }),
  'bots:register-trigger': () => ({ id: 'trig-1' }),
  'bots:list-triggers': () => [],
  'bots:create-mandate': () => ({ id: 'mand-1', allowedAction: 'reserve-price-offer', maxAmountBRL: 200, usedCount: 0, maxUses: 1 }),
  'bots:get-mandate': () => null,
  'bots:windows-task-spec': () => ({ taskName: 'ZeroBrowser_Bot_1', dailyAt: '09:00', schtasksCreateCommand: 'schtasks /Create /F /SC DAILY' }),
  'bots:teach:start': () => ({ recording: true, steps: [] }),
  'bots:teach:record-event': () => ({ ok: true }),
  'bots:teach:stop': () => ({ recording: false, steps: [] }),
  'bots:teach:save-as-bot': () => ({ ok: true, bot: { id: 'bot-taught-1', name: 'Bot Ensinado na Aba', specialtyTitle: 'Ensinado', autonomyStep: 1 } }),
  'routes:list': () => [{ id: 'r-1', domain: 'api.mercadolivre.com', method: 'GET', pathTemplate: '/sites/MLB/search', description: 'Busca direta', enabled: true, replayCount: 2 }],
  'routes:toggle': () => ({ id: 'r-1', enabled: false }),
  'routes:capture-current': () => ({ ok: true }),
  'routes:rehearse-twin': () => ({ rehearsed: true, mutationsCount: 1 }),
  'connectors:status': () => ({ connectors: [{ provider: 'email', title: 'Gmail / Outlook' }], telegramSenders: [] }),
  'connectors:add-telegram-sender': () => ['100200300'],
  'live-apps:list': () => [{ id: 'app-bills', title: 'Painel de Vencimentos da Semana', items: [{ title: 'Energia', amountBRL: 248.9, dueDate: '2026-11-05' }] }],
  'live-apps:generate': () => ({ id: 'app-gen-1', title: 'Painel Gerado', items: [] }),
  'automation:memory': () => [],
  'browser:new-tab': () => ({ tabId: `tab-smoke-${++newTabCalls}` }),
  'browser:close-tab': () => ({ success: true }),
  'browser:switch-tab': () => ({ tabId: 'tab-smoke' }),
  'browser:set-bookmarks-bar': () => true,
  'browser:get-downloads': () => downloads,
  'browser:extensions:list': () => [{ id: 'fixture-action', name: 'Ação Fixture', version: '1.0', permissions: ['activeTab'], enabled: true, hasAction: true }],
  'browser:extensions:invoke-action': () => { extensionActionCalls += 1; return { success: true, activeTabGranted: true }; },
  'ai:get-config': () => ({ provider: 'openrouter', model: '', hasApiKey: false, keyHint: '' }),
  'flame:status': () => ({ available: false }),
  'library:bookmarks': () => [],
  'library:import-sources': () => [],
  'library:history': () => {
    if (!delayNextHistory) return [];
    delayNextHistory = false;
    return new Promise((resolve) => { deferredHistoryResolve = resolve; });
  },
  'library:suggest': () => []
};
for (const [channel, handler] of Object.entries(stubs)) ipcMain.handle(channel, handler);

function watch(window, label) {
  window.webContents.on('console-message', (_event, level, message) => {
    messages.push(`${label}: ${message}`);
    if (/content security policy|refused to (load|execute|apply)/i.test(String(message))) {
      failures.push(`CSP bloqueou algo em ${label}: ${message}`);
    }
  });
  window.webContents.on('did-fail-load', (_event, code, description, url) => {
    failures.push(`${label} não carregou (${code} ${description}): ${url}`);
  });
}

function sendTab(webContents, { shift = false } = {}) {
  const modifiers = shift ? ['shift'] : [];
  webContents.sendInputEvent({ type: 'keyDown', keyCode: 'TAB', modifiers });
  webContents.sendInputEvent({ type: 'keyUp', keyCode: 'TAB', modifiers });
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'src', 'preload', 'preload.js'),
      partition: 'zero-ui-test',
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  testWindow = window;
  watch(window, 'index');

  try {
    const loaded = new Promise((resolve, reject) => {
      window.webContents.once('did-finish-load', resolve);
      window.webContents.once('did-fail-load', (_e, code, description) => reject(new Error(`${code} ${description}`)));
    });
    await window.loadFile(path.join(rendererDir, 'index.html'));
    await loaded;
    await new Promise((resolve) => setTimeout(resolve, 800));

    window.show();
    window.focus();
    await window.webContents.executeJavaScript("document.getElementById('address-bar').focus()");
    sendTab(window.webContents);
    sendTab(window.webContents, { shift: true });

    const shell = await window.webContents.executeJavaScript(`(() => {
      document.getElementById('ai-panel')?.classList.remove('hidden');
      return ({
      app: typeof window.app === 'object' && window.app !== null,
      markdown: typeof window.ZeroMarkdown?.parseBlocks === 'function',
      sessions: !!document.getElementById('ai-session'),
      newChat: !!document.getElementById('btn-ai-new-chat'),
      memory: !!document.getElementById('btn-ai-memory'),
      resourceToggles: ['setting-agent-recipes','setting-agent-transforms','setting-agent-prompt-cache','setting-agent-max-steps'].every((id) => !!document.getElementById(id)),
      cssApplied: getComputedStyle(document.body).fontFamily.length > 0,
      richChat: typeof window.app?.renderRichText === 'function',
      examples: document.querySelectorAll('.ai-examples .btn-ghost').length,
      runEvents: typeof window.zeroBrowser?.automation?.onRunEvent === 'function',
      copyChat: !!document.getElementById('btn-ai-copy-chat'),
      approval: typeof window.zeroBrowser?.automation?.onApprovalRequest === 'function',
      manageChat: ['btn-ai-rename-chat','btn-ai-pin-chat','btn-ai-delete-chat','btn-ai-recipes','btn-ai-modules'].every((id) => !!document.getElementById(id)),
      headerHeight: Math.round(document.querySelector('#ai-panel .panel-header')?.getBoundingClientRect().height || 0),
      settingsIndex: document.querySelectorAll('#settings-index button').length,
      aiProviders: [...(document.getElementById('ai-provider')?.options || [])].map((option) => option.value),
      tipografia: getComputedStyle(document.querySelector('.ai-message')).fontSize,
      libraryTabs: document.querySelectorAll('.library-tab').length,
      libraryGroupRole: document.querySelector('.library-tabs')?.getAttribute('role'),
      selectedLibraryTabs: document.querySelectorAll('.library-tab[aria-pressed="true"]').length,
      selectedLibraryMode: document.querySelector('.library-tab[aria-pressed="true"]')?.dataset.modo,
      libraryButtonsNativeAndTabbable: [...document.querySelectorAll('.library-tab')].every((button) => button.tagName === 'BUTTON' && button.tabIndex === 0),
      libraryButton: !!document.getElementById('btn-ai-library'),
      aiButtonLabel: document.querySelector('#btn-ai .ai-copilot-label')?.textContent.trim(),
      aiButtonAccessibleLabel: document.getElementById('btn-ai')?.getAttribute('aria-label'),
      delegationModeOnStartup: document.getElementById('app')?.classList.contains('delegation-mode'),
      botRailVisible: !document.getElementById('delegation-rail')?.classList.contains('hidden'),
      botAvatarButtons: document.querySelectorAll('#bot-rail-list button.bot-avatar').length,
      currentBotRole: document.querySelector('#bot-rail-list .bot-avatar[aria-current="true"]')?.getAttribute('role'),
      currentBotAccessibleName: document.querySelector('#bot-rail-list .bot-avatar[aria-current="true"]')?.getAttribute('aria-label'),
      botAddressFocusVisible: (() => { const address = document.getElementById('address-bar'); return { focused: document.activeElement === address, matches: address.matches(':focus-visible'), outline: getComputedStyle(address).outlineStyle, color: getComputedStyle(address).outlineColor }; })(),
      botAvatarCount: document.getElementById('bot-rail-count')?.textContent,
      botRailSections: [...document.querySelectorAll('.bot-rail-section-label')].map((label) => label.textContent.trim()),
      botCentralVisible: !document.getElementById('btn-bot-central')?.classList.contains('hidden'),
      aiButtonActive: document.getElementById('btn-ai')?.classList.contains('active'),
      resizer: (() => { const element = document.getElementById('delegation-resizer'); const rect = element?.getBoundingClientRect(); return { role: element?.getAttribute('role'), orientation: element?.getAttribute('aria-orientation'), controls: element?.getAttribute('aria-controls'), visible: Boolean(rect?.width && rect?.height) }; })(),
      newTab: (() => { const b = document.getElementById('btn-new-tab'); const t = document.querySelector('.tab'); if (!b) return null; const r = b.getBoundingClientRect(); return { width: Math.round(r.width), afterTab: t ? Math.round(r.left) >= Math.round(t.getBoundingClientRect().right) - 2 : true }; })()
    }); })()`);

    assert.equal(shell.app, true, 'app.js não executou (CSP ou erro)');
    assert.equal(shell.markdown, true, 'markdown.js não carregou');
    assert.equal(shell.richChat, true, 'renderização em parágrafos ausente');
    assert.equal(shell.sessions, true, 'seletor de conversas ausente');
    assert.equal(shell.newChat, true, 'botão Nova conversa ausente');
    assert.equal(shell.memory, true, 'botão Memória ausente');
    assert.equal(shell.resourceToggles, true, 'opções de recursos do agente ausentes');
    assert.equal(shell.cssApplied, true, 'CSS não aplicado');
    assert.ok(shell.examples >= 3, 'estado vazio precisa de exemplos acionáveis');
    assert.equal(shell.runEvents, true, 'preload precisa expor onRunEvent');
    assert.equal(shell.copyChat, true, 'botão de copiar conversa ausente');
    assert.equal(shell.approval, true, 'preload precisa expor onApprovalRequest');
    assert.ok(shell.headerHeight > 0 && shell.headerHeight < 70, `cabeçalho do painel precisa ser compacto (${shell.headerHeight}px)`);
    assert.ok(shell.newTab && shell.newTab.width >= 24, 'botão + de nova aba precisa estar visível');
    assert.equal(shell.newTab.afterTab, true, 'botão + deve ficar logo depois da última aba');
    assert.ok(shell.settingsIndex >= 8, `indice das configuracoes incompleto (${shell.settingsIndex})`);
    assert.ok(shell.aiProviders.includes('openai'), 'OpenAI direto precisa estar disponível no seletor de provedores');
    assert.equal(shell.tipografia, '13px', `escala tipografica do chat fora do padrao (${shell.tipografia})`);
    assert.equal(shell.libraryTabs, 3, 'biblioteca precisa das tres abas');
    assert.equal(shell.libraryGroupRole, 'group', 'categorias da biblioteca são controles de alternância, não uma tablist incompleta');
    assert.equal(shell.selectedLibraryTabs, 1, 'grupo da biblioteca expõe exatamente um modo selecionado');
    assert.equal(shell.selectedLibraryMode, 'history', 'modo de histórico inicia anunciado como selecionado');
    assert.equal(shell.libraryButtonsNativeAndTabbable, true, 'categorias são botões nativos incluídos na ordem sequencial de Tab');
    assert.equal(shell.libraryButton, true, 'botao Biblioteca ausente no painel');
    assert.equal(shell.delegationModeOnStartup, true, 'o app precisa abrir no novo modo Delegar');
    assert.equal(shell.botRailVisible, true, 'a equipe Bot precisa aparecer no modo Delegar');
    assert.equal(shell.botAvatarButtons, 1, 'perfil de outro Bot deve ser acionável na lateral');
    assert.equal(shell.currentBotRole, 'img', 'Bot da janela atual aparece como identidade estática, não ação sem efeito');
    assert.equal(shell.currentBotAccessibleName, 'Bot Bot Fixture, perfil aberto nesta janela', 'avatar atual informa o perfil para leitores de tela');
    assert.equal(shell.botAddressFocusVisible.focused && shell.botAddressFocusVisible.matches && shell.botAddressFocusVisible.outline !== 'none', true, `campo de endereço mantém indicador de foco no modo Delegar (${JSON.stringify(shell.botAddressFocusVisible)})`);
    assert.equal(shell.botAvatarCount, '2 perfis', 'a lateral conta perfis reais, não as imagens do catálogo');
    assert.deepEqual(shell.botRailSections, ['Perfis', 'Especialistas'], 'o trilho separa perfis de Bots das tarefas especializadas');
    assert.equal(shell.botCentralVisible, true, 'Central de Bots deve estar acessível no modo Delegar');
    assert.equal(shell.aiButtonActive, true, 'botão Delegar mostra visualmente o estado ativo');
    assert.deepEqual(shell.resizer, { role: 'separator', orientation: 'vertical', controls: 'ai-panel browser-container', visible: true }, 'divisor de largura acessível está visível no modo Delegar');
    const resizeResult = await window.webContents.executeJavaScript(`(async () => {
      const divider = document.getElementById('delegation-resizer');
      const before = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--delegation-panel-width'));
      divider.focus();
      let keyReceived = false;
      let seenKey = '';
      divider.addEventListener('keydown', (event) => { keyReceived = true; seenKey = event.key; }, { once: true });
      let requested = null;
      const originalCommit = window.app.commitDelegationPanelWidth.bind(window.app);
      window.app.commitDelegationPanelWidth = (width, options) => { requested = width; return originalCommit(width, options); };
      divider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 250));
      const after = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--delegation-panel-width'));
      return { before, after, value: divider.getAttribute('aria-valuenow'), panelWidth: document.getElementById('ai-panel').getBoundingClientRect().width, keyReceived, key: seenKey, requested };
    })()`);
    assert.equal(resizeResult.after, resizeResult.before + 24, `seta do divisor amplia o painel em 24px (${JSON.stringify(resizeResult)})`);
    assert.equal(resizeResult.panelWidth, resizeResult.after, 'largura da conversa acompanha a largura informada ao processo principal');
    assert.equal(shell.aiButtonLabel, 'Delegar', 'o botão mantém o nome do modo exibido na referência');
    assert.match(shell.aiButtonAccessibleLabel, /voltar ao modo Navegar/i, 'o rótulo acessível informa como voltar ao modo Navegar');
    assert.equal(shell.manageChat, true, 'ações de conversa ausentes');

    await window.webContents.executeJavaScript("document.getElementById('btn-bot-central').click()");
    await new Promise((resolve) => setTimeout(resolve, 100));
    await window.webContents.executeJavaScript('window.app.renderBotCentral(); window.app.renderBotCentral()');
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(await window.webContents.executeJavaScript("document.querySelectorAll('#bot-central-list .grokbot-central-card').length"), 3,
      'renderizações assíncronas antigas não duplicam seções da Central');
    const botCentral = await window.webContents.executeJavaScript(`({
      expanded: document.getElementById('btn-bot-central')?.getAttribute('aria-expanded'),
      rows: document.querySelectorAll('#bot-central-list .bot-central-row').length,
      openButtons: document.querySelectorAll('#bot-central-list button.bot-central-open').length,
      currentProfileText: [...document.querySelectorAll('#bot-central-list .bot-central-row')].find((row) => row.dataset.botId === 'bot-fixture')?.textContent,
      currentProfileCursor: (() => { const row = [...document.querySelectorAll('#bot-central-list .bot-central-row')].find((entry) => entry.textContent.includes('Bot Fixture')); return row ? getComputedStyle(row).cursor : null; })(),
      currentAvatarCursor: (() => { const row = [...document.querySelectorAll('#bot-central-list .bot-central-row')].find((entry) => entry.textContent.includes('Bot Fixture')); const avatar = row?.querySelector('.bot-avatar'); return avatar ? getComputedStyle(avatar).cursor : null; })(),
      label: document.querySelector('#bot-central-list .bot-central-row strong')?.textContent,
      dialog: document.getElementById('bot-central')?.getAttribute('role'),
      summary: document.getElementById('bot-central-summary')?.textContent,
      cards: [...document.querySelectorAll('#bot-central-list .grokbot-central-card')].map((card) => card.textContent),
      unavailableConnector: document.querySelector('#bot-central-list .grokbot-central-card button[disabled]')?.textContent
    })`);
    assert.equal(botCentral.expanded, 'true', 'abrir Central anuncia o estado no controle');
    assert.equal(botCentral.rows, 2, 'Central lista perfis Bot sincronizados');
    assert.equal(botCentral.openButtons, 1, 'Central oferece ações de abertura apenas para outra janela');
    assert.match(botCentral.currentProfileText, /Perfil aberto nesta janela/, 'Central identifica sem botão o Bot já aberto');
    assert.equal(botCentral.currentProfileCursor, 'default', 'perfil aberto não aparenta ser uma ação de clique');
    assert.equal(botCentral.currentAvatarCursor, 'default', 'retrato do perfil atual também não aparenta ser clicável');
    assert.equal(botCentral.label, 'Bot Fixture', 'Central apresenta o nome do perfil');
    assert.equal(botCentral.dialog, 'dialog', 'Central mantém semântica de diálogo');
    assert.match(botCentral.summary, /tarefas especialistas usam o perfil atual/i, 'Central explica a diferença entre perfil isolado e tarefa especialista');
    assert.equal(botCentral.cards.some((text) => /Energia|R\$ 248/.test(text)), false, 'Central não mostra contas de demonstração como dados reais');
    assert.equal(botCentral.unavailableConnector, 'Conexões indisponíveis', 'Central não anuncia autorização externa simulada');

    await window.webContents.executeJavaScript("document.querySelector('#bot-central-list [data-bot-id=\"bot-other\"] [data-bot-action=\"archive\"]').click()");
    await new Promise((resolve) => setTimeout(resolve, 120));
    const archivedBot = await window.webContents.executeJavaScript(`({
      archived: document.querySelector('#bot-central-list [data-bot-id="bot-other"] [data-bot-action="restore"]')?.textContent,
      group: [...document.querySelectorAll('.bot-central-group-heading')].map((heading) => heading.textContent),
      focusedAction: document.activeElement?.dataset.botAction,
      opened: !!document.querySelector('#bot-central-list [data-bot-id="bot-other"] button.bot-central-open')
    })`);
    assert.equal(archivedBot.archived, 'Restaurar', 'arquivar move o Bot para a seção de arquivados');
    assert.ok(archivedBot.group.some((heading) => heading.startsWith('Arquivados (1)')), 'seção arquivada atualiza a contagem');
    assert.equal(archivedBot.focusedAction, 'restore', 'foco acompanha a ação depois de arquivar');
    assert.equal(archivedBot.opened, false, 'Bot arquivado não oferece nova abertura');
    await window.webContents.executeJavaScript("document.querySelector('#bot-central-list [data-bot-id=\"bot-other\"] [data-bot-action=\"restore\"]').click()");
    await new Promise((resolve) => setTimeout(resolve, 120));
    assert.equal(await window.webContents.executeJavaScript("document.querySelector('#bot-central-list [data-bot-id=\"bot-other\"] [data-bot-action=\"archive\"]')?.textContent"), 'Arquivar', 'restaurar retorna o Bot à seção ativa');
    await window.webContents.executeJavaScript("document.getElementById('btn-bot-central-close').click()");
    const botChatRestored = await window.webContents.executeJavaScript(`({
      visible: !document.getElementById('ai-panel').classList.contains('hidden'),
      inert: document.getElementById('ai-panel').inert,
      ariaHidden: document.getElementById('ai-panel').getAttribute('aria-hidden')
    })`);
    assert.deepEqual(botChatRestored, { visible: true, inert: false, ariaHidden: null }, 'fechar a Central restaura o chat acessível');

    const specialistFlow = await window.webContents.executeJavaScript(`(async () => {
      const initialTabId = window.app.activeTabId;
      window.app.openSpecialistBotModal('price-hunter');
      const modalVisible = !document.getElementById('bot-specialist-modal').classList.contains('hidden');
      const presetCount = document.querySelectorAll('#bot-specialist-presets .bot-specialist-preset-btn').length;
      const launched = await window.app.launchSpecialistBotFromModal();
      const keptBackground = window.app.activeTabId === initialTabId && launched.tabId !== initialTabId;
      const promoted = window.app.bringSpecialistBotToFront(launched.botId, 'goal_reached');
      const switchedToBotTab = window.app.activeTabId === launched.tabId;
      window.app.closeTab(launched.tabId);
      return { modalVisible, presetCount, keptBackground, promoted, switchedToBotTab };
    })()`);
    assert.equal(specialistFlow.modalVisible, true, 'clicar em Criar Bot abre o criador de Bot Especialista');
    assert.equal(specialistFlow.presetCount, 6, 'criador exibe as 6 especialidades prontas');
    assert.equal(specialistFlow.keptBackground, true, 'modo em 2º plano cria a aba do Bot sem roubar o foco da aba atual');
    assert.equal(specialistFlow.promoted && specialistFlow.switchedToBotTab, true, 'atingir a meta ou precisar de ação traz a aba do Bot automaticamente para frente');

    const grokbotSurface = await window.webContents.executeJavaScript(`(async () => {
      const briefingVisible = !document.getElementById('grokbot-briefing-bar')?.classList.contains('hidden');
      const stopHiddenWhenIdle = document.getElementById('btn-stop-task')?.classList.contains('hidden') === true;
      const idleStatusText = document.getElementById('grokbot-active-status')?.textContent?.trim();
      const railSpecBtns = [...document.querySelectorAll('#grokbot-rail-specialists .grokbot-rail-spec-btn')];
      const railSpecialistsCount = railSpecBtns.length;
      const hasSendBgBtn = !document.getElementById('btn-ai-send-bg')?.classList.contains('hidden');
      if (railSpecBtns[1]) railSpecBtns[1].click();
      const switchedSessionId = window.app.chatSession?.id || '';
      if (railSpecBtns[0]) railSpecBtns[0].click();
      const tabNames = [...document.querySelectorAll('.bot-panel-tab')].map((b) => b.dataset.botTab);
      window.app.switchBotPanelTab('routes');
      await new Promise((r) => setTimeout(r, 80));
      const routesText = document.getElementById('bot-view-routes')?.textContent || '';
      window.app.switchBotPanelTab('agenda');
      await new Promise((r) => setTimeout(r, 80));
      const agendaText = document.getElementById('bot-view-agenda')?.textContent || '';
      window.app.switchBotPanelTab('memory');
      await new Promise((r) => setTimeout(r, 80));
      const memoryText = document.getElementById('bot-view-memory')?.textContent || '';
      window.app.switchBotPanelTab('chat');
      const initialFgTab = window.app.activeTabId;
      window.app.aiConnected = true;
      const bgRun = await window.app.sendAiMessageInBackground('Encontre fone sem fio até R$ 150,00');
      const keptForeground = window.app.activeTabId === initialFgTab && bgRun.tabId !== initialFgTab;
      const hasStepper = document.querySelectorAll('.grokbot-stepper .grokbot-step-row').length === 4;
      const hasInlineReceipt = !!document.querySelector('.grokbot-inline-receipt');
      const hasConfirmCard = !!document.querySelector('.grokbot-confirm-card');
      const motorResultVisible = document.getElementById('ai-chat')?.textContent.includes('Resultado do motor de fixture.') === true;
      const notClaimedVerified = bgRun.taskVerified === false && document.querySelector('.grokbot-inline-receipt')?.textContent.includes('Revise o resultado') === true;
      const hasTechDrawer = !!document.querySelector('.grokbot-tech-drawer');
      const techClaimsAreLive = !document.querySelector('.grokbot-tech-drawer')?.textContent.includes('410ms')
        && !document.querySelector('.grokbot-tech-drawer')?.textContent.includes('27,3%');
      const visualControlsStayInSettings = document.querySelectorAll('.grokbot-tech-drawer button').length === 0;
      if (bgRun?.tabId) await window.app.closeTab(bgRun.tabId);
      return {
        briefingVisible,
        stopHiddenWhenIdle,
        idleStatusText,
        railSpecialistsCount,
        hasSendBgBtn,
        switchedBotSession: switchedSessionId.startsWith('bot-chat-'),
        keptForeground,
        tabNames,
        hasRoutesOrder: routesText.includes('WebMCP'),
        hasMandate: agendaText.includes('Mandato Delegado'),
        hasAutonomy: memoryText.includes('Autonomia Conquistada'),
        hasStepper,
        hasInlineReceipt,
        hasConfirmCard,
        motorResultVisible,
        notClaimedVerified,
        hasTechDrawer,
        techClaimsAreLive,
        visualControlsStayInSettings,
        hasProviderCards: document.querySelectorAll('#ai-provider-cards .grokbot-provider-card').length === 4
      };
    })()`);
    assert.equal(grokbotSurface.briefingVisible, true, 'barra do Bot Especialista ativo está visível');
    assert.equal(grokbotSurface.stopHiddenWhenIdle, true, 'botão Parar tudo fica oculto quando nenhuma tarefa está rodando');
    assert.equal(grokbotSurface.idleStatusText, '● Pronto', 'Bot Especialista inicia com estado Pronto em vez de tarefa fictícia');
    assert.ok(grokbotSurface.railSpecialistsCount >= 3, 'trilho lateral exibe os Bots Especialistas para troca direta de conversa');
    assert.equal(grokbotSurface.hasSendBgBtn, true, 'compositor tem botão dedicado Em 2º plano ao lado de Enviar');
    assert.equal(grokbotSurface.switchedBotSession, true, 'clicar em outro Bot Especialista troca para a conversa exclusiva daquele Bot');
    assert.equal(grokbotSurface.keptForeground, true, 'enviar ordem em 2º plano abre aba oculta do Bot mantendo a aba atual');
    assert.deepEqual(grokbotSurface.tabNames, ['chat', 'agenda', 'memory', 'routes', 'history'], 'painel do Bot tem as 5 abas GrokBot');
    assert.equal(grokbotSurface.hasRoutesOrder, true, 'aba Rotas exibe a ordem de preferência e rotas aprendidas');
    assert.equal(grokbotSurface.hasMandate, true, 'aba Agenda exibe gatilhos por evento e mandato com envelope');
    assert.equal(grokbotSurface.hasAutonomy, true, 'aba Memória exibe escada de autonomia conquistada');
    assert.equal(grokbotSurface.hasStepper, false, 'a interface não inventa passos que o motor não retornou');
    assert.equal(grokbotSurface.hasInlineReceipt, true, 'a execução mostra o estado do fluxo real do motor');
    assert.equal(grokbotSurface.hasConfirmCard, false, 'a interface não inventa uma aprovação sem ação pendente');
    assert.equal(grokbotSurface.motorResultVisible, true, 'a resposta do motor aparece na conversa');
    assert.equal(grokbotSurface.notClaimedVerified, true, 'encerrar o motor não é apresentado como resultado verificado');
    assert.equal(grokbotSurface.hasTechDrawer, true, 'conversa exibe a gaveta </> Técnico com motor, MCP, firewall e personalização');
    assert.equal(grokbotSurface.techClaimsAreLive, true, 'a gaveta não apresenta métricas fixas como medições atuais');
    assert.equal(grokbotSurface.visualControlsStayInSettings, true, 'preferências visuais ficam em Configurações, não no chat');
    assert.equal(grokbotSurface.hasProviderCards, true, 'Configurações exibe os cartões visuais de provedor de IA');

    await window.webContents.executeJavaScript("window.app.openLibrary('downloads')");
    assert.equal(await window.webContents.executeJavaScript("document.querySelector('.library-tab[aria-pressed=\"true\"]')?.dataset.modo"), 'downloads', 'modo ativo da biblioteca atualiza seu estado acessível');
    const emptyDownloads = await window.webContents.executeJavaScript("document.querySelectorAll('#library-list .library-row').length");
    assert.equal(emptyDownloads, 0, 'biblioteca de downloads inicia vazia na fixture');
    downloads = [{ id: 'd-ui-1', filename: 'relatorio.pdf', url: 'https://example.test/relatorio.pdf', state: 'completed', hasFile: true }];
    window.webContents.send('download:event', { filename: 'relatorio.pdf', state: 'completed' });
    await new Promise((resolve) => setTimeout(resolve, 180));
    const updatedDownloads = await window.webContents.executeJavaScript(`({
      rows: document.querySelectorAll('#library-list .library-row').length,
      title: document.querySelector('#library-list .library-open strong')?.textContent,
      reveal: document.querySelector('#library-list .library-reveal')?.textContent
    })`);
    assert.equal(updatedDownloads.rows, 1, 'biblioteca aberta atualiza a lista quando chega um download');
    assert.equal(updatedDownloads.title, 'relatorio.pdf', 'download recém-concluído aparece na biblioteca');
    assert.equal(updatedDownloads.reveal, 'Mostrar na pasta', 'download disponível mantém ação de revelar arquivo');

    for (const mode of ['history', 'bookmarks', 'downloads']) {
      await window.webContents.executeJavaScript(`document.querySelector('.library-tab[data-modo="${mode}"]').click()`);
      const selectedMode = await window.webContents.executeJavaScript(`({
        selected: document.querySelector('.library-tab[aria-pressed="true"]')?.dataset.modo,
        selectedCount: document.querySelectorAll('.library-tab[aria-pressed="true"]').length
      })`);
      assert.equal(selectedMode.selected, mode, `clicar em ${mode} atualiza o modo anunciado`);
      assert.equal(selectedMode.selectedCount, 1, `exatamente um modo fica selecionado depois de clicar em ${mode}`);
    }

    window.show();
    window.focus();
    await new Promise((resolve) => setTimeout(resolve, 100));
    await window.webContents.executeJavaScript("document.getElementById('btn-close-library').focus()");
    for (const expectedMode of ['history', 'bookmarks', 'downloads']) {
      sendTab(window.webContents);
      await new Promise((resolve) => setTimeout(resolve, 20));
      const focusedMode = await window.webContents.executeJavaScript(`document.activeElement?.matches('.library-tab') ? document.activeElement.dataset.modo : null`);
      assert.equal(focusedMode, expectedMode, `Tab alcança o botão ${expectedMode} na ordem de foco`);
    }

    sendTab(window.webContents, { shift: true });
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(await window.webContents.executeJavaScript("document.activeElement?.dataset.modo"), 'bookmarks', 'Shift+Tab volta ao botão Favoritos');
    await window.webContents.executeJavaScript("document.activeElement.click()");
    const focusedBookmarkActivation = await window.webContents.executeJavaScript(`({
      mode: document.querySelector('.library-tab[aria-pressed="true"]')?.dataset.modo,
      selectedCount: document.querySelectorAll('.library-tab[aria-pressed="true"]').length,
      focus: document.activeElement?.dataset.modo
    })`);
    assert.equal(focusedBookmarkActivation.mode, 'bookmarks', 'ativar o botão Favoritos atualiza aria-pressed');
    assert.equal(focusedBookmarkActivation.selectedCount, 1, 'um único modo fica pressionado após selecionar Favoritos');
    assert.equal(focusedBookmarkActivation.focus, 'bookmarks', 'trocar modo mantém o foco no botão Favoritos');

    sendTab(window.webContents);
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(await window.webContents.executeJavaScript("document.activeElement?.dataset.modo"), 'downloads', 'Tab avança de Favoritos para Downloads');
    await window.webContents.executeJavaScript("document.activeElement.click()");
    const focusedDownloadActivation = await window.webContents.executeJavaScript(`({
      mode: document.querySelector('.library-tab[aria-pressed="true"]')?.dataset.modo,
      selectedCount: document.querySelectorAll('.library-tab[aria-pressed="true"]').length,
      focus: document.activeElement?.dataset.modo
    })`);
    assert.equal(focusedDownloadActivation.mode, 'downloads', 'ativar o botão Downloads atualiza aria-pressed');
    assert.equal(focusedDownloadActivation.selectedCount, 1, 'um único modo fica pressionado após selecionar Downloads');
    assert.equal(focusedDownloadActivation.focus, 'downloads', 'trocar modo mantém o foco no botão Downloads');

    delayNextHistory = true;
    await window.webContents.executeJavaScript("window.app.openLibrary('history'); true");
    const historyDeadline = Date.now() + 2000;
    while (!deferredHistoryResolve && Date.now() < historyDeadline) await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(typeof deferredHistoryResolve, 'function', 'consulta do histórico deve ficar pendente para simular resposta atrasada');
    await window.webContents.executeJavaScript("window.app.openLibrary('downloads')");
    deferredHistoryResolve([{ title: 'Resposta antiga do histórico', url: 'https://example.test/old', lastVisitTime: Date.now() }]);
    await new Promise((resolve) => setTimeout(resolve, 30));
    const afterStaleHistory = await window.webContents.executeJavaScript(`({
      mode: document.getElementById('library-title')?.textContent,
      rows: document.querySelectorAll('#library-list .library-row').length,
      empty: document.querySelector('#library-list .library-empty')?.textContent
    })`);
    assert.equal(afterStaleHistory.mode, 'Downloads', 'a aba de downloads permanece selecionada depois da resposta atrasada');
    assert.equal(afterStaleHistory.rows, 1, 'resposta atrasada do histórico não pode substituir os downloads');
    assert.equal(await window.webContents.executeJavaScript("document.querySelector('#library-list .library-open strong')?.textContent"), 'relatorio.pdf', 'a lista continua mostrando o download atual');
    await window.webContents.executeJavaScript("window.app.closeLibrary(); window.app.toggleAiPanel(true)");

    const tabControls = await window.webContents.executeJavaScript(`(() => {
      const group = document.querySelector('#tabs-container');
      const tab = group?.querySelector('.tab-select');
      const close = group?.querySelector('.tab-close');
      return { role: group?.getAttribute('role'), nativeSelect: tab?.tagName === 'BUTTON',
        selected: tab?.getAttribute('aria-pressed'), closeName: close?.getAttribute('aria-label'),
        separate: Boolean(tab && close && !tab.contains(close)) };
    })()`);
    assert.equal(tabControls.role, 'group', 'tab controls use a labelled group instead of nesting interactive elements in role=tab');
    assert.equal(tabControls.nativeSelect, true, 'tab selection is a native button');
    assert.equal(tabControls.selected, 'true', 'active tab button exposes its pressed state');
    assert.match(tabControls.closeName || '', /^Fechar aba /, 'close button name includes the tab title');
    assert.equal(tabControls.separate, true, 'select and close are separate interactive controls');

    const countBefore = newTabCalls;
    await window.webContents.executeJavaScript("document.getElementById('btn-new-tab').click()");
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(newTabCalls, countBefore + 1, 'botão + deve solicitar uma nova aba');
    const keyboardTabs = await window.webContents.executeJavaScript(`(() => {
      const tabs = [...document.querySelectorAll('#tabs-container .tab-select')];
      const active = tabs.find((tab) => tab.getAttribute('aria-pressed') === 'true');
      if (tabs.length < 2 || !active) return null;
      active.focus();
      active.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
      return { count: tabs.length, selected: tabs.filter((tab) => tab.getAttribute('aria-pressed') === 'true').length,
        moved: document.activeElement !== active && document.activeElement?.classList.contains('tab-select'),
        focusedSelected: document.activeElement?.getAttribute('aria-pressed') === 'true',
        focusable: tabs.filter((tab) => tab.tabIndex === 0).length };
    })()`);
    assert.ok(keyboardTabs && keyboardTabs.count >= 2, 'abas precisam ser acessíveis por teclado');
    assert.equal(keyboardTabs.moved && keyboardTabs.focusedSelected, true, 'setas devem selecionar e focar a aba vizinha');
    assert.equal(keyboardTabs.selected, 1, 'somente uma aba fica selecionada');
    assert.equal(keyboardTabs.focusable, 1, 'somente a aba selecionada entra na ordem de tabulação');
    const layout = await window.webContents.executeJavaScript(`(() => {
      const more = document.querySelector('.ai-chat-more');
      more.open = true;
      const toolbar = document.querySelector('.ai-chat-toolbar');
      const menu = more.querySelector('.ai-chat-more-menu').getBoundingClientRect();
      const actions = [...more.querySelectorAll('button')].every((button) => button.getBoundingClientRect().width > 0);
      more.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return { fits: toolbar.scrollWidth <= toolbar.clientWidth + 1, menuVisible: menu.width > 0 && menu.height > 0, actions, closed: !more.open, focused: document.activeElement === more.querySelector('summary') };
    })()`);
    assert.equal(layout.fits, true, 'ações da conversa não devem transbordar a barra');
    assert.equal(layout.menuVisible && layout.actions, true, 'ações devem estar acessíveis no menu');
    assert.equal(layout.closed && layout.focused, true, 'Escape deve fechar o menu e devolver o foco');

    const appMenuFocus = await window.webContents.executeJavaScript(`(async()=>{
      const trigger = document.getElementById('btn-app-menu');
      await window.app.toggleAppMenu();
      await new Promise((resolve) => setTimeout(resolve, 20));
      const opened = !document.getElementById('app-menu').classList.contains('hidden')
        && document.activeElement?.getAttribute('role') === 'menuitem';
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return { opened, closed: document.getElementById('app-menu').classList.contains('hidden'),
        focusedTrigger: document.activeElement === trigger, expanded: trigger.getAttribute('aria-expanded') };
    })()`);
    assert.equal(appMenuFocus.opened, true, 'abrir o menu move o foco para um item do menu');
    assert.equal(appMenuFocus.closed && appMenuFocus.focusedTrigger, true, 'Escape fecha o menu e devolve o foco ao acionador');
    assert.equal(appMenuFocus.expanded, 'false', 'aria-expanded acompanha o fechamento do menu');

    await window.webContents.executeJavaScript('window.app.openExtensionsManager()');
    const actionControl = await window.webContents.executeJavaScript(`(() => {
      const button = document.querySelector('#extensions-list button[aria-label="Executar ação de Ação Fixture na aba atual"]');
      button?.focus();
      button?.click();
      return { tag: button?.tagName, label: button?.getAttribute('aria-label'), focused: document.activeElement === button,
        liveStatus: document.getElementById('toast-container')?.getAttribute('aria-live'), disabled: button?.disabled };
    })()`);
    assert.equal(actionControl.tag, 'BUTTON', 'extension action is a native button');
    assert.equal(actionControl.label, 'Executar ação de Ação Fixture na aba atual', 'the action has a descriptive accessible name');
    assert.equal(actionControl.focused && actionControl.disabled === false, true, 'the action remains keyboard-focusable');
    assert.equal(actionControl.liveStatus, 'polite', 'action feedback is announced to assistive technology');
    assert.equal(extensionActionCalls, 0, 'a synthetic DOM click cannot grant temporary activeTab access');

    // Nova aba: script e estilo externos precisam rodar sob a CSP.
    const newtab = new BrowserWindow({ width: 1024, height: 768, show: Boolean(process.env.ZERO_UI_CAPTURE_DIR), webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
    watch(newtab, 'newtab');
    const newtabLoaded = new Promise((resolve, reject) => {
      newtab.webContents.once('did-finish-load', resolve);
      newtab.webContents.once('did-fail-load', (_e, code, description) => reject(new Error(`${code} ${description}`)));
    });
    await newtab.loadFile(path.join(rendererDir, 'newtab.html'));
    await newtabLoaded;
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const page = await newtab.webContents.executeJavaScript(`(() => ({
      clock: (document.getElementById('live-clock')?.textContent || '').trim().length,
      greeting: (document.getElementById('greeting-title')?.textContent || '').trim(),
      background: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
      hasInlineScript: !!document.querySelector('script:not([src])'),
      hasInlineStyle: !!document.querySelector('style')
    }))()`);
    assert.ok(page.clock > 0, 'newtab.js não executou (relógio vazio)');
    assert.ok(page.greeting.length > 0, 'saudação dinâmica não apareceu');
    assert.ok(page.background.length > 0, 'newtab.css não aplicado');
    assert.equal(page.hasInlineScript, false, 'ainda há script inline na nova aba');
    assert.equal(page.hasInlineStyle, false, 'ainda há estilo inline na nova aba');
    const { applyNewtabTheme } = require('../src/main/newtab-theme');
    const newtabPath = path.join(rendererDir, 'newtab.html');
    assert.equal(await applyNewtabTheme(newtab.webContents, newtabPath, false), true);
    const lightBackground = await newtab.webContents.executeJavaScript("getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()");
    assert.equal(await applyNewtabTheme(newtab.webContents, newtabPath, true), true);
    const darkBackground = await newtab.webContents.executeJavaScript("getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()");
    assert.notEqual(lightBackground, darkBackground, 'a nova aba deve trocar a paleta ao mudar o tema');
    if (process.env.ZERO_UI_CAPTURE_DIR) {
      const fs = require('node:fs');
      for (const [name, dark] of [['light', false], ['dark', true]]) {
        await applyNewtabTheme(newtab.webContents, newtabPath, dark);
        await new Promise((resolve) => setTimeout(resolve, 300));
        fs.writeFileSync(path.join(process.env.ZERO_UI_CAPTURE_DIR, `newtab-${name}.png`), (await newtab.webContents.capturePage()).toPNG());
      }
      newtab.setContentSize(500, 800);
      await new Promise((resolve) => setTimeout(resolve, 300));
      fs.writeFileSync(path.join(process.env.ZERO_UI_CAPTURE_DIR, 'newtab-narrow.png'), (await newtab.webContents.capturePage()).toPNG());
    }
    let agentRequests = 0;
    newtab.webContents.on('did-start-navigation', (_event, url) => { if (url.endsWith('#open-copilot')) agentRequests++; });
    const actions = await newtab.webContents.executeJavaScript(`(() => {
      const search = document.getElementById('search-input');
      const focusButton = document.getElementById('action-focus-search');
      const agentButton = document.getElementById('action-copilot');
      focusButton.click();
      const focused = document.activeElement === search;
      agentButton.click();
      const first = location.hash;
      return { focused, first, native: focusButton.tagName === 'BUTTON' && agentButton.tagName === 'BUTTON', label: search.getAttribute('aria-label') };
    })()`);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await newtab.webContents.executeJavaScript("document.getElementById('action-copilot').click()");
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(actions.focused, true, 'atalho de pesquisa deve focar a busca');
    assert.equal(actions.native, true, 'ações devem ser botões nativos acessíveis pelo teclado');
    assert.ok(actions.label, 'campo de busca precisa de nome acessível');
    assert.equal(actions.first, '#open-copilot');
    assert.equal(agentRequests, 2, 'o agente deve abrir novamente após fechar o painel');
    newtab.destroy();
  } catch (error) {
    failures.push(String(error?.message || error));
  }

  if (!window.isDestroyed()) window.destroy();
  if (failures.length) {
    process.stderr.write(`${failures.join('\n')}\n`);
    app.exit(1);
    return;
  }
  process.stdout.write(`${JSON.stringify({ status: 'PASS', messages: messages.length })}\n`);
  app.exit(0);
});

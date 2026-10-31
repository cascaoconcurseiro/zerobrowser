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

// O painel conversa com o main por IPC; aqui basta responder o suficiente para o init não travar.
const stubs = {
  'store:getAll': () => ({}),
  'store:get': () => null,
  'store:set': () => true,
  'browser:get-last-session': () => [],
  'browser:get-tabs': () => [],
  'browser:get-side-panel-layout': () => ({ open: false }),
  'browser:app-info': () => ({ version: '0.1.43-dev', profile: 'Principal' }),
  'browser:freeze-page': () => null,
  'browser:set-side-panel-open': () => true,
  'automation:jobs': () => [],
  'automation:memory': () => [],
  'browser:new-tab': () => ({ tabId: `tab-smoke-${++newTabCalls}` }),
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
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  watch(window, 'index');

  try {
    const loaded = new Promise((resolve, reject) => {
      window.webContents.once('did-finish-load', resolve);
      window.webContents.once('did-fail-load', (_e, code, description) => reject(new Error(`${code} ${description}`)));
    });
    await window.loadFile(path.join(rendererDir, 'index.html'));
    await loaded;
    await new Promise((resolve) => setTimeout(resolve, 800));

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
    assert.equal(shell.aiButtonLabel, 'Delegar', 'toolbar precisa indicar o modo de delegação');
    assert.equal(shell.manageChat, true, 'ações de conversa ausentes');

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

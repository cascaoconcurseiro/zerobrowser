// Smoke de UI: garante que a CSP não bloqueou a casca (app.js, markdown.js, CSS) e que a nova aba executa.
// Roda com: npm run test:ui  (electron scripts/electron-ui.integration.js)
const { app, BrowserWindow, ipcMain } = require('electron');
const assert = require('node:assert/strict');
const path = require('node:path');

const rendererDir = path.join(__dirname, '..', 'src', 'renderer');
const failures = [];
const messages = [];
let newTabCalls = 0;

// O painel conversa com o main por IPC; aqui basta responder o suficiente para o init não travar.
const stubs = {
  'store:getAll': () => ({}),
  'store:get': () => null,
  'store:set': () => true,
  'browser:get-last-session': () => [],
  'browser:get-tabs': () => [],
  'browser:get-side-panel-layout': () => ({ open: false }),
  'browser:set-side-panel-open': () => true,
  'automation:jobs': () => [],
  'automation:memory': () => [],
  'browser:new-tab': () => ({ tabId: `tab-smoke-${++newTabCalls}` }),
  'browser:switch-tab': () => ({ tabId: 'tab-smoke' }),
  'browser:set-bookmarks-bar': () => true,
  'flame:status': () => ({ available: false }),
  'library:bookmarks': () => [],
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
      tipografia: getComputedStyle(document.querySelector('.ai-message')).fontSize,
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
    assert.equal(shell.tipografia, '13px', `escala tipografica do chat fora do padrao (${shell.tipografia})`);
    assert.equal(shell.manageChat, true, 'ações de conversa ausentes');

    const countBefore = newTabCalls;
    await window.webContents.executeJavaScript("document.getElementById('btn-new-tab').click()");
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(newTabCalls, countBefore + 1, 'botão + deve solicitar uma nova aba');
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

    // Nova aba: script e estilo externos precisam rodar sob a CSP.
    const newtab = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
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
    newtab.destroy();
  } catch (error) {
    failures.push(String(error?.message || error));
  }

  if (failures.length) {
    process.stderr.write(`${failures.join('\n')}\n`);
    app.exit(1);
    return;
  }
  process.stdout.write(`${JSON.stringify({ status: 'PASS', messages: messages.length })}\n`);
  app.exit(0);
});

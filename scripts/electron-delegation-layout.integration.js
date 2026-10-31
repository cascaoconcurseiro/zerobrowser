// Verifica apenas o encaixe responsivo da Central e seus alvos de toque/foco.
const { app, BrowserWindow, ipcMain } = require('electron');
const assert = require('node:assert/strict');
const path = require('node:path');

const rendererDir = path.join(__dirname, '..', 'src', 'renderer');
const bots = [
  { id: 'bot-current', name: 'Bot Atual', avatarId: 'pixel-001', avatar: { sheetId: 'pixel-animals-01', frameIndex: 0, columns: 10, rows: 10, accent: '#129b78' } },
  { id: 'bot-other', name: 'Bot Outro', avatarId: 'pixel-002', avatar: { sheetId: 'pixel-animals-01', frameIndex: 1, columns: 10, rows: 10, accent: '#1686d9' } }
];

const stubs = {
  'store:getAll': () => ({}),
  'store:get': () => null,
  'store:set': () => true,
  'browser:get-last-session': () => [],
  'browser:get-tabs': () => [],
  'browser:get-side-panel-layout': () => ({ open: false }),
  'browser:get-bots': () => ({ bots, avatars: 200, currentProfileId: 'bot-current' }),
  'browser:get-bot-avatar-sheet': () => null,
  'browser:app-info': () => ({ version: '0.1.47-dev', profile: 'Fixture' }),
  'browser:freeze-page': () => null,
  'browser:set-side-panel-open': () => true,
  'browser:new-tab': () => ({ tabId: 'delegation-layout-tab' }),
  'browser:switch-tab': () => ({ tabId: 'delegation-layout-tab' }),
  'browser:set-bookmarks-bar': () => true,
  'automation:jobs': () => [],
  'automation:memory': () => [],
  'ai:get-config': () => ({ provider: 'openrouter', model: '', hasApiKey: false, keyHint: '' }),
  'flame:status': () => ({ available: false }),
  'library:bookmarks': () => [],
  'library:import-sources': () => [],
  'library:history': () => [],
  'library:suggest': () => []
};

for (const [channel, handler] of Object.entries(stubs)) ipcMain.handle(channel, handler);

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: 1000,
    height: 800,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'src', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  try {
    const loaded = new Promise((resolve, reject) => {
      window.webContents.once('did-finish-load', resolve);
      window.webContents.once('did-fail-load', (_event, code, description) => reject(new Error(`${code} ${description}`)));
    });
    await window.loadFile(path.join(rendererDir, 'index.html'));
    await loaded;
    await new Promise((resolve) => setTimeout(resolve, 500));

    window.show();
    window.focus();
    await window.webContents.executeJavaScript("document.getElementById('btn-bot-central').click()");
    await new Promise((resolve) => setTimeout(resolve, 80));

    for (const width of [700, 400]) {
      window.setSize(width, 800);
      await new Promise((resolve) => setTimeout(resolve, 100));
      const layout = await window.webContents.executeJavaScript(`(() => {
        const dialog = document.getElementById('bot-central');
        const close = document.getElementById('btn-bot-central-close');
        const create = document.getElementById('btn-bot-central-new');
        const rect = dialog.getBoundingClientRect();
        return {
          viewportWidth: document.documentElement.clientWidth,
          left: rect.left,
          right: rect.right,
          width: rect.width,
          closeWidth: close.getBoundingClientRect().width,
          closeHeight: close.getBoundingClientRect().height,
          createHeight: create.getBoundingClientRect().height
        };
      })()`);
      assert.ok(layout.left >= 0, `Central deve ficar dentro da janela em ${width}px (${JSON.stringify(layout)})`);
      assert.ok(layout.right <= layout.viewportWidth, `Central não pode cortar a borda direita em ${width}px (${JSON.stringify(layout)})`);
      assert.ok(layout.closeWidth >= 44 && layout.closeHeight >= 44, `Fechar precisa de alvo de 44px em ${width}px (${JSON.stringify(layout)})`);
      assert.ok(layout.createHeight >= 44, `Criar Bot precisa de alvo de 44px em ${width}px (${JSON.stringify(layout)})`);
    }

    window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'ESC' });
    window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'ESC' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    const focus = await window.webContents.executeJavaScript(`({
      closed: document.getElementById('bot-central').classList.contains('hidden'),
      triggerExpanded: document.getElementById('btn-bot-central').getAttribute('aria-expanded'),
      activeElement: document.activeElement?.id
    })`);
    assert.equal(focus.closed, true, 'Escape fecha a Central');
    assert.equal(focus.triggerExpanded, 'false', 'Escape sincroniza aria-expanded');
    assert.equal(focus.activeElement, 'btn-bot-central', 'Escape retorna o foco ao acionador');

    process.stdout.write(JSON.stringify({ status: 'PASS', widths: [700, 400], focus }) + '\n');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    window.destroy();
    app.quit();
  }
});

// Verifica o contrato visual da Central de Bots e do modo Delegar em telas largas, estreitas e baixas.
const { app, BrowserWindow, ipcMain } = require('electron');
const assert = require('node:assert/strict');
const path = require('node:path');
const { BOT_ACCENT_PALETTE, BOT_STROKE_SYMBOLS } = require('../src/main/bot-avatar-catalog');

const rendererDir = path.join(__dirname, '..', 'src', 'renderer');
const bots = Array.from({ length: 32 }, (_unused, index) => {
  const current = index === 0;
  const id = current ? 'bot-current' : `bot-${String(index).padStart(2, '0')}`;
  return {
    id,
    name: current ? 'Bot Atual' : index === 31 ? 'Bot de automação com nome longo para validar encaixe' : `Bot ${String(index).padStart(2, '0')}`,
    avatarId: `pixel-${String(index + 1).padStart(3, '0')}`,
    avatar: {
      sheetId: 'pixel-animals-01',
      frameIndex: index,
      columns: 10,
      rows: 10,
      accent: BOT_ACCENT_PALETTE[index % BOT_ACCENT_PALETTE.length],
      symbolId: BOT_STROKE_SYMBOLS[Math.floor(index / BOT_ACCENT_PALETTE.length) % BOT_STROKE_SYMBOLS.length].id,
      symbolPath: BOT_STROKE_SYMBOLS[Math.floor(index / BOT_ACCENT_PALETTE.length) % BOT_STROKE_SYMBOLS.length].path
    }
  };
});

let testWindow = null;
let sidePanelOpen = false;
let sidePanelPosition = 'left';
let sidePanelWidthOverride = null;
let activeViewportWidth = 1584;

function mockSidePanelLayout() {
  const width = testWindow?.getContentBounds().width || 1200;
  const compact = width <= 800;
  const railWidth = sidePanelOpen && sidePanelPosition === 'left' ? (compact ? 64 : 80) : 0;
  const available = Math.max(0, width - railWidth - (compact ? 160 : 320));
  const maximum = Math.min(640, available);
  const minimum = Math.min(compact ? 160 : 240, maximum);
  const defaultWidth = compact
    ? (width <= 480 ? maximum : Math.min(360, Math.floor(width * 0.4)))
    : Math.min(640, Math.floor(width * 0.44));
  const panelWidth = Math.max(minimum, Math.min(maximum, sidePanelWidthOverride ?? defaultWidth));
  return {
    open: sidePanelOpen,
    panelWidth,
    railWidth,
    contentTop: 112,
    bounds: sidePanelOpen && sidePanelPosition === 'left'
      ? { x: railWidth + panelWidth, y: 112, width: Math.max(1, width - railWidth - panelWidth), height: 600 }
      : null
  };
}

const stubs = {
  'store:getAll': () => ({}),
  'store:get': () => null,
  'store:set': () => true,
  'browser:get-last-session': () => [],
  'browser:get-tabs': () => [],
  'browser:get-side-panel-layout': () => mockSidePanelLayout(),
  'browser:get-bots': () => ({ bots, avatars: 200, currentProfileId: 'bot-current' }),
  'browser:get-bot-avatar-sheet': () => null,
  'browser:app-info': () => ({ version: '0.1.47-dev', profile: 'Fixture' }),
  'browser:freeze-page': () => null,
  'browser:set-side-panel-open': (_event, state) => {
    const normalized = state && typeof state === 'object' ? state : { open: state === true };
    sidePanelOpen = normalized.open === true;
    sidePanelPosition = normalized.position === 'left' ? 'left' : 'right';
    return mockSidePanelLayout();
  },
  'browser:set-side-panel-width': (_event, width) => {
    sidePanelWidthOverride = width;
    return mockSidePanelLayout();
  },
  'browser:new-tab': () => ({ tabId: 'delegation-layout-tab' }),
  'browser:switch-tab': () => ({ tabId: 'delegation-layout-tab' }),
  'browser:set-bookmarks-bar': () => true,
  'automation:jobs': () => [],
  'automation:cancel-agent': () => true,
  'automation:memory': () => [],
  'bots:get-presets': () => require('../src/bots/bot-store').SPECIALIST_BOT_PRESETS,
  'bots:get-symbols': () => BOT_STROKE_SYMBOLS,
  'bots:list-tasks': () => [],
  'bots:create-task': (_e, spec) => ({ id: 'bot-layout-1', ...spec }),
  'bots:run-now': () => ({ status: 'completed' }),
  'bots:stop-all': () => ({ stoppedCount: 0, elapsedMs: 0 }),
  'bots:run-missed-schedules': () => [],
  'routes:list': () => [],
  'connectors:status': () => ({ connectors: [], telegramSenders: [] }),
  'live-apps:list': () => [],
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
    width: 1584,
    height: 966,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'src', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  testWindow = window;

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
    const displayScaleFactor = await window.webContents.executeJavaScript('window.devicePixelRatio || 1');
    await window.webContents.executeJavaScript(`(() => {
      const app = document.getElementById('app');
      if (!app.classList.contains('delegation-mode')) document.getElementById('btn-ai').click();
    })()`);
    await new Promise((resolve) => setTimeout(resolve, 80));
    await window.webContents.executeJavaScript('window.app.applyDelegationPanelWidth(320)');
    await window.webContents.executeJavaScript('window.app.openBotSettings()');
    await new Promise((resolve) => setTimeout(resolve, 100));

    const viewports = [
      { width: 1584, height: 966 },
      { width: 1402, height: 901 },
      { width: 700, height: 800 },
      { width: 700, height: 600 },
      { width: 400, height: 800 },
      { width: 400, height: 600 }
    ];
    const measurements = [];

    for (const viewport of viewports) {
      activeViewportWidth = viewport.width;
      if (window.isMaximized()) window.unmaximize();
      window.setSize(Math.ceil(viewport.width / displayScaleFactor), Math.ceil(viewport.height / displayScaleFactor));
      window.center();
      await new Promise((resolve) => setTimeout(resolve, 100));
      await window.webContents.executeJavaScript('window.app.syncDelegationPanelWidth()');
      const nativeBounds = window.getBounds();

      const layout = await window.webContents.executeJavaScript(`(() => {
        const px = (value) => Number.parseFloat(value) || 0;
        const rgb = (value) => {
          const match = value.match(/rgba?\\((\\d+(?:\\.\\d+)?)[, ]+\\s*(\\d+(?:\\.\\d+)?)[, ]+\\s*(\\d+(?:\\.\\d+)?)(?:[, /]+\\s*(\\d*(?:\\.\\d+)?))?\\)/i);
          if (!match) return null;
          return [Number(match[1]), Number(match[2]), Number(match[3]), match[4] === undefined ? 1 : Number(match[4])];
        };
        const composite = (top, bottom) => {
          const alpha = top[3];
          return [
            top[0] * alpha + bottom[0] * (1 - alpha),
            top[1] * alpha + bottom[1] * (1 - alpha),
            top[2] * alpha + bottom[2] * (1 - alpha),
            1
          ];
        };
        const effectiveBackground = (element) => {
          let color = [255, 255, 255, 1];
          for (let node = element; node; node = node.parentElement) {
            const parsed = rgb(getComputedStyle(node).backgroundColor);
            if (parsed && parsed[3] > 0) color = composite(parsed, color);
            if (parsed && parsed[3] >= 0.999) break;
          }
          return color;
        };
        const luminance = (color) => {
          const channels = color.slice(0, 3).map((value) => {
            const s = value / 255;
            return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
        };
        const contrast = (foreground, background) => {
          const a = luminance(foreground);
          const b = luminance(background);
          return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        };

        const dialog = document.getElementById('bot-central');
        const list = document.getElementById('bot-central-list');
        const rail = document.getElementById('delegation-rail');
        const panel = document.getElementById('ai-panel');
        const panelWasHidden = panel.classList.contains('hidden');
        panel.classList.remove('hidden');
        const expectedPanelWidth = panel.getBoundingClientRect().width;
        if (panelWasHidden) panel.classList.add('hidden');
        const toolbar = document.getElementById('toolbar');
        const address = document.getElementById('address-bar');
        const aiButton = document.getElementById('btn-ai');
        const resizer = document.getElementById('delegation-resizer');
        const label = aiButton.querySelector('.ai-copilot-label');
        const dialogRect = dialog.getBoundingClientRect();
        const avatar = dialog.querySelector('.bot-avatar');
        const sprite = avatar?.querySelector('.bot-avatar-symbol');
        const avatarRect = avatar?.getBoundingClientRect();
        const spriteRect = sprite?.getBoundingClientRect();
        const listRect = list.getBoundingClientRect();
        const railRect = rail.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();
        const footerRect = dialog.querySelector('.bot-central-footer').getBoundingClientRect();
        const color = rgb(getComputedStyle(address).color);
        const background = effectiveBackground(address);
        list.scrollTop = list.scrollHeight;
        const firstRow = list.firstElementChild?.getBoundingClientRect();
        const lastRow = list.lastElementChild?.getBoundingClientRect();
        return {
          viewport: { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight },
          requestedWindow: { width: ${viewport.width}, height: ${viewport.height} },
          dialog: { left: dialogRect.left, top: dialogRect.top, right: dialogRect.right, bottom: dialogRect.bottom, width: dialogRect.width, height: dialogRect.height },
          expectedPanel: { left: railRect.right, right: railRect.right + expectedPanelWidth, width: expectedPanelWidth },
          splitter: {
            visible: Boolean(resizer.getClientRects().length),
            role: resizer.getAttribute('role'),
            valueNow: Number(resizer.getAttribute('aria-valuenow')),
            panelWidth: Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--delegation-panel-width'))
          },
          underlyingChatHidden: panel.classList.contains('hidden'),
          avatar: avatarRect && spriteRect ? {
            frameWidth: avatarRect.width,
            frameHeight: avatarRect.height,
            spriteWidth: spriteRect.width,
            spriteHeight: spriteRect.height,
            hasMascot: Boolean(sprite.querySelector('img.bot-mascot[src]')),
            centerXDelta: Math.abs((avatarRect.left + avatarRect.right) / 2 - (spriteRect.left + spriteRect.right) / 2),
            centerYDelta: Math.abs((avatarRect.top + avatarRect.bottom) / 2 - (spriteRect.top + spriteRect.bottom) / 2)
          } : null,
          pixelAvatarCount: dialog.querySelectorAll('.pixel-avatar').length,
          visibleAvatarMarks: dialog.querySelectorAll('.bot-avatar-symbol img.bot-mascot[src]').length,
          list: {
            clientHeight: list.clientHeight,
            scrollHeight: list.scrollHeight,
            scrollTop: list.scrollTop,
            firstRowTop: firstRow?.top ?? null,
            lastRowBottom: lastRow?.bottom ?? null,
            top: listRect.top,
            bottom: listRect.bottom,
            footerTop: footerRect.top,
            footerBottom: footerRect.bottom
          },
          buttons: [...dialog.querySelectorAll('button')].map((button) => {
            const rect = button.getBoundingClientRect();
            return { label: button.getAttribute('aria-label') || button.textContent.trim(), width: rect.width, height: rect.height };
          }),
          toolbar: { clientWidth: toolbar.clientWidth, scrollWidth: toolbar.scrollWidth },
          address: {
            visible: Boolean(address.getClientRects().length) && getComputedStyle(address).visibility !== 'hidden',
            textColor: getComputedStyle(address).color,
            backgroundColor: 'rgb(' + background.slice(0, 3).map(Math.round).join(', ') + ')',
            contrast: color ? contrast(color, background) : 0
          },
          aiButton: {
            visible: Boolean(aiButton.getClientRects().length) && getComputedStyle(aiButton).visibility !== 'hidden',
            label: label?.textContent.trim() || '',
            accessibleLabel: aiButton.getAttribute('aria-label')
          }
        };
      })()`);

      const message = `${viewport.width}x${viewport.height} scale=${displayScaleFactor} native=${JSON.stringify(nativeBounds)}: ${JSON.stringify(layout)}`;
      const tolerance = 1.5;
      assert.ok(layout.dialog.width > 0 && layout.dialog.height > 0, `Bots nas Configurações tem área visível; ${message}`);
      assert.ok(layout.splitter.panelWidth <= (viewport.width <= 800 ? 360 : Math.min(640, Math.floor(viewport.width * 0.44)) + 16) + tolerance, `largura inicial do painel acompanha o padrão compacto; ${message}`);
      assert.ok(layout.avatar, `Avatar aparece na Central; ${message}`);
      assert.ok(layout.avatar.spriteWidth < layout.avatar.frameWidth && layout.avatar.spriteHeight < layout.avatar.frameHeight, `Símbolo cabe dentro do círculo; ${message}`);
      assert.ok(layout.avatar.centerXDelta <= 1 && layout.avatar.centerYDelta <= 1, `Símbolo fica centralizado no círculo; ${message}`);
      assert.ok(layout.avatar.hasMascot, `Mascote individual está presente no avatar; ${message}`);
      assert.equal(layout.pixelAvatarCount, 0, `Avatares pixelados não são renderizados; ${message}`);
      assert.ok(layout.visibleAvatarMarks > 0, `Mascotes aparecem nos Bots das Configurações; ${message}`);

      assert.ok(layout.list.lastRowBottom <= layout.list.bottom + tolerance, `Última linha aparece inteira após rolagem, sem clipping; ${message}`);
      assert.ok(layout.list.footerTop >= layout.list.bottom - tolerance, `Rodapé fica fora da área rolável; ${message}`);
      assert.ok(layout.list.footerBottom <= layout.dialog.bottom + tolerance, `Rodapé permanece dentro da Central; ${message}`);

      assert.ok(layout.buttons.length >= 2, `Central apresenta seus controles acessíveis; ${message}`);
      for (const button of layout.buttons) {
        assert.ok(button.width >= 44 && button.height >= 44, `Botão "${button.label}" tem alvo mínimo de 44px; ${message}`);
      }
      assert.ok(layout.toolbar.scrollWidth <= layout.toolbar.clientWidth + tolerance, `Toolbar não transborda horizontalmente; ${message}`);
      assert.ok(layout.address.visible, `Campo de endereço está visível; ${message}`);
      assert.ok(layout.address.contrast >= 4.5, `Texto do endereço tem contraste mínimo de 4.5:1 (${layout.address.contrast.toFixed(2)}:1); ${message}`);
      assert.ok(layout.aiButton.visible && layout.aiButton.label === 'Delegar', `Botão do modo ativo mostra "Delegar"; ${message}`);
      measurements.push(layout);
    }

    const focus = {};

    window.setSize(Math.ceil(1584 / displayScaleFactor), Math.ceil(966 / displayScaleFactor));
    await new Promise((resolve) => setTimeout(resolve, 120));
    const splitter = await window.webContents.executeJavaScript(`(async () => {
      if (window.app.isBotSettingsOpen()) await window.app.toggleSettingsPanel();
      const divider = document.getElementById('delegation-resizer');
      const before = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--delegation-panel-width'));
      divider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 80));
      const after = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--delegation-panel-width'));
      return { before, after, valueNow: Number(divider.getAttribute('aria-valuenow')), panel: document.getElementById('ai-panel').getBoundingClientRect().width };
    })()`);
    assert.equal(splitter.after, Math.min(splitter.before + 24, 640), `tecla de seta respeita a largura máxima do painel (${JSON.stringify(splitter)})`);
    assert.equal(splitter.valueNow, splitter.after, 'ARIA anuncia a largura efetivamente aplicada');

    const takeoverAndStates = await window.webContents.executeJavaScript(`(async () => {
      window.app.aiRunning = true;
      window.app.runningAgentTabId = window.app.activeTabId;
      window.app.syncControlledTabIndicator();
      const workingState = {
        bannerVisible: !document.getElementById('tab-control-banner').classList.contains('hidden'),
        bannerText: document.getElementById('tab-control-label').textContent,
        actionText: document.getElementById('btn-tab-takeover').textContent,
        tabControlled: document.querySelector('.tab.active')?.classList.contains('tab-controlled') === true
      };

      document.getElementById('btn-tab-takeover').click();
      await new Promise((resolve) => setTimeout(resolve, 50));
      const pausedState = {
        bannerVisible: !document.getElementById('tab-control-banner').classList.contains('hidden'),
        bannerPausedClass: document.getElementById('tab-control-banner').classList.contains('is-paused'),
        actionText: document.getElementById('btn-tab-takeover').textContent
      };

      document.getElementById('btn-tab-takeover').click();
      await new Promise((resolve) => setTimeout(resolve, 50));
      const resumedState = {
        bannerHidden: document.getElementById('tab-control-banner').classList.contains('hidden')
      };

      return { workingState, pausedState, resumedState };
    })()`);
    assert.equal(takeoverAndStates.workingState.bannerVisible, true, 'faixa de controle da aba aparece enquanto o agente roda');
    assert.equal(takeoverAndStates.workingState.actionText, 'Assumir', 'botão Assumir fica disponível na faixa da aba');
    assert.equal(takeoverAndStates.workingState.tabControlled, true, 'aba ativa recebe destaque visual de aba controlada');
    assert.equal(takeoverAndStates.pausedState.bannerPausedClass, true, 'faixa reflete estado pausado');
    assert.equal(takeoverAndStates.pausedState.actionText, 'Devolver ao bot', 'botão muda para Devolver ao bot após assumir');
    assert.equal(takeoverAndStates.resumedState.bannerHidden, true, 'devolver ao bot sem prompt pendente recolhe a faixa de pausa');

    process.stdout.write(JSON.stringify({ status: 'PASS', viewports, measurements, focus }) + '\n');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    window.destroy();
    app.quit();
  }
});

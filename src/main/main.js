const { app, BrowserWindow, WebContentsView, Menu, session, ipcMain, dialog, shell, screen, webContents, nativeTheme, net, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const store = require('../store');
const { setupIpc, setAutomationService, setProviderFetch, getAgentConfig } = require('../ipc');
const { AutomationService } = require('../automation/service');
const { shouldAutoGrantGooglePermission } = require('./permissions');
const { rewriteRequestHeaders, rewriteResponseHeaders, makeUniqueDownloadPath } = require('./browser-policy');
const { ExtensionHost } = require('./extensions/extension-host');
const { runFlameTask, seedFlameSettings, waitFor } = require('./extensions/flame-runner');
const { Library } = require('./library');
const libraryImport = require('./library/import');
const { browserShortcutForInput } = require('./browser-shortcuts');
const { loadDownloadHistory, saveDownloadHistory, nextDownloadSequence, DEFAULT_LIMIT: DOWNLOAD_HISTORY_LIMIT } = require('./download-history');
const { buildTabMenuTemplate } = require('./tab-menu');
const profiles = require('./profiles');
const { zeroEnv } = require('../env');
const { spawn } = require('child_process');

// Keep the legacy internal name so a visible rebrand does not move the existing userData folder.
app.setName('navegante');

// Pasta de dados alternativa (testes lado a lado com o Zero Browser instalado). Precisa vir antes de qualquer getPath.
if (zeroEnv('USER_DATA')) app.setPath('userData', path.resolve(zeroEnv('USER_DATA')));

// No Windows, o Chromium trata a janela coberta por outras como escondida e para de desenhar: a aba do agente congela
// (listas não carregam, capturas e cliques esperam segundos). O agente precisa trabalhar com o Zero Browser atrás de outras janelas.
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

// Early error logging
const logFile = path.join(app.getPath('userData'), 'navegante-error.log');
function logError(err) {
  const msg = `${new Date().toISOString()} ${err.stack || err}\n`;
  try {
    fs.appendFileSync(logFile, msg);
  } catch {}
}

process.on('uncaughtException', logError);
process.on('unhandledRejection', logError);

let mainWindow = null;
let automationService = null;
const browserViews = new Map(); // tabId -> { view, webContents, partition, browserId }
const pendingInterventions = new Map(); // intervention id -> resolve('continue' | 'cancel')
const browserSessions = new Set();
const configuredSessions = new WeakSet();
let nextTabId = 1;
let nextBrowserId = 1;
let activeBrowserTabId = null;
let quitCleanupStarted = false;
let quitCleanupComplete = false;
let sidePanelOpen = false;
const PROFILE_PARTITION = 'persist:navegante';
const FLAME_PANEL_WIDTH = 420;
let extensionHost = null;
const flamePanels = new Map(); // tabId -> WebContentsView do painel do Flame daquela aba
let flamePanelHidden = false;
let library = null; // favoritos e histórico (SQLite)
const closedTabs = []; // para Ctrl+Shift+T
const BOOKMARKS_BAR_HEIGHT = 32;
let bookmarksBarVisible = false;
let shuttingDown = false; // ao sair, as abas fecham uma a uma e não devem apagar a sessão salva
let sessionSaveTimer = null;
let pageFrozen = false;
const pageFreezeReasons = new Set();

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    mainWindow.show();
  } else {
    createMainWindow();
  }
});

async function initializeApp() {
  await store.setupStore();
  const providerFetch = (...args) => net.fetch(...args);
  setProviderFetch(providerFetch);
  setupIpc();
  nativeTheme.on('updated', () => {
    const selectedTheme = store.getStore().get('theme') || 'system';
    if (selectedTheme === 'system') applyWindowTheme(selectedTheme);
  });
  automationService = new AutomationService();
  automationService.setFetchImplementation(providerFetch);
  automationService.setClipboard({ readText: () => clipboard.readText(), writeText: (text) => clipboard.writeText(String(text)) });
  automationService.setSettingsProvider(() => ({
    developerCdpEnabled: store.getStore().get('developer.cdpEnabled') === true,
    automationApprovalMode: store.getStore().get('automation.approvalMode') || 'low-risk'
  }));
  automationService.setAgentConfigProvider(getAgentConfig);
  process.env.NAVEGANTE_DATA_DIR = app.getPath('userData');
  process.env.ZERO_DATA_DIR = process.env.NAVEGANTE_DATA_DIR;
  try {
    await automationService.start();
  } catch (err) {
    logError(err);
  }
  automationService.setBrowserControls({
    createTab: async (url) => {
      const created = createNewTab(url || store.getStore().get('browser.defaultHomepage') || 'about:blank');
      switchTab(created.tabId);
      return created;
    },
    closeTab: async (tabId) => closeTab(tabId),
    activateTab: (tabId) => { if (browserViews.has(tabId)) switchTab(tabId); },
    listDownloads: () => recentDownloads.map((record) => ({ ...record })),
    downloadDirectory: () => resolveDownloadDirectory(),
    runFlameTask: async ({ tabId, prompt, timeoutMs, allowLocalFixture }) => {
      const entry = browserViews.get(tabId);
      if (!extensionHost?.primary || !entry) return { success: false, error: 'O Flame não está carregado no Zero Browser' };
      const panel = openFlamePanel(tabId, extensionHost.extensionUrl(`${extensionHost.globalPanel.path}?tabId=${entry.webContents.id}`));
      const agentConfig = await getAgentConfig();
      await seedFlameSettings(panel.webContents, agentConfig).catch(() => false);
      await waitFor(() => panel.webContents.executeJavaScript('Boolean(document.querySelector("textarea"))'), 30000).catch(() => null);
      return runFlameTask({ panel: panel.webContents, prompt, timeoutMs, allowLocalFixture });
    }
  });
  automationService.setApprovalHandler(async ({ origin, reason, targetName, method }) => {
    if (!mainWindow || mainWindow.isDestroyed()) return false;
    const details = [
      `Origem: ${origin}`,
      `Ação: ${reason}`,
      method ? `Comando CDP: ${String(method).slice(0, 100)}` : null,
      targetName ? `Controle indicado pela página (conteúdo não confiável): “${String(targetName).slice(0, 160)}”` : null,
      '',
      'Permitir esta ação uma vez?'
    ].filter((line) => line !== null).join('\n');
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'Confirmação de ação do navegador',
      message: 'O agente solicita aprovação conforme o nível de permissões configurado.',
      detail: details,
      buttons: ['Cancelar', 'Permitir uma vez'],
      defaultId: 0,
      cancelId: 0,
      noLink: true
    });
    return response === 1;
  });
  // CAPTCHA pause: no modal dialog, so the user can solve the check on the page itself.
  automationService.setInterventionHandler(({ id, tabId, kind, origin }, signal) => new Promise((resolve) => {
    if (!mainWindow || mainWindow.isDestroyed()) return resolve('cancel');
    pendingInterventions.set(id, resolve);
    signal.addEventListener('abort', () => {
      pendingInterventions.delete(id);
      sendToRenderer('automation:intervention-end', { id });
      resolve('cancel');
    }, { once: true });
    if (browserViews.has(tabId)) switchTab(tabId);
    sendToRenderer('automation:intervention', { id, tabId, kind, origin });
    mainWindow.flashFrame(true);
  }));
  setAutomationService(automationService);
  try {
    library = new Library(path.join(app.getPath('userData'), 'biblioteca.sqlite'));
    library.onChange((area) => sendToRenderer('library:changed', { area }));
  } catch (error) {
    logError(error);
  }
  try {
    await startExtensionHost();
  } catch (err) {
    logError(err);
  }
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
}

function createMainWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const darkTheme = isDarkTheme(store.getStore().get('theme') || 'system');
  mainWindow = new BrowserWindow({
    width: Math.min(1400, width),
    height: Math.min(900, height),
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, '../../assets/zero-browser-icon.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: darkTheme ? '#1a1a2e' : '#f5f6f8',
      symbolColor: darkTheme ? '#ffffff' : '#202124',
      height: 36
    },
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    },
    show: false
  });

  const indexPath = path.join(__dirname, '../renderer/index.html');
  logError(`Loading index.html from: ${indexPath}`);

  mainWindow.loadFile(indexPath).catch(err => {
    logError(`loadFile failed: ${err}`);
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      logError('Fallback ready-to-show triggered');
      mainWindow.show();
    }
  }, 2500);

  mainWindow.webContents.on('did-fail-load', (e, errorCode, errorDescription) => {
    logError(`did-fail-load: ${errorCode} ${errorDescription}`);
  });

  mainWindow.on('close', () => {
    saveSessionTabs({ force: true });
    shuttingDown = true;
  });

  mainWindow.on('closed', () => {
    browserViews.forEach(({ view }) => {
      if (!view.webContents.isDestroyed()) view.webContents.close();
    });
    browserViews.clear();
    mainWindow = null;
  });

  mainWindow.on('resize', () => {
    updateBrowserViewBounds();
  });

  return mainWindow;
}

function createNewTab(url = 'about:blank', options = {}) {
  const tabId = `tab-${nextTabId++}`;
  const browserId = `browser-${options.browserId || nextBrowserId++}`;
  // Todas as abas usam o mesmo perfil, como num navegador comum: login feito numa aba vale nas outras.
  const partition = options.partition || PROFILE_PARTITION;

  const ses = session.fromPartition(partition);
  configureSession(ses);

  const popupWebContents = options.openerOptions?.webContents;
  const view = new WebContentsView({
    ...(popupWebContents ? { webContents: popupWebContents } : {}),
    webPreferences: {
      session: ses,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });

  const isNewTab = url === 'zero://newtab' || url === 'navegante://newtab';
  if (!popupWebContents) {
    if (isNewTab) {
      view.webContents.loadFile(path.join(__dirname, '../renderer/newtab.html'));
    } else {
      view.webContents.loadURL(url);
    }
  }

  view.webContents.on('before-input-event', (event, input) => {
    const action = browserShortcutForInput(input);
    if (!action) return;
    event.preventDefault();
    sendToRenderer('browser:shortcut', { action, tabId });
  });

  // Pop-ups e links com target=_blank viram abas. O Electron cria a página com o vínculo window.opener, que
  // logins como "Entrar com Google" usam para devolver o resultado à aba de origem.
  view.webContents.setWindowOpenHandler(({ url: targetUrl, disposition }) => {
    if (!isAllowedRendererNavigation(targetUrl)) return { action: 'deny' };
    return {
      action: 'allow',
      createWindow: (openerOptions) => {
        const created = createNewTab(targetUrl, { openerOptions, browserId: browserId.replace('browser-', '') });
        if (disposition !== 'background-tab') switchTab(created.tabId);
        return browserViews.get(created.tabId).webContents;
      }
    };
  });

  view.webContents.on('did-finish-load', () => {
    sendToRenderer('tab:navigated', { tabId, url: view.webContents.getURL(), title: view.webContents.getTitle() });
  });

  view.webContents.on('did-start-navigation', (e, targetUrl) => {
    if (typeof targetUrl === 'string' && targetUrl.includes('#open-copilot')) {
      sendToRenderer('browser:open-ai');
      return;
    }
    sendToRenderer('tab:navigation-start', { tabId, url: targetUrl });
  });

  view.webContents.on('page-title-updated', (e, title) => {
    sendToRenderer('tab:title-updated', { tabId, title });
  });

  view.webContents.on('page-favicon-updated', (e, favicons) => {
    if (favicons.length > 0) {
      sendToRenderer('tab:favicon-updated', { tabId, favicon: favicons[0] });
    }
  });

  view.webContents.on('console-message', (e, level, message) => {
    sendToRenderer('tab:console', { tabId, level, message });
  });

  view.webContents.on('did-fail-load', (e, errorCode, errorDescription, validatedURL) => {
    sendToRenderer('tab:load-error', { tabId, errorCode, errorDescription, url: validatedURL });
  });

  browserViews.set(tabId, { view, webContents: view.webContents, partition, browserId, url });
  view.webContents.on('page-favicon-updated', (_e, favicons) => {
    const entry = browserViews.get(tabId);
    if (entry && favicons[0]) entry.favicon = favicons[0];
    try { library?.history.setFavicon(view.webContents.getURL(), favicons[0]); } catch {}
  });
  extensionHost?.registerTab(view.webContents);
  sendToRenderer('tab:created', { tabId, browserId, url });
  automationService?.registerTab(tabId, view.webContents, browserId);
  view.webContents.on('did-navigate', (_e, navigatedUrl) => {
    automationService?.updateTabState(tabId, { url: view.webContents.getURL(), title: view.webContents.getTitle(), loading: false });
    const entry = browserViews.get(tabId);
    const transition = entry?.typedNavigation ? 'typed' : 'link';
    if (entry) entry.typedNavigation = false;
    try { library?.history.add({ url: navigatedUrl, title: view.webContents.getTitle(), transition }); } catch (error) { logError(error); }
    scheduleSessionSave();
  });
  view.webContents.on('page-title-updated', (_e, title) => {
    try { library?.history.setTitle(view.webContents.getURL(), title); } catch {}
  });
  view.webContents.on('did-start-loading', () => automationService?.updateTabState(tabId, { loading: true }));
  view.webContents.on('page-title-updated', () => automationService?.updateTabState(tabId, {
    url: view.webContents.getURL(), title: view.webContents.getTitle()
  }));
  mainWindow.contentView.addChildView(view);
  view.setVisible(false);
  updateBrowserViewBounds();

  return { tabId, browserId };
}

function configureSession(ses) {
  browserSessions.add(ses);
  const permissionLabels = {
    media: 'microfone e câmera',
    geolocation: 'localização',
    notifications: 'notificações',
    'clipboard-read': 'leitura da área de transferência',
    'clipboard-sanitized-write': 'escrita na área de transferência'
  };

  ses.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const requestingUrl = details?.requestingUrl || webContents.getURL();
    if (shouldAutoGrantGooglePermission(permission, requestingUrl)) {
      callback(true);
      return;
    }

    const label = permissionLabels[permission];
    if (!label || !mainWindow || mainWindow.isDestroyed()) {
      callback(false);
      return;
    }

    let origin = 'site desconhecido';
    try {
      origin = new URL(requestingUrl).origin;
    } catch {}

    dialog.showMessageBox(mainWindow, {
      type: 'question',
      message: `Permitir ${label}?`,
      detail: `${origin} está solicitando acesso.`,
      buttons: ['Bloquear', 'Permitir'],
      defaultId: 0,
      cancelId: 0,
      noLink: true
    }).then(({ response }) => callback(response === 1)).catch(() => callback(false));
  });

  if (configuredSessions.has(ses)) return;
  configuredSessions.add(ses);
  configureSessionRequestPolicies(ses);
  configureSessionDownloads(ses);
}

function currentBrowserPreferences() {
  const settings = store.getStore();
  return {
    doNotTrack: settings.get('privacy.doNotTrack') !== false,
    blockThirdPartyCookies: settings.get('privacy.blockThirdPartyCookies') !== false
  };
}

function pageUrlForRequest(details) {
  try {
    if (details.webContents && !details.webContents.isDestroyed()) return details.webContents.getURL();
  } catch {}
  try { if (details.frame?.url) return details.frame.url; } catch {}
  return details.referrer || '';
}

function configureSessionRequestPolicies(ses) {
  const filter = { urls: ['http://*/*', 'https://*/*'] };
  ses.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
    const headers = rewriteRequestHeaders({
      ...details,
      pageUrl: pageUrlForRequest(details)
    }, currentBrowserPreferences());
    callback({ requestHeaders: headers });
  });
  ses.webRequest.onHeadersReceived(filter, (details, callback) => {
    const responseHeaders = rewriteResponseHeaders({
      ...details,
      pageUrl: pageUrlForRequest(details)
    }, currentBrowserPreferences());
    callback({ responseHeaders });
  });
}

function resolveDownloadDirectory() {
  const configured = store.getStore().get('downloads.path') || app.getPath('downloads');
  try {
    fs.mkdirSync(configured, { recursive: true });
    return configured;
  } catch {
    const fallback = app.getPath('downloads');
    fs.mkdirSync(fallback, { recursive: true });
    return fallback;
  }
}

// Downloads recentes, para o motor saber o que uma ação baixou.
const recentDownloads = [];
let downloadSequence = 0;
let downloadHistoryLoaded = false;

// O histórico de downloads do usuário sobrevive ao fechamento do app (arquivo no perfil); "limpar ao sair" não grava nada.
function downloadHistoryFile() {
  return path.join(app.getPath('userData'), 'downloads-historico.json');
}

function ensureDownloadHistory() {
  if (downloadHistoryLoaded) return;
  downloadHistoryLoaded = true;
  try {
    if (store.getStore().get('privacy.clearOnExit') === true) return;
    const saved = loadDownloadHistory(downloadHistoryFile(), DOWNLOAD_HISTORY_LIMIT);
    recentDownloads.unshift(...saved);
    downloadSequence = Math.max(downloadSequence, nextDownloadSequence(saved));
  } catch (error) {
    logError(error);
  }
}

function persistDownloadHistory() {
  try {
    if (store.getStore().get('privacy.clearOnExit') === true) return;
    saveDownloadHistory(downloadHistoryFile(), recentDownloads, DOWNLOAD_HISTORY_LIMIT);
  } catch (error) {
    logError(error);
  }
}

function configureSessionDownloads(ses) {
  ses.on('will-download', (_event, item, source) => {
    ensureDownloadHistory();
    const tabId = source ? tabIdOfWebContents(source) : null;
    // Tarefas de avaliação (run_task) baixam numa pasta do perfil, longe dos downloads do usuário.
    const evaluation = Boolean(tabId && automationService?.taskApprovalPolicies?.has(tabId));
    const directory = evaluation ? path.join(app.getPath('userData'), 'downloads-avaliacao') : resolveDownloadDirectory();
    if (evaluation) fs.mkdirSync(directory, { recursive: true });
    else ses.setDownloadPath(directory);
    const filename = path.basename(item.getFilename()) || 'download';
    // Download pedido pelo agente vai direto para a pasta de downloads: a janela "Salvar" travaria a tarefa.
    const byAgent = Boolean(tabId && automationService?.agentTabs?.has(tabId));
    const promptForLocation = !byAgent && store.getStore().get('downloads.prompt') !== false;
    const record = { id: `d${++downloadSequence}`, tabId, filename, url: item.getURL(), state: 'progressing', path: '', receivedBytes: 0, totalBytes: item.getTotalBytes(), startedAt: Date.now(), evaluation };
    recentDownloads.push(record);
    if (recentDownloads.length > DOWNLOAD_HISTORY_LIMIT) recentDownloads.shift();

    item.on('updated', (_updateEvent, state) => {
      record.state = state;
      record.receivedBytes = item.getReceivedBytes();
      sendToRenderer('download:event', { filename, state, receivedBytes: item.getReceivedBytes(), totalBytes: item.getTotalBytes() });
    });
    item.once('done', (_doneEvent, state) => {
      let savedPath = '';
      try { savedPath = item.getSavePath(); } catch {}
      Object.assign(record, { state, path: savedPath, filename: savedPath ? path.basename(savedPath) : filename, receivedBytes: item.getReceivedBytes() });
      persistDownloadHistory();
      sendToRenderer('download:event', { filename, state, path: savedPath });
    });

    if (!promptForLocation) {
      item.setSavePath(makeUniqueDownloadPath(directory, filename));
      return;
    }

    item.pause();
    dialog.showSaveDialog(mainWindow, {
      title: 'Salvar download',
      defaultPath: path.join(directory, filename),
      buttonLabel: 'Salvar'
    }).then(({ canceled, filePath }) => {
      if (canceled || !filePath || item.getState() === 'cancelled') {
        item.cancel();
        return;
      }
      item.setSavePath(filePath);
      item.resume();
    }).catch(() => item.cancel());
  });
}

function isDarkTheme(theme) {
  return theme === 'dark' || (theme === 'system' && nativeTheme.shouldUseDarkColors);
}

function applyWindowTheme(theme) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const dark = isDarkTheme(theme);
  mainWindow.setTitleBarOverlay({
    color: dark ? '#1a1a2e' : '#f5f6f8',
    symbolColor: dark ? '#ffffff' : '#202124',
    height: 36
  });
}

ipcMain.handle('settings:apply-theme', async (_event, theme) => {
  if (!['system', 'light', 'dark'].includes(theme)) throw new Error('Tema inválido');
  await store.set('theme', theme);
  applyWindowTheme(theme);
  return { success: true, theme };
});

ipcMain.handle('settings:choose-download-directory', async () => {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Escolher pasta de downloads',
    defaultPath: resolveDownloadDirectory(),
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const selected = result.filePaths[0];
  await store.set('downloads.path', selected);
  for (const ses of browserSessions) ses.setDownloadPath(selected);
  return selected;
});

function isAllowedRendererNavigation(url) {
  return typeof url === 'string' && (
    /^https?:\/\//i.test(url)
    || ['about:blank', 'zero://newtab', 'navegante://newtab'].includes(url)
  );
}

function updateBrowserViewBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  const contentBounds = mainWindow.getContentBounds();
  const tabBarHeight = 40;
  const addressBarHeight = 44 + (bookmarksBarVisible ? BOOKMARKS_BAR_HEIGHT : 0);
  const flameOpen = flamePanels.has(activeBrowserTabId) && !flamePanelHidden;
  const sidePanelWidth = flameOpen
    ? Math.min(FLAME_PANEL_WIDTH, Math.floor(contentBounds.width * 0.45))
    : sidePanelOpen ? Math.min(360, Math.floor(contentBounds.width * 0.4)) : 0;
  const top = tabBarHeight + addressBarHeight;
  for (const panel of flamePanels.values()) {
    if (!panel.webContents.isDestroyed()) {
      panel.setBounds({ x: contentBounds.width - sidePanelWidth, y: top, width: sidePanelWidth, height: contentBounds.height - top });
    }
  }

  browserViews.forEach(({ view }) => {
    if (!view.webContents.isDestroyed()) {
      view.setBounds({
        x: 0,
        y: tabBarHeight + addressBarHeight,
        width: Math.max(320, contentBounds.width - sidePanelWidth),
        height: contentBounds.height - tabBarHeight - addressBarHeight
      });
    }
  });
  return browserViews.get(activeBrowserTabId)?.view.getBounds() || null;
}

function closeTab(tabId) {
  const entry = browserViews.get(tabId);
  if (entry) {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.contentView.removeChildView(entry.view);
    automationService?.unregisterTab(tabId);
    closeFlamePanel(tabId);
    if (!entry.view.webContents.isDestroyed()) {
      const closedUrl = entry.view.webContents.getURL();
      extensionHost?.rememberClosed(closedUrl, entry.view.webContents.getTitle());
      if (closedUrl && !shuttingDown) {
        closedTabs.push(closedUrl);
        if (closedTabs.length > 25) closedTabs.shift();
      }
    }
    if (!entry.view.webContents.isDestroyed()) {
      entry.view.webContents.close();
    }
    browserViews.delete(tabId);
    scheduleSessionSave();
    if (activeBrowserTabId === tabId) activeBrowserTabId = null;
    sendToRenderer('tab:closed', { tabId });
    updateBrowserViewBounds();
  }
}

function switchTab(tabId) {
  const entry = browserViews.get(tabId);
  if (entry && mainWindow && !mainWindow.isDestroyed()) {
    activeBrowserTabId = tabId;
    for (const [id, tab] of browserViews) tab.view.setVisible(id === tabId && !pageFrozen);
    for (const [id, panel] of flamePanels) panel.setVisible(id === tabId && !flamePanelHidden);
    updateBrowserViewBounds();
    sendToRenderer('tab:switched', { tabId });
    extensionHost?.tabActivated(entry.webContents);
  }
}

function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

ipcMain.handle('automation:intervention-reply', async (_e, { id, action } = {}) => {
  const resolve = pendingInterventions.get(id);
  if (!resolve) return { success: false };
  pendingInterventions.delete(id);
  resolve(action === 'continue' ? 'continue' : 'cancel');
  return { success: true };
});

ipcMain.handle('browser:new-tab', async (e, url) => {
  if (!mainWindow || e.sender !== mainWindow.webContents) throw new Error('Somente a janela principal pode abrir abas.');
  const target = typeof url === 'string' && url ? url : 'about:blank';
  if (!isAllowedRendererNavigation(target)) throw new Error('A nova aba aceita apenas endereços HTTP ou HTTPS, about:blank ou a página interna de nova aba.');
  return createNewTab(target);
});

ipcMain.handle('browser:close-tab', async (e, tabId) => {
  closeTab(tabId);
  return { success: true };
});

ipcMain.handle('browser:switch-tab', async (e, tabId) => {
  switchTab(tabId);
  return { success: true };
});

ipcMain.handle('browser:navigate', async (e, tabId, url) => {
  if (!isAllowedRendererNavigation(url)) throw new Error('A navegação aceita apenas endereços HTTP ou HTTPS ou páginas internas permitidas.');
  const entry = browserViews.get(tabId);
  if (entry) {
    // Navegação vinda da barra de endereço conta como "digitada", o que pesa mais nas sugestões.
    entry.typedNavigation = true;
    if (url === 'zero://newtab' || url === 'navegante://newtab') {
      entry.view.webContents.loadFile(path.join(__dirname, '../renderer/newtab.html'));
    } else {
      entry.view.webContents.loadURL(url);
    }
    return { success: true };
  }
  return { success: false, error: 'Tab not found' };
});

ipcMain.handle('browser:go-back', async (e, tabId) => {
  const entry = browserViews.get(tabId);
  if (entry && entry.view.webContents.canGoBack()) {
    entry.view.webContents.goBack();
    return { success: true };
  }
  return { success: false };
});

ipcMain.handle('browser:go-forward', async (e, tabId) => {
  const entry = browserViews.get(tabId);
  if (entry && entry.view.webContents.canGoForward()) {
    entry.view.webContents.goForward();
    return { success: true };
  }
  return { success: false };
});

ipcMain.handle('browser:reload', async (e, tabId) => {
  const entry = browserViews.get(tabId);
  if (entry) {
    entry.view.webContents.reload();
    return { success: true };
  }
  return { success: false };
});

ipcMain.handle('browser:get-tabs', async () => {
  const tabs = [];
  browserViews.forEach((entry, tabId) => {
    tabs.push({
      tabId,
      browserId: entry.browserId,
      url: entry.view.webContents.getURL(),
      title: entry.view.webContents.getTitle(),
      favicon: entry.favicon,
      loading: entry.view.webContents.isLoading(),
      canGoBack: entry.view.webContents.navigationHistory.canGoBack(),
      canGoForward: entry.view.webContents.navigationHistory.canGoForward()
    });
  });
  return tabs;
});

ipcMain.handle('browser:set-side-panel-open', (event, isOpen) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) {
    throw new Error('Somente a janela principal pode alterar o layout do navegador.');
  }
  sidePanelOpen = isOpen === true;
  const bounds = updateBrowserViewBounds();
  return { open: sidePanelOpen, bounds };
});

ipcMain.handle('browser:get-side-panel-layout', (event) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) {
    throw new Error('Somente a janela principal pode consultar o layout do navegador.');
  }
  return { open: sidePanelOpen, frozen: pageFrozen, bounds: browserViews.get(activeBrowserTabId)?.view.getBounds() || null };
});

ipcMain.handle('browser:get-tab', async (e, tabId) => {
  const entry = browserViews.get(tabId);
  if (entry) {
    return {
      tabId,
      browserId: entry.browserId,
      url: entry.view.webContents.getURL(),
      title: entry.view.webContents.getTitle(),
      loading: entry.view.webContents.isLoading(),
      canGoBack: entry.view.webContents.navigationHistory.canGoBack(),
      canGoForward: entry.view.webContents.navigationHistory.canGoForward()
    };
  }
  return null;
});

// --- Favoritos, histórico e sessão ------------------------------------------------------------------------

function fromMainWindow(event) {
  if (!mainWindow || event.sender !== mainWindow.webContents) throw new Error('Somente a janela principal pode usar a biblioteca.');
  if (!library) throw new Error('Favoritos e histórico indisponíveis.');
  return library;
}

ipcMain.handle('library:bookmarks', (event, operation, ...args) => {
  const allowed = ['getTree', 'getChildren', 'create', 'update', 'move', 'remove', 'isBookmarked', 'findByUrl', 'search'];
  if (!allowed.includes(operation)) throw new Error('Operação de favoritos inválida.');
  return fromMainWindow(event).bookmarks[operation](...args);
});

ipcMain.handle('library:history', (event, operation, ...args) => {
  const allowed = ['search', 'deleteUrl', 'deleteRange', 'deleteAll'];
  if (!allowed.includes(operation)) throw new Error('Operação de histórico inválida.');
  return fromMainWindow(event).history[operation](...args);
});

ipcMain.handle('library:suggest', (event, text) => fromMainWindow(event).suggest(String(text || ''), 8));

ipcMain.handle('library:import-sources', (event) => {
  fromMainWindow(event);
  return libraryImport.chromiumSources().map(({ id, browser, profile }) => ({ id, browser, profile }));
});

ipcMain.handle('library:import', async (event, sourceId) => {
  const lib = fromMainWindow(event);
  if (sourceId === 'html') {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Importar favoritos de um arquivo HTML',
      filters: [{ name: 'Favoritos exportados', extensions: ['html', 'htm'] }],
      properties: ['openFile']
    });
    if (canceled || !filePaths[0]) return null;
    return libraryImport.importFromHtmlFile(lib, filePaths[0]);
  }
  const source = libraryImport.chromiumSources().find((candidate) => candidate.id === sourceId);
  if (!source) throw new Error('Navegador não encontrado.');
  return libraryImport.importFromSource(lib, source);
});

function openBookmarkUrl(url, inNewTab) {
  if (!/^https?:/i.test(url)) return;
  if (inNewTab || !browserViews.has(activeBrowserTabId)) {
    const created = createNewTab(url);
    switchTab(created.tabId);
    return;
  }
  browserViews.get(activeBrowserTabId).webContents.loadURL(url);
}

// Favorito sem nome próprio (ou com a própria URL como nome) aparece pelo nome do site.
function bookmarkLabel(node) {
  if (node.title && node.title !== node.url) return node.title;
  try { return new URL(node.url).hostname.replace(/^www\./, ''); } catch { return node.url; }
}

// Menu nativo do sistema: aparece por cima da página, coisa que um menu HTML da interface não consegue.
function folderMenuTemplate(folderId, fromIndex = 0) {
  const children = library.bookmarks.getChildren(folderId).slice(Math.max(0, Number(fromIndex) || 0));
  if (!children.length) return [{ label: '(vazia)', enabled: false }];
  const items = children.map((node) => (node.url
    ? { label: bookmarkLabel(node).slice(0, 80), click: () => openBookmarkUrl(node.url, false) }
    : { label: (node.title || 'Pasta').slice(0, 80), submenu: folderMenuTemplate(node.id) }));
  const urls = children.filter((node) => node.url).map((node) => node.url);
  // Sem "abrir todos" em listas grandes: centenas de abas de uma vez travariam o navegador.
  if (urls.length > 1 && urls.length <= 20 && !fromIndex) {
    items.push({ type: 'separator' }, { label: `Abrir todos (${urls.length}) em novas abas`, click: () => urls.forEach((url) => openBookmarkUrl(url, true)) });
  }
  return items;
}

ipcMain.handle('library:folder-menu', (event, folderId, x, y, fromIndex) => {
  fromMainWindow(event);
  Menu.buildFromTemplate(folderMenuTemplate(folderId, fromIndex)).popup({ window: mainWindow, x: Math.round(x), y: Math.round(y) });
});

ipcMain.handle('library:item-menu', (event, bookmarkId, x, y) => {
  const lib = fromMainWindow(event);
  const [node] = lib.bookmarks.get(bookmarkId);
  const template = [
    ...(node.url ? [
      { label: 'Abrir', click: () => openBookmarkUrl(node.url, false) },
      { label: 'Abrir em nova aba', click: () => openBookmarkUrl(node.url, true) },
      { type: 'separator' }
    ] : []),
    { label: 'Excluir', click: () => lib.bookmarks.remove(node.id) }
  ];
  Menu.buildFromTemplate(template).popup({ window: mainWindow, x: Math.round(x), y: Math.round(y) });
});

ipcMain.handle('browser:set-bookmarks-bar', (event, visible) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) throw new Error('Somente a janela principal pode alterar o layout.');
  bookmarksBarVisible = visible === true;
  updateBrowserViewBounds();
  return { visible: bookmarksBarVisible };
});

// As páginas ficam por cima da interface; enquanto a lista de sugestões está aberta, a página vira uma imagem
// parada atrás dela para a lista aparecer sem esconder o site.
ipcMain.handle('browser:freeze-page', async (event, frozen, reason = 'suggestions') => {
  if (!mainWindow || event.sender !== mainWindow.webContents) throw new Error('Somente a janela principal pode alterar o layout.');
  const entry = browserViews.get(activeBrowserTabId);
  if (!entry) return null;
  const owner = ['suggestions', 'menu', 'panel'].includes(reason) ? reason : 'suggestions';
  if (frozen) pageFreezeReasons.add(owner);
  else pageFreezeReasons.delete(owner);
  if (frozen && !pageFrozen) {
    const tabIdAtCapture = activeBrowserTabId;
    const viewAtCapture = entry.view;
    const image = await entry.view.webContents.capturePage().catch(() => null);
    // Uma sobreposição pode fechar enquanto capturePage() está pendente. Não esconda
    // a página depois que o renderer já pediu para descongelá-la.
    if (!pageFreezeReasons.size || activeBrowserTabId !== tabIdAtCapture
      || browserViews.get(tabIdAtCapture)?.view !== viewAtCapture || pageFrozen) return null;
    pageFrozen = true;
    viewAtCapture.setVisible(false);
    for (const panel of flamePanels.values()) panel.setVisible(false);
    return { image: image && !image.isEmpty() ? image.toDataURL() : null, bounds: viewAtCapture.getBounds() };
  }
  if (!pageFreezeReasons.size && pageFrozen) {
    pageFrozen = false;
    browserViews.get(activeBrowserTabId)?.view.setVisible(true);
    for (const [id, panel] of flamePanels) panel.setVisible(id === activeBrowserTabId && !flamePanelHidden);
  }
  return null;
});

ipcMain.handle('browser:tab-menu', (event, tabId, order, x, y) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) throw new Error('Somente a janela principal pode abrir o menu de abas.');
  if (!browserViews.has(tabId)) return false;
  const ids = (Array.isArray(order) ? order : [...browserViews.keys()]).filter((id) => browserViews.has(id));
  const openAndShow = (url) => { const created = createNewTab(url); switchTab(created.tabId); };
  const template = buildTabMenuTemplate({
    tabId,
    order: ids,
    canReopen: closedTabs.length > 0,
    actions: {
      newTab: () => openAndShow('zero://newtab'),
      reload: (id) => browserViews.get(id)?.view.webContents.reload(),
      duplicate: (id) => { const url = browserViews.get(id)?.view.webContents.getURL(); if (url) openAndShow(url); },
      close: (id) => closeTab(id),
      closeMany: (list, keepId) => { switchTab(keepId); list.forEach((id) => closeTab(id)); },
      reopen: () => { const url = closedTabs.pop(); if (url) openAndShow(url); }
    }
  });
  Menu.buildFromTemplate(template).popup({ window: mainWindow, x: Math.round(Number(x) || 0), y: Math.round(Number(y) || 0) });
  return true;
});

// Perfis: cada um é uma pasta de dados própria e roda como um processo separado do app (logins, histórico e chaves não se misturam).
const profilesRoot = () => path.join(app.getPath('appData'), 'zero-browser-perfis');

function launchProfile(profile) {
  const env = { ...process.env };
  for (const key of ['ZERO_USER_DATA', 'NAVEGANTE_USER_DATA', 'ZERO_DATA_DIR', 'NAVEGANTE_DATA_DIR']) delete env[key];
  if (profile.id !== profiles.MAIN_PROFILE.id) env.ZERO_USER_DATA = profiles.profileDir(profilesRoot(), profile.id);
  const args = app.isPackaged ? [] : [app.getAppPath()];
  spawn(process.execPath, args, { detached: true, stdio: 'ignore', env }).unref();
}

ipcMain.handle('browser:app-info', () => ({
  version: app.getVersion(),
  profile: profiles.currentProfile(profilesRoot(), app.getPath('userData')).name
}));

ipcMain.handle('browser:profile-menu', (event, x, y) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) throw new Error('Somente a janela principal pode abrir o menu de perfis.');
  const root = profilesRoot();
  const current = profiles.currentProfile(root, app.getPath('userData'));
  const template = profiles.buildProfileMenuTemplate({
    current,
    profiles: profiles.listProfiles(root),
    actions: {
      open: (profile) => launchProfile(profile),
      create: () => {
        try { launchProfile(profiles.createProfile(root)); } catch (error) { logError(error); dialog.showErrorBox('Novo perfil', error.message); }
      },
      remove: async (profile) => {
        const { response } = await dialog.showMessageBox(mainWindow, {
          type: 'warning', buttons: ['Cancelar', 'Excluir'], defaultId: 0, cancelId: 0,
          title: 'Excluir perfil', message: `Excluir o perfil "${profile.name}"?`,
          detail: 'Logins, histórico, favoritos, downloads e chaves desse perfil serão apagados e não podem ser recuperados. Feche a janela dele antes.'
        });
        if (response !== 1) return;
        try { profiles.deleteProfile(root, profile.id, app.getPath('userData')); } catch (error) { logError(error); dialog.showErrorBox('Excluir perfil', error.message); }
      }
    }
  });
  Menu.buildFromTemplate(template).popup({ window: mainWindow, x: Math.round(Number(x) || 0), y: Math.round(Number(y) || 0) });
  return { current };
});

ipcMain.handle('browser:reopen-closed-tab', (event) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) throw new Error('Somente a janela principal pode reabrir abas.');
  const url = closedTabs.pop();
  if (!url) return null;
  const created = createNewTab(url);
  switchTab(created.tabId);
  return created;
});

// Abas abertas ao sair, para reabrir na próxima vez (configuração browser.restoreSession).
ipcMain.handle('browser:get-last-session', (event) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) throw new Error('Somente a janela principal pode ler a sessão.');
  const conf = store.getStore();
  if (conf.get('browser.restoreSession') === false || conf.get('privacy.clearOnExit') === true) return [];
  const urls = conf.get('session.lastTabs');
  return Array.isArray(urls) ? urls.filter((url) => typeof url === 'string' && /^https?:/i.test(url)).slice(0, 30) : [];
});

ipcMain.handle('browser:get-downloads', (event) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) throw new Error('Somente a janela principal pode listar downloads.');
  ensureDownloadHistory();
  return recentDownloads.filter((record) => !record.evaluation).map(({ id, filename, url, state, path: savedPath, receivedBytes, totalBytes, startedAt }) => ({
    id, filename, url, state, hasFile: state === 'completed' && Boolean(savedPath && fs.existsSync(savedPath)), receivedBytes, totalBytes, startedAt
  })).reverse();
});

ipcMain.handle('browser:show-download', (event, id) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) throw new Error('Somente a janela principal pode abrir a pasta de um download.');
  const record = recentDownloads.find((item) => item.id === String(id));
  if (!record || record.state !== 'completed' || !record.path || !fs.existsSync(record.path)) throw new Error('Este download ainda não está disponível.');
  shell.showItemInFolder(record.path);
  return true;
});

// Como o Chrome, grava as abas abertas a cada mudança (e não só ao sair), o que também cobre travamentos.
function scheduleSessionSave() {
  clearTimeout(sessionSaveTimer);
  sessionSaveTimer = setTimeout(saveSessionTabs, 1000);
}

function saveSessionTabs({ force = false } = {}) {
  if (shuttingDown && !force) return;
  try {
    const urls = [...browserViews.values()].map((entry) => (entry.webContents.isDestroyed() ? '' : entry.webContents.getURL())).filter((url) => /^https?:/i.test(url));
    store.getStore().set('session.lastTabs', urls);
  } catch (error) {
    logError(error);
  }
}

// --- Extensões (Flame) ------------------------------------------------------------------------------------

function tabIdOfWebContents(target) {
  for (const [tabId, entry] of browserViews) if (entry.webContents === target) return tabId;
  return null;
}

function flameExtensionPath() {
  const configured = store.getStore().get('extensions.flamePath');
  const candidates = [configured, path.join(__dirname, '../../../lume-aipex/extension')].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(path.join(candidate, 'manifest.json'))) || null;
}

async function startExtensionHost() {
  const flamePath = flameExtensionPath();
  const settings = store.getStore();
  const userExtensions = settings.get('extensions.user', []);
  const records = Array.isArray(userExtensions) ? userExtensions.filter((item) => item && typeof item.path === 'string') : [];
  const extensionPaths = [];
  if (flamePath && settings.get('extensions.flameEnabled') !== false) {
    extensionPaths.push({ path: flamePath, primary: true, allowFileAccess: true });
  }
  for (const item of records) {
    if (item.enabled === true && (!flamePath || path.resolve(item.path) !== path.resolve(flamePath))) {
      extensionPaths.push({ path: item.path, primary: false, allowFileAccess: false });
    }
  }
  const ses = session.fromPartition(PROFILE_PARTITION);
  configureSession(ses);
  extensionHost = new ExtensionHost({
    session: ses,
    browser: {
      library,
      listTabs: () => [...browserViews.values()].map((entry) => entry.webContents).filter((wc) => !wc.isDestroyed()),
      activeWebContents: () => browserViews.get(activeBrowserTabId)?.webContents || null,
      extensionPages: () => webContents.getAllWebContents().filter((wc) => !wc.isDestroyed() && wc.getURL().startsWith('chrome-extension://')),
      createTab: async (url, { active } = {}) => {
        const created = createNewTab(url);
        if (active !== false) switchTab(created.tabId);
        return browserViews.get(created.tabId).webContents;
      },
      closeTab: (wc) => { const id = tabIdOfWebContents(wc); if (id) closeTab(id); },
      activate: (wc) => { const id = tabIdOfWebContents(wc); if (id) switchTab(id); },
      windowBounds: () => mainWindow.getBounds(),
      isFocused: () => mainWindow?.isFocused() || false,
      windowState: () => (mainWindow?.isMinimized() ? 'minimized' : mainWindow?.isMaximized() ? 'maximized' : 'normal'),
      focus: () => mainWindow?.focus(),
      viewBounds: () => browserViews.get(activeBrowserTabId)?.view.getBounds(),
      faviconOf: (wc) => browserViews.get(tabIdOfWebContents(wc))?.favicon,
      openSidePanel: (wc, url) => { const id = tabIdOfWebContents(wc); if (id) openFlamePanel(id, url); },
      closeSidePanel: (wc) => closeFlamePanel(wc ? tabIdOfWebContents(wc) : activeBrowserTabId),
      showDownloadsFolder: () => shell.openPath(resolveDownloadDirectory())
    }
  });
  library?.onChange((area, event, payload) => extensionHost?.emit(`${area}.${event}`, ...payload));
  const loaded = await extensionHost.start(extensionPaths);
  for (const result of loaded) {
    if (!result.error) continue;
    logError(new Error(`Extensão não carregou: ${result.error}`));
    const record = records.find((item) => path.resolve(item.path) === path.resolve(result.path));
    if (record) record.error = result.error;
  }
  settings.set('extensions.user', records);
}

function extensionRecordForUI(record) {
  return { id: record.id, name: record.name, version: record.version, permissions: record.permissions || [], enabled: record.enabled === true, error: record.error || '', managed: false };
}

function visibleExtensionRecords() {
  const primary = extensionHost?.primary;
  const base = primary ? [{ id: primary.id, name: primary.name, version: primary.version, permissions: primary.manifest.permissions || [], enabled: true, error: '', managed: true }] : [];
  const records = store.getStore().get('extensions.user', []);
  return [...base, ...(Array.isArray(records) ? records.map(extensionRecordForUI) : [])];
}

function requireMainWindowSender(event) {
  if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) throw new Error('Somente a janela principal pode gerenciar extensões.');
}

ipcMain.handle('browser:extensions:list', (event) => {
  requireMainWindowSender(event);
  return visibleExtensionRecords();
});

ipcMain.handle('browser:extensions:add', async (event) => {
  requireMainWindowSender(event);
  const selected = await dialog.showOpenDialog(mainWindow, {
    title: 'Selecionar pasta da extensão unpacked',
    properties: ['openDirectory']
  });
  if (selected.canceled || !selected.filePaths[0]) return { cancelled: true };
  const extensionPath = path.resolve(selected.filePaths[0]);
  const manifestPath = path.join(extensionPath, 'manifest.json');
  let manifest;
  try {
    if (!fs.statSync(extensionPath).isDirectory()) throw new Error('A seleção precisa ser uma pasta.');
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (![2, 3].includes(manifest.manifest_version) || typeof manifest.name !== 'string' || typeof manifest.version !== 'string') {
      throw new Error('manifest.json precisa declarar manifest_version 2 ou 3, name e version.');
    }
  } catch (error) {
    throw new Error(`Extensão inválida: ${error.message}`);
  }
  const settings = store.getStore();
  const records = settings.get('extensions.user', []);
  const existing = Array.isArray(records) ? records : [];
  if (existing.some((item) => path.resolve(item.path) === extensionPath)) throw new Error('Esta pasta já foi adicionada.');
  const basePath = flameExtensionPath();
  if (basePath && path.resolve(basePath) === extensionPath) throw new Error('O Flame já é gerenciado pelo Zero Browser.');
  const permissions = [...new Set([
    ...(Array.isArray(manifest.permissions) ? manifest.permissions : []),
    ...(Array.isArray(manifest.host_permissions) ? manifest.host_permissions : []),
    ...(Array.isArray(manifest.optional_permissions) ? manifest.optional_permissions : []),
    ...(Array.isArray(manifest.optional_host_permissions) ? manifest.optional_host_permissions : [])
  ].map((value) => String(value)))];
  const contentScriptSites = (Array.isArray(manifest.content_scripts) ? manifest.content_scripts : [])
    .flatMap((entry) => Array.isArray(entry?.matches) ? entry.matches : [])
    .map((value) => String(value));
  const permissionSummary = [
    ...permissions,
    ...contentScriptSites.map((site) => `content script: ${site}`)
  ].join('\n') || 'Nenhuma permissão declarada no manifesto.';
  const confirmation = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title: 'Permissões da extensão',
    message: `Carregar “${manifest.name}” no Zero Browser?`,
    detail: `Versão ${manifest.version}. Extensões executam código e podem ler páginas conforme as permissões declaradas.\n\n${permissionSummary}\n\nSomente pastas unpacked são aceitas; o suporte a APIs do Chrome é parcial.`,
    buttons: ['Carregar extensão', 'Cancelar'],
    defaultId: 1,
    cancelId: 1,
    noLink: true
  });
  if (confirmation.response !== 0) return { cancelled: true };
  try {
    const extension = await extensionHost.loadExtension({ path: extensionPath, primary: false, allowFileAccess: false });
    const record = { id: extension.id, name: extension.name, version: extension.version, permissions, enabled: true, path: extensionPath, error: '' };
    settings.set('extensions.user', [...existing, record]);
    return { success: true, extension: extensionRecordForUI(record) };
  } catch (error) {
    throw new Error(`Não foi possível carregar a extensão: ${error.message}`);
  }
});

ipcMain.handle('browser:extensions:set-enabled', async (event, extensionId, enabled) => {
  requireMainWindowSender(event);
  if (typeof extensionId !== 'string' || typeof enabled !== 'boolean') throw new Error('Estado de extensão inválido.');
  const settings = store.getStore();
  const records = settings.get('extensions.user', []);
  const list = Array.isArray(records) ? records : [];
  const record = list.find((item) => item.id === extensionId);
  if (!record) throw new Error('Esta extensão não pode ser alterada ou não está instalada.');
  if (record.enabled === enabled) return extensionRecordForUI(record);
  if (enabled) {
    try {
      const extension = await extensionHost.loadExtension({ path: record.path, primary: false, allowFileAccess: false });
      record.id = extension.id;
      record.name = extension.name;
      record.version = extension.version;
      record.error = '';
      record.enabled = true;
    } catch (error) {
      record.error = error.message;
      settings.set('extensions.user', list);
      throw new Error(`Não foi possível ativar a extensão: ${error.message}`);
    }
  } else {
    extensionHost.unloadExtension(record.id);
    record.enabled = false;
    record.error = '';
  }
  settings.set('extensions.user', list);
  return extensionRecordForUI(record);
});

ipcMain.handle('browser:extensions:remove', async (event, extensionId) => {
  requireMainWindowSender(event);
  if (typeof extensionId !== 'string') throw new Error('Identificador de extensão inválido.');
  const settings = store.getStore();
  const records = settings.get('extensions.user', []);
  const list = Array.isArray(records) ? records : [];
  const record = list.find((item) => item.id === extensionId);
  if (!record) throw new Error('A extensão principal do Zero Browser não pode ser removida.');
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'warning', title: 'Remover extensão', message: `Remover “${record.name}” do Zero Browser?`,
    detail: 'A pasta e os arquivos da extensão serão mantidos no computador.',
    buttons: ['Remover', 'Cancelar'], defaultId: 1, cancelId: 1, noLink: true
  });
  if (result.response !== 0) return { cancelled: true };
  if (record.enabled) extensionHost.unloadExtension(record.id);
  settings.set('extensions.user', list.filter((item) => item.id !== extensionId));
  return { success: true };
});

function openFlamePanel(tabId, url) {
  let panel = flamePanels.get(tabId);
  if (!panel) {
    panel = new WebContentsView({ webPreferences: { session: session.fromPartition(PROFILE_PARTITION), sandbox: true, contextIsolation: true } });
    panel.webContents.on("console-message", (_event, level, message) => console.log("[FlameConsole]", message));
    flamePanels.set(tabId, panel);
    mainWindow.contentView.addChildView(panel);
    // Na primeira abertura, o Flame recebe o provedor e a chave já salvos no Zero Browser.
    panel.webContents.once('did-finish-load', async () => {
      const seeded = await seedFlameSettings(panel.webContents, await getAgentConfig()).catch(() => false);
      if (seeded && !panel.webContents.isDestroyed()) panel.webContents.reload();
    });
    panel.webContents.loadURL(url);
  }
  flamePanelHidden = false;
  for (const [id, other] of flamePanels) other.setVisible(id === activeBrowserTabId);
  updateBrowserViewBounds();
  sendToRenderer('flame:panel', { tabId, open: true });
  return panel;
}

function closeFlamePanel(tabId) {
  const panel = flamePanels.get(tabId);
  if (!panel) return;
  flamePanels.delete(tabId);
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.contentView.removeChildView(panel);
  if (!panel.webContents.isDestroyed()) panel.webContents.close();
  updateBrowserViewBounds();
  sendToRenderer('flame:panel', { tabId, open: false });
}

ipcMain.handle('flame:toggle-panel', (event) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) throw new Error('Somente a janela principal pode abrir o painel.');
  if (!extensionHost?.primary) return { available: false };
  if (flamePanels.has(activeBrowserTabId) && !flamePanelHidden) {
    flamePanelHidden = true;
    for (const panel of flamePanels.values()) panel.setVisible(false);
    updateBrowserViewBounds();
    return { available: true, open: false };
  }
  if (flamePanels.has(activeBrowserTabId)) {
    openFlamePanel(activeBrowserTabId);
    return { available: true, open: true };
  }
  return { available: true, open: extensionHost.openPanelForActiveTab() };
});

ipcMain.handle('flame:status', () => ({ available: Boolean(extensionHost?.primary), open: flamePanels.has(activeBrowserTabId) && !flamePanelHidden }));

app.whenReady().then(initializeApp);

app.on('window-all-closed', () => {
  if (automationService) {
    automationService.stop();
  }
  if (process.platform !== 'darwin') app.quit();
});

function closeAllBrowserTabs() {
  for (const tabId of [...browserViews.keys()]) closeTab(tabId);
}

async function clearBrowserSessionData(sessions) {
  await Promise.all(sessions.map(async (ses) => {
    try { await ses.flushStorageData(); } catch {}
    // Os dados das extensões (configurações e chave do Flame) ficam: só os dados dos sites são apagados.
    const extensionOrigins = extensionHost ? extensionHost.extensionOrigins() : [];
    const clearSites = extensionOrigins.length && typeof ses.clearData === 'function'
      ? ses.clearData({ excludeOrigins: extensionOrigins }).catch(() => ses.clearStorageData())
      : ses.clearStorageData();
    await Promise.allSettled([
      clearSites,
      ses.clearCache(),
      ses.clearAuthCache()
    ]);
  }));
}

app.on('before-quit', (event) => {
  if (quitCleanupComplete) return;
  let clearOnExit = false;
  try { clearOnExit = store.getStore().get('privacy.clearOnExit') === true; } catch {}
  if (!shuttingDown) saveSessionTabs({ force: true });
  shuttingDown = true;
  clearTimeout(sessionSaveTimer);
  if (clearOnExit && !quitCleanupStarted) {
    try { store.getStore().set('session.lastTabs', []); library?.history.deleteAll(); fs.rmSync(downloadHistoryFile(), { force: true }); } catch (error) { logError(error); }
  }
  if (!clearOnExit) {
    closeAllBrowserTabs();
    return;
  }

  event.preventDefault();
  if (quitCleanupStarted) return;
  quitCleanupStarted = true;
  const sessions = [...browserSessions];
  closeAllBrowserTabs();
  clearBrowserSessionData(sessions).catch(logError).finally(() => {
    browserSessions.clear();
    quitCleanupComplete = true;
    app.quit();
  });
});

// Hospeda extensões MV3 (o Flame) dentro do Navegante. O Electron carrega a extensão e cuida de runtime, storage,
// scripting e mensagens; aqui ficam as APIs que ele não tem, respondendo ao chrome-shim-preload.js.
// O id de aba visto pela extensão é o webContents.id, o mesmo que o chrome.scripting nativo do Electron usa.
const path = require('path');
const { ipcMain } = require('electron');

const SHIM = path.join(__dirname, 'chrome-shim-preload.js');
const WINDOW_ID = 1;

function matchPatternToRegExp(pattern) {
  if (pattern === '<all_urls>') return /^(https?|file|ftp):/;
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

function globToRegExp(glob) {
  return new RegExp(`^${glob.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`, 'i');
}

class ExtensionHost {
  // browser: adaptador do main.js (listTabs, activeWebContents, createTab, closeTab, activate, openSidePanel...).
  constructor({ session, browser }) {
    this.session = session;
    this.browser = browser;
    this.extensions = new Map(); // id -> Electron.Extension
    this.tabMeta = new Map(); // webContents.id -> { pinned, groupId }
    this.groups = new Map(); // groupId -> { id, title, color, collapsed, windowId }
    this.nextGroupId = 1;
    this.panelOptions = new Map(); // tabId -> { path, enabled }
    this.globalPanel = { enabled: true, path: null };
    this.debuggerOwned = new Set();
    this.debuggerAttachedHere = new Set();
    this.debuggerHooked = new WeakSet();
    this.workers = new Map(); // versionId -> ServiceWorkerMain
    this.recentlyClosed = [];
    this.nextDownloadId = 1;
    this.contextMenus = new Map();
    this.handlers = this.createHandlers();
  }

  async start(extensionPaths) {
    this.session.registerPreloadScript({ type: 'frame', id: 'navegante-chrome-shim-frame', filePath: SHIM });
    this.session.registerPreloadScript({ type: 'service-worker', id: 'navegante-chrome-shim-sw', filePath: SHIM });

    ipcMain.handle('navegante-ext:call', (event, method, args) => {
      if (!this.isExtensionUrl(event.senderFrame?.url)) return { error: 'Origem não autorizada' };
      return this.dispatch(method, args, { webContents: event.sender });
    });
    this.session.serviceWorkers.on('running-status-changed', ({ versionId, runningStatus }) => {
      if (runningStatus === 'stopped') {
        this.workers.delete(versionId);
        return;
      }
      if (this.workers.has(versionId)) return;
      const worker = this.session.serviceWorkers.getWorkerFromVersionID(versionId);
      if (!worker || !this.isExtensionUrl(worker.scope)) return;
      this.workers.set(versionId, worker);
      worker.ipc.removeHandler('navegante-ext:call');
      worker.ipc.handle('navegante-ext:call', (_event, method, args) => this.dispatch(method, args, {}));
    });

    const loaded = [];
    for (const extensionPath of extensionPaths) {
      try {
        const extension = await this.session.extensions.loadExtension(extensionPath, { allowFileAccess: true });
        this.extensions.set(extension.id, extension);
        this.globalPanel.path = extension.manifest.side_panel?.default_path || null;
        loaded.push(extension);
      } catch (error) {
        loaded.push({ error: error.message, path: extensionPath });
      }
    }
    return loaded;
  }

  get primary() {
    return this.extensions.values().next().value || null;
  }

  isExtensionUrl(url) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'chrome-extension:' && this.extensions.has(parsed.host);
    } catch {
      return false;
    }
  }

  extensionOrigins() {
    return [...this.extensions.keys()].map((id) => `chrome-extension://${id}`);
  }

  extensionUrl(relativePath) {
    return this.primary ? `chrome-extension://${this.primary.id}/${String(relativePath).replace(/^\//, '')}` : null;
  }

  async dispatch(method, args = [], context) {
    const handler = this.handlers[method];
    if (!handler) return { error: `${method} não está disponível no Navegante` };
    try {
      return { value: await handler(...(Array.isArray(args) ? args : []), context) };
    } catch (error) {
      return { error: error?.message || String(error) };
    }
  }

  emit(name, ...args) {
    for (const worker of this.workers.values()) {
      try { worker.send('navegante-ext:event', name, args); } catch {}
    }
    for (const webContents of this.browser.extensionPages()) {
      if (!webContents.isDestroyed()) webContents.send('navegante-ext:event', name, args);
    }
  }

  // --- Abas -------------------------------------------------------------------------------------------------

  // Chamado pelo main.js para cada aba nova; traduz os eventos do webContents em chrome.tabs.onUpdated etc.
  registerTab(webContents) {
    const id = webContents.id;
    this.tabMeta.set(id, { pinned: false, groupId: -1 });
    const changed = (info) => {
      if (webContents.isDestroyed()) return;
      this.emit('tabs.onUpdated', id, info, this.tabInfo(webContents));
    };
    webContents.on('did-start-loading', () => changed({ status: 'loading' }));
    webContents.on('did-stop-loading', () => changed({ status: 'complete' }));
    webContents.on('did-navigate', (_e, url) => changed({ url }));
    webContents.on('did-navigate-in-page', (_e, url, isMainFrame) => { if (isMainFrame) changed({ url }); });
    webContents.on('page-title-updated', (_e, title) => changed({ title }));
    webContents.on('page-favicon-updated', (_e, favicons) => changed({ favIconUrl: favicons[0] }));
    webContents.on('media-started-playing', () => changed({ audible: true }));
    webContents.on('media-paused', () => changed({ audible: false }));
    webContents.once('destroyed', () => {
      const meta = this.tabMeta.get(id);
      this.tabMeta.delete(id);
      this.panelOptions.delete(id);
      this.debuggerOwned.delete(id);
      if (meta && meta.groupId !== -1) this.pruneGroup(meta.groupId);
      this.emit('tabs.onRemoved', id, { windowId: WINDOW_ID, isWindowClosing: false });
    });
    this.emit('tabs.onCreated', this.tabInfo(webContents));
  }

  tabActivated(webContents) {
    if (!webContents || webContents.isDestroyed()) return;
    this.emit('tabs.onActivated', { tabId: webContents.id, windowId: WINDOW_ID });
  }

  rememberClosed(url, title) {
    if (!url || url === 'about:blank') return;
    this.recentlyClosed.unshift({ lastModified: Math.floor(Date.now() / 1000), tab: { url, title, sessionId: String(Date.now()) } });
    this.recentlyClosed.length = Math.min(this.recentlyClosed.length, 25);
  }

  tabInfo(webContents) {
    const tabs = this.browser.listTabs();
    const index = tabs.findIndex((wc) => wc.id === webContents.id);
    const active = this.browser.activeWebContents()?.id === webContents.id;
    const meta = this.tabMeta.get(webContents.id) || { pinned: false, groupId: -1 };
    const favicon = this.browser.faviconOf?.(webContents);
    return {
      id: webContents.id,
      index,
      windowId: WINDOW_ID,
      openerTabId: undefined,
      active,
      highlighted: active,
      selected: active,
      pinned: meta.pinned,
      groupId: meta.groupId,
      audible: webContents.isCurrentlyAudible(),
      mutedInfo: { muted: webContents.isAudioMuted() },
      discarded: false,
      autoDiscardable: true,
      incognito: false,
      url: webContents.getURL(),
      pendingUrl: undefined,
      title: webContents.getTitle(),
      favIconUrl: favicon || undefined,
      status: webContents.isLoading() ? 'loading' : 'complete',
      width: this.browser.viewBounds?.()?.width,
      height: this.browser.viewBounds?.()?.height
    };
  }

  webContentsFor(tabId) {
    const found = this.browser.listTabs().find((wc) => wc.id === tabId);
    if (!found) throw new Error(`No tab with id: ${tabId}.`);
    return found;
  }

  queryTabs(filter = {}) {
    return this.browser.listTabs().map((wc) => this.tabInfo(wc)).filter((tab) => {
      if (filter.active !== undefined && tab.active !== filter.active) return false;
      if (filter.highlighted !== undefined && tab.highlighted !== filter.highlighted) return false;
      if (filter.pinned !== undefined && tab.pinned !== filter.pinned) return false;
      if (filter.audible !== undefined && tab.audible !== filter.audible) return false;
      if (filter.muted !== undefined && tab.mutedInfo.muted !== filter.muted) return false;
      if (filter.status && tab.status !== filter.status) return false;
      if (filter.groupId !== undefined && tab.groupId !== filter.groupId) return false;
      if (filter.index !== undefined && tab.index !== filter.index) return false;
      if (filter.windowId !== undefined && filter.windowId >= 0 && filter.windowId !== WINDOW_ID) return false;
      if (filter.title && !globToRegExp(filter.title).test(tab.title)) return false;
      if (filter.url) {
        const patterns = Array.isArray(filter.url) ? filter.url : [filter.url];
        if (!patterns.some((p) => matchPatternToRegExp(p).test(tab.url))) return false;
      }
      return true;
    });
  }

  async createTab(props = {}) {
    const webContents = await this.browser.createTab(props.url || 'about:blank', { active: props.active !== false });
    return this.tabInfo(webContents);
  }

  windowInfo(populate) {
    const bounds = this.browser.windowBounds();
    return {
      id: WINDOW_ID,
      focused: this.browser.isFocused(),
      top: bounds.y,
      left: bounds.x,
      width: bounds.width,
      height: bounds.height,
      incognito: false,
      type: 'normal',
      state: this.browser.windowState(),
      alwaysOnTop: false,
      tabs: populate ? this.queryTabs() : undefined
    };
  }

  // --- Grupos ----------------------------------------------------------------------------------------------

  pruneGroup(groupId) {
    const stillUsed = [...this.tabMeta.values()].some((meta) => meta.groupId === groupId);
    if (stillUsed || !this.groups.has(groupId)) return;
    const group = this.groups.get(groupId);
    this.groups.delete(groupId);
    this.emit('tabGroups.onRemoved', group);
  }

  // --- Depurador (CDP) -------------------------------------------------------------------------------------

  hookDebugger(webContents) {
    if (this.debuggerHooked.has(webContents)) return;
    this.debuggerHooked.add(webContents);
    const tabId = webContents.id;
    webContents.debugger.on('message', (_event, method, params, sessionId) => {
      if (!this.debuggerOwned.has(tabId)) return;
      this.emit('debugger.onEvent', sessionId ? { tabId, sessionId } : { tabId }, method, params);
    });
    webContents.debugger.on('detach', (_event, reason) => {
      this.debuggerAttachedHere.delete(tabId);
      if (!this.debuggerOwned.delete(tabId)) return;
      if (!webContents.isDestroyed()) webContents.setBackgroundThrottling?.(true);
      this.emit('debugger.onDetach', { tabId }, reason === 'target closed' ? 'target_closed' : 'canceled_by_user');
    });
  }

  createHandlers() {
    const host = this;
    const tabArg = (tabId, context) => (typeof tabId === 'number' ? tabId : host.browser.activeWebContents()?.id);
    return {
      // tabs
      'tabs.get': (tabId) => host.tabInfo(host.webContentsFor(tabId)),
      'tabs.getCurrent': (context) => {
        const id = context?.webContents?.id;
        return host.tabMeta.has(id) ? host.tabInfo(context.webContents) : undefined;
      },
      'tabs.query': (filter) => host.queryTabs(filter),
      'tabs.create': (props) => host.createTab(props),
      'tabs.update': async (tabIdOrProps, maybeProps) => {
        const [tabId, props] = typeof tabIdOrProps === 'object' && tabIdOrProps !== null
          ? [host.browser.activeWebContents()?.id, tabIdOrProps]
          : [tabIdOrProps, maybeProps || {}];
        const webContents = host.webContentsFor(tabId);
        if (props.url) webContents.loadURL(props.url).catch(() => {});
        if (props.active || props.highlighted) host.browser.activate(webContents);
        if (props.muted !== undefined) webContents.setAudioMuted(Boolean(props.muted));
        if (props.pinned !== undefined) host.tabMeta.get(tabId).pinned = Boolean(props.pinned);
        return host.tabInfo(webContents);
      },
      'tabs.remove': (ids) => {
        for (const id of Array.isArray(ids) ? ids : [ids]) host.browser.closeTab(host.webContentsFor(id));
      },
      'tabs.reload': (tabId, props) => {
        const webContents = host.webContentsFor(tabArg(tabId));
        if (props?.bypassCache) webContents.reloadIgnoringCache();
        else webContents.reload();
      },
      'tabs.duplicate': (tabId) => host.createTab({ url: host.webContentsFor(tabId).getURL(), active: true }),
      'tabs.highlight': ({ tabs: indices }) => {
        const first = Array.isArray(indices) ? indices[0] : indices;
        const target = host.browser.listTabs()[first];
        if (target) host.browser.activate(target);
        return host.windowInfo(true);
      },
      'tabs.captureVisibleTab': async (windowIdOrOptions, maybeOptions) => {
        const options = (typeof windowIdOrOptions === 'object' ? windowIdOrOptions : maybeOptions) || {};
        const webContents = host.browser.activeWebContents();
        if (!webContents) throw new Error('Nenhuma aba ativa');
        const image = await webContents.capturePage();
        if (options.format === 'png') return image.toDataURL();
        return `data:image/jpeg;base64,${image.toJPEG(options.quality ?? 90).toString('base64')}`;
      },
      'tabs.goBack': (tabId) => host.webContentsFor(tabArg(tabId)).navigationHistory.goBack(),
      'tabs.goForward': (tabId) => host.webContentsFor(tabArg(tabId)).navigationHistory.goForward(),
      'tabs.getZoom': (tabId) => host.webContentsFor(tabArg(tabId)).getZoomFactor(),
      'tabs.setZoom': (tabId, factor) => host.webContentsFor(tabArg(tabId)).setZoomFactor(factor || 1),
      'tabs.move': (ids) => (Array.isArray(ids) ? ids.map((id) => host.tabInfo(host.webContentsFor(id))) : host.tabInfo(host.webContentsFor(ids))),
      'tabs.discard': (tabId) => host.tabInfo(host.webContentsFor(tabArg(tabId))),
      'tabs.detectLanguage': () => 'und',
      'tabs.group': ({ tabIds, groupId, createProperties } = {}) => {
        let id = groupId;
        if (id === undefined || !host.groups.has(id)) {
          id = host.nextGroupId++;
          host.groups.set(id, { id, title: '', color: 'blue', collapsed: false, windowId: createProperties?.windowId || WINDOW_ID });
          host.emit('tabGroups.onCreated', host.groups.get(id));
        }
        for (const tabId of Array.isArray(tabIds) ? tabIds : [tabIds]) {
          const meta = host.tabMeta.get(tabId);
          if (!meta) continue;
          const previous = meta.groupId;
          meta.groupId = id;
          if (previous !== -1 && previous !== id) host.pruneGroup(previous);
          host.emit('tabs.onUpdated', tabId, { groupId: id }, host.tabInfo(host.webContentsFor(tabId)));
        }
        host.browser.groupsChanged?.(host.groupsSnapshot());
        return id;
      },
      'tabs.ungroup': (tabIds) => {
        for (const tabId of Array.isArray(tabIds) ? tabIds : [tabIds]) {
          const meta = host.tabMeta.get(tabId);
          if (!meta || meta.groupId === -1) continue;
          const previous = meta.groupId;
          meta.groupId = -1;
          host.pruneGroup(previous);
          host.emit('tabs.onUpdated', tabId, { groupId: -1 }, host.tabInfo(host.webContentsFor(tabId)));
        }
        host.browser.groupsChanged?.(host.groupsSnapshot());
      },

      // windows (o Navegante tem uma janela só)
      'windows.get': (_id, info) => host.windowInfo(info?.populate),
      'windows.getCurrent': (info) => host.windowInfo(info?.populate),
      'windows.getLastFocused': (info) => host.windowInfo(info?.populate),
      'windows.getAll': (info) => [host.windowInfo(info?.populate)],
      'windows.create': async (data = {}) => {
        const urls = Array.isArray(data.url) ? data.url : [data.url || 'about:blank'];
        for (const url of urls) await host.createTab({ url, active: data.focused !== false });
        return host.windowInfo(true);
      },
      'windows.update': (_id, props = {}) => {
        if (props.focused) host.browser.focus();
        return host.windowInfo(false);
      },
      'windows.remove': () => undefined,

      // tabGroups
      'tabGroups.get': (groupId) => {
        const group = host.groups.get(groupId);
        if (!group) throw new Error(`No group with id: ${groupId}.`);
        return group;
      },
      'tabGroups.query': (filter = {}) => [...host.groups.values()].filter((g) =>
        (filter.title === undefined || globToRegExp(filter.title).test(g.title))
        && (filter.color === undefined || g.color === filter.color)
        && (filter.collapsed === undefined || g.collapsed === filter.collapsed)),
      'tabGroups.update': (groupId, props = {}) => {
        const group = host.groups.get(groupId);
        if (!group) throw new Error(`No group with id: ${groupId}.`);
        for (const key of ['title', 'color', 'collapsed']) if (props[key] !== undefined) group[key] = props[key];
        host.emit('tabGroups.onUpdated', group);
        host.browser.groupsChanged?.(host.groupsSnapshot());
        return group;
      },
      'tabGroups.move': (groupId) => host.groups.get(groupId),

      // debugger
      'debugger.attach': ({ tabId }) => {
        const webContents = host.webContentsFor(tabId);
        host.hookDebugger(webContents);
        if (host.debuggerOwned.has(tabId)) throw new Error(`Another debugger is already attached to the tab with id: ${tabId}.`);
        if (!webContents.debugger.isAttached()) {
          webContents.debugger.attach('1.3');
          host.debuggerAttachedHere.add(tabId);
        }
        host.debuggerOwned.add(tabId);
        // Igual ao motor do Navegante: com a janela coberta, a aba congelada faz cada evento de entrada esperar segundos.
        webContents.setBackgroundThrottling?.(false);
      },
      'debugger.detach': ({ tabId }) => {
        if (!host.debuggerOwned.delete(tabId)) throw new Error(`Debugger is not attached to the tab with id: ${tabId}.`);
        const webContents = host.webContentsFor(tabId);
        webContents.setBackgroundThrottling?.(true);
        // Se o agente do Navegante já estava conectado antes, o depurador continua com ele.
        if (host.debuggerAttachedHere.delete(tabId)) {
          try { webContents.debugger.detach(); } catch {}
        }
      },
      'debugger.sendCommand': ({ tabId, sessionId }, method, params) => {
        if (!host.debuggerOwned.has(tabId)) throw new Error(`Debugger is not attached to the tab with id: ${tabId}.`);
        return host.webContentsFor(tabId).debugger.sendCommand(method, params || {}, sessionId);
      },
      'debugger.getTargets': () => host.browser.listTabs().map((wc) => ({
        type: 'page', id: String(wc.id), tabId: wc.id, url: wc.getURL(), title: wc.getTitle(), attached: host.debuggerOwned.has(wc.id)
      })),

      // sidePanel
      'sidePanel.setOptions': (options = {}) => {
        if (typeof options.tabId === 'number') {
          host.panelOptions.set(options.tabId, { ...(host.panelOptions.get(options.tabId) || {}), ...options });
        } else {
          Object.assign(host.globalPanel, options);
        }
      },
      'sidePanel.getOptions': ({ tabId } = {}) => ({ ...host.globalPanel, ...(host.panelOptions.get(tabId) || {}) }),
      'sidePanel.open': ({ tabId, windowId } = {}) => {
        const id = typeof tabId === 'number' ? tabId : host.browser.activeWebContents()?.id;
        const options = host.panelOptions.get(id) || host.globalPanel;
        const panelPath = options.path || host.globalPanel.path;
        if (!panelPath) throw new Error('Nenhum painel lateral configurado');
        host.browser.openSidePanel(host.webContentsFor(id), host.extensionUrl(panelPath));
      },
      'sidePanel.close': ({ tabId } = {}) => host.browser.closeSidePanel(typeof tabId === 'number' ? host.webContentsFor(tabId) : null),
      'sidePanel.setPanelBehavior': () => undefined,
      'sidePanel.getPanelBehavior': () => ({ openPanelOnActionClick: false }),

      // favoritos e histórico vêm da biblioteca do Navegante
      'bookmarks.getTree': () => host.browser.library?.bookmarks.getTree() || [],
      'bookmarks.get': (ids) => host.browser.library?.bookmarks.get(ids) || [],
      'bookmarks.getChildren': (id) => host.browser.library?.bookmarks.getChildren(id) || [],
      'bookmarks.getRecent': (count) => host.browser.library?.bookmarks.getRecent(count) || [],
      'bookmarks.getSubTree': (id) => host.browser.library?.bookmarks.getSubTree(id) || [],
      'bookmarks.search': (query) => host.browser.library?.bookmarks.search(query) || [],
      'bookmarks.create': (data) => host.libraryWrite('bookmarks', 'create', data),
      'bookmarks.update': (id, changes) => host.libraryWrite('bookmarks', 'update', id, changes),
      'bookmarks.move': (id, destination) => host.libraryWrite('bookmarks', 'move', id, destination),
      'bookmarks.remove': (id) => host.libraryWrite('bookmarks', 'remove', id),
      'bookmarks.removeTree': (id) => host.libraryWrite('bookmarks', 'remove', id),
      'history.search': (query) => host.browser.library?.history.search(query) || [],
      'history.getVisits': ({ url }) => host.browser.library?.history.getVisits(url) || [],
      'history.addUrl': ({ url }) => host.libraryWrite('history', 'add', { url }),
      'history.deleteUrl': ({ url }) => host.libraryWrite('history', 'deleteUrl', url),
      'history.deleteRange': (range) => host.libraryWrite('history', 'deleteRange', range),
      'history.deleteAll': () => host.libraryWrite('history', 'deleteAll'),

      // downloads
      'downloads.download': ({ url } = {}) => {
        if (!/^(https?|data|blob):/.test(String(url))) throw new Error('URL de download inválida');
        host.session.downloadURL(url);
        return host.nextDownloadId++;
      },
      'downloads.search': () => host.browser.downloads?.() || [],
      'downloads.pause': () => undefined,
      'downloads.resume': () => undefined,
      'downloads.cancel': () => undefined,
      'downloads.erase': () => [],
      'downloads.open': () => undefined,
      'downloads.show': () => undefined,
      'downloads.showDefaultFolder': () => host.browser.showDownloadsFolder?.(),

      // webNavigation: frameId 0 é a página principal, como no Chrome
      'webNavigation.getAllFrames': ({ tabId }) => {
        const main = host.webContentsFor(tabId).mainFrame;
        const idOf = (frame) => (frame === main ? 0 : frame.routingId);
        return main.framesInSubtree.map((frame) => ({
          frameId: idOf(frame),
          parentFrameId: frame.parent ? idOf(frame.parent) : -1,
          processId: frame.processId,
          url: frame.url,
          errorOccurred: false
        }));
      },
      'webNavigation.getFrame': ({ tabId, frameId }) => {
        const main = host.webContentsFor(tabId).mainFrame;
        const frame = frameId === 0 ? main : main.framesInSubtree.find((f) => f.routingId === frameId);
        return frame ? { url: frame.url, parentFrameId: frame.parent ? 0 : -1, errorOccurred: false } : null;
      },

      'commands.getAll': () => [],
      'contextMenus.create': (props = {}) => {
        const id = props.id || `menu-${host.contextMenus.size + 1}`;
        host.contextMenus.set(id, props);
        return id;
      },
      'contextMenus.update': (id, props) => { host.contextMenus.set(id, { ...(host.contextMenus.get(id) || {}), ...props }); },
      'contextMenus.remove': (id) => { host.contextMenus.delete(id); },
      'contextMenus.removeAll': () => { host.contextMenus.clear(); },

      'sessions.getRecentlyClosed': (filter) => host.recentlyClosed.slice(0, filter?.maxResults || 25),
      'sessions.restore': async () => {
        const entry = host.recentlyClosed.shift();
        if (!entry) throw new Error('Nada para restaurar');
        return { lastModified: entry.lastModified, tab: await host.createTab({ url: entry.tab.url }) };
      },

      'management.getSelf': () => host.selfInfo(),
      'management.get': () => host.selfInfo(),
      'management.getAll': () => [host.selfInfo()],
      'management.setEnabled': () => { throw new Error('Não suportado no Navegante'); },
      'management.uninstall': () => { throw new Error('Não suportado no Navegante'); },

      'action.setBadgeText': () => undefined,
      'action.setBadgeBackgroundColor': () => undefined,
      'action.setTitle': () => undefined,
      'action.setIcon': () => undefined,
      'runtime.openOptionsPage': () => {
        const page = host.primary?.manifest.options_ui?.page || host.primary?.manifest.options_page;
        if (!page) throw new Error('A extensão não tem página de opções');
        return host.createTab({ url: host.extensionUrl(page) }).then(() => undefined);
      }
    };
  }

  libraryWrite(area, operation, ...args) {
    const library = this.browser.library?.[area];
    if (!library) throw new Error('Biblioteca indisponível');
    const result = library[operation](...args);
    return result;
  }

  groupsSnapshot() {
    const members = {};
    for (const [tabId, meta] of this.tabMeta) if (meta.groupId !== -1) (members[meta.groupId] ||= []).push(tabId);
    return [...this.groups.values()].map((group) => ({ ...group, tabIds: members[group.id] || [] }));
  }

  selfInfo() {
    const ext = this.primary;
    return { id: ext?.id, name: ext?.name, version: ext?.version, enabled: true, type: 'extension', installType: 'development' };
  }

  // Abre o painel da extensão na aba ativa (botão do agente na barra do Navegante).
  openPanelForActiveTab() {
    const webContents = this.browser.activeWebContents();
    if (!webContents) return false;
    const options = this.panelOptions.get(webContents.id);
    const panelPath = options?.path || `${this.globalPanel.path}?tabId=${webContents.id}`;
    if (!this.globalPanel.path && !options?.path) return false;
    this.browser.openSidePanel(webContents, this.extensionUrl(panelPath));
    return true;
  }
}

module.exports = { ExtensionHost, matchPatternToRegExp };

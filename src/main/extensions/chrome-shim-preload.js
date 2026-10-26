// Preload de sessão para as páginas e o service worker de extensões (Flame). O Electron implementa só parte da
// API chrome.*; este arquivo completa o que falta (debugger, sidePanel, tabGroups, bookmarks, history, downloads,
// windows, webNavigation...) repassando cada chamada ao processo principal. Roda em sandbox: só pode usar 'electron'.
const { contextBridge, ipcRenderer } = require('electron');

const isWorker = typeof window === 'undefined';
const isExtensionPage = !isWorker && globalThis.location?.protocol === 'chrome-extension:';

if (isWorker || isExtensionPage) {
  const listeners = new Set();
  ipcRenderer.on('navegante-ext:event', (_event, name, args) => {
    for (const callback of listeners) callback(name, args);
  });
  const bridge = {
    invoke: (method, args) => ipcRenderer.invoke('navegante-ext:call', method, args),
    subscribe: (callback) => { listeners.add(callback); }
  };
  contextBridge.executeInMainWorld({ func: installChromeShim, args: [bridge] });
}

// Executa no mundo da página (é serializado pelo contextBridge), então não pode usar nada de fora da função.
function installChromeShim(bridge) {
  const chromeApi = globalThis.chrome;
  if (!chromeApi || chromeApi.__naveganteShim) return;
  Object.defineProperty(chromeApi, '__naveganteShim', { value: true });

  let lastError;
  try {
    Object.defineProperty(chromeApi.runtime, 'lastError', { configurable: true, get: () => lastError });
  } catch {}

  const events = new Map();
  function makeEvent(name) {
    const set = new Set();
    events.set(name, set);
    return {
      addListener: (fn) => set.add(fn),
      removeListener: (fn) => set.delete(fn),
      hasListener: (fn) => set.has(fn),
      hasListeners: () => set.size > 0
    };
  }
  bridge.subscribe((name, args) => {
    for (const fn of events.get(name) || []) {
      try { fn(...args); } catch (error) { console.error(`[navegante] listener ${name}`, error); }
    }
  });

  // Aceita os dois estilos da API: promessa e callback no último argumento (com chrome.runtime.lastError).
  function method(name) {
    return (...args) => {
      const callback = typeof args[args.length - 1] === 'function' ? args.pop() : null;
      const promise = bridge.invoke(name, args).then((reply) => {
        if (reply && reply.error) throw new Error(reply.error);
        return reply ? reply.value : undefined;
      });
      if (!callback) return promise;
      promise.then(
        (value) => { lastError = undefined; callback(value); },
        (error) => { lastError = { message: error.message }; try { callback(); } finally { lastError = undefined; } }
      );
      return undefined;
    };
  }

  function define(namespace, api) {
    try {
      Object.defineProperty(chromeApi, namespace, { configurable: true, enumerable: true, writable: true, value: api });
    } catch {
      chromeApi[namespace] = api;
    }
  }

  function build(namespace, methods, eventNames = [], extra = {}) {
    const api = { ...extra };
    for (const m of methods) api[m] = method(`${namespace}.${m}`);
    for (const e of eventNames) api[e] = makeEvent(`${namespace}.${e}`);
    return api;
  }

  const nativeTabs = chromeApi.tabs || {};
  const nativeScripting = chromeApi.scripting;
  const tabs = build('tabs',
    ['get', 'query', 'create', 'update', 'remove', 'reload', 'duplicate', 'highlight', 'captureVisibleTab', 'group',
      'ungroup', 'goBack', 'goForward', 'getZoom', 'setZoom', 'move', 'discard', 'detectLanguage'],
    ['onCreated', 'onUpdated', 'onRemoved', 'onActivated', 'onMoved', 'onReplaced', 'onHighlighted', 'onAttached',
      'onDetached', 'onZoomChange'],
    { TAB_ID_NONE: -1 });
  // Mensagens para o content script continuam com a implementação nativa do Electron.
  for (const m of ['sendMessage', 'connect', 'executeScript', 'insertCSS', 'removeCSS']) {
    if (typeof nativeTabs[m] === 'function') tabs[m] = nativeTabs[m].bind(nativeTabs);
  }
  tabs.getCurrent = method('tabs.getCurrent');
  define('tabs', tabs);
  if (nativeScripting) define('scripting', nativeScripting);

  define('windows', build('windows', ['get', 'getAll', 'getCurrent', 'getLastFocused', 'create', 'update', 'remove'],
    ['onCreated', 'onRemoved', 'onFocusChanged', 'onBoundsChanged'], { WINDOW_ID_NONE: -1, WINDOW_ID_CURRENT: -2 }));
  define('tabGroups', build('tabGroups', ['get', 'query', 'update', 'move'], ['onCreated', 'onUpdated', 'onRemoved', 'onMoved'], {
    TAB_GROUP_ID_NONE: -1,
    Color: { GREY: 'grey', BLUE: 'blue', RED: 'red', YELLOW: 'yellow', GREEN: 'green', PINK: 'pink', PURPLE: 'purple', CYAN: 'cyan', ORANGE: 'orange' }
  }));
  define('debugger', build('debugger', ['attach', 'detach', 'sendCommand', 'getTargets'], ['onEvent', 'onDetach']));
  define('sidePanel', build('sidePanel', ['setOptions', 'getOptions', 'open', 'close', 'setPanelBehavior', 'getPanelBehavior']));
  define('bookmarks', build('bookmarks', ['get', 'getTree', 'getChildren', 'getRecent', 'getSubTree', 'search', 'create', 'update', 'move', 'remove', 'removeTree'],
    ['onCreated', 'onChanged', 'onRemoved', 'onMoved']));
  define('history', build('history', ['search', 'getVisits', 'addUrl', 'deleteUrl', 'deleteRange', 'deleteAll'], ['onVisited', 'onVisitRemoved']));
  define('downloads', build('downloads', ['download', 'search', 'pause', 'resume', 'cancel', 'open', 'show', 'showDefaultFolder', 'erase'],
    ['onCreated', 'onChanged', 'onErased']));
  define('webNavigation', build('webNavigation', ['getFrame', 'getAllFrames'],
    ['onBeforeNavigate', 'onCommitted', 'onCompleted', 'onDOMContentLoaded', 'onErrorOccurred', 'onHistoryStateUpdated']));
  define('commands', build('commands', ['getAll'], ['onCommand']));
  define('contextMenus', build('contextMenus', ['create', 'update', 'remove', 'removeAll'], ['onClicked'], {
    ContextType: { ALL: 'all', PAGE: 'page', SELECTION: 'selection', LINK: 'link', EDITABLE: 'editable', IMAGE: 'image', ACTION: 'action' }
  }));
  define('sessions', build('sessions', ['getRecentlyClosed', 'restore'], ['onChanged'], { MAX_SESSION_RESULTS: 25 }));
  define('management', build('management', ['get', 'getAll', 'getSelf', 'setEnabled', 'uninstall'], ['onInstalled', 'onUninstalled', 'onEnabled', 'onDisabled']));

  // O Electron não tem storage.sync; usa o local para quem lê/grava configurações sincronizadas.
  if (chromeApi.storage) {
    try { Object.defineProperty(chromeApi.storage, 'sync', { configurable: true, value: chromeApi.storage.local }); } catch {}
  }
  if (chromeApi.action) {
    chromeApi.action.onClicked = makeEvent('action.onClicked');
    for (const m of ['setBadgeText', 'setBadgeBackgroundColor', 'setTitle', 'setIcon']) chromeApi.action[m] = method(`action.${m}`);
  }
  chromeApi.runtime.openOptionsPage = method('runtime.openOptionsPage');
}

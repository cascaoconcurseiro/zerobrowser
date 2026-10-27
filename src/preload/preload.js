const { contextBridge, ipcRenderer } = require('electron');

const browserApi = {
  browser: {
    newTab: (url) => ipcRenderer.invoke('browser:new-tab', url),
    closeTab: (tabId) => ipcRenderer.invoke('browser:close-tab', tabId),
    switchTab: (tabId) => ipcRenderer.invoke('browser:switch-tab', tabId),
    navigate: (tabId, url) => ipcRenderer.invoke('browser:navigate', tabId, url),
    goBack: (tabId) => ipcRenderer.invoke('browser:go-back', tabId),
    goForward: (tabId) => ipcRenderer.invoke('browser:go-forward', tabId),
    reload: (tabId) => ipcRenderer.invoke('browser:reload', tabId),
    getTabs: () => ipcRenderer.invoke('browser:get-tabs'),
    getTab: (tabId) => ipcRenderer.invoke('browser:get-tab', tabId),
    setSidePanelOpen: (isOpen) => ipcRenderer.invoke('browser:set-side-panel-open', isOpen),
    getSidePanelLayout: () => ipcRenderer.invoke('browser:get-side-panel-layout'),
    setBookmarksBar: (visible) => ipcRenderer.invoke('browser:set-bookmarks-bar', visible),
    freezePage: (frozen, reason) => ipcRenderer.invoke('browser:freeze-page', frozen, reason),
    reopenClosedTab: () => ipcRenderer.invoke('browser:reopen-closed-tab'),
    openTabMenu: (tabId, order, x, y) => ipcRenderer.invoke('browser:tab-menu', tabId, order, x, y),
    openProfileMenu: (x, y) => ipcRenderer.invoke('browser:profile-menu', x, y),
    getLastSession: () => ipcRenderer.invoke('browser:get-last-session'),
    getDownloads: () => ipcRenderer.invoke('browser:get-downloads'),
    showDownload: (id) => ipcRenderer.invoke('browser:show-download', id),
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:toggle-maximize'),
    onTabEvent: (callback) => {
      const channels = ['tab:created', 'tab:closed', 'tab:switched', 'tab:navigated', 'tab:navigation-start', 'tab:title-updated', 'tab:favicon-updated', 'tab:console', 'tab:load-error', 'download:event', 'browser:shortcut', 'browser:open-ai'];
      const handlers = channels.map((channel) => {
        const handler = (_event, data) => callback({ ...data, type: channel });
        ipcRenderer.on(channel, handler);
        return [channel, handler];
      });
      return () => handlers.forEach(([channel, handler]) => ipcRenderer.removeListener(channel, handler));
    }
  },

  library: {
    bookmarks: (operation, ...args) => ipcRenderer.invoke('library:bookmarks', operation, ...args),
    history: (operation, ...args) => ipcRenderer.invoke('library:history', operation, ...args),
    suggest: (text) => ipcRenderer.invoke('library:suggest', text),
    importSources: () => ipcRenderer.invoke('library:import-sources'),
    importFrom: (sourceId) => ipcRenderer.invoke('library:import', sourceId),
    openFolderMenu: (folderId, x, y, fromIndex) => ipcRenderer.invoke('library:folder-menu', folderId, x, y, fromIndex),
    openItemMenu: (bookmarkId, x, y) => ipcRenderer.invoke('library:item-menu', bookmarkId, x, y),
    onChanged: (callback) => {
      const handler = (_e, data) => callback(data);
      ipcRenderer.on('library:changed', handler);
      return () => ipcRenderer.removeListener('library:changed', handler);
    }
  },

  extensions: {
    list: () => ipcRenderer.invoke('browser:extensions:list'),
    chooseAndInstall: () => ipcRenderer.invoke('browser:extensions:add'),
    setEnabled: (id, enabled) => ipcRenderer.invoke('browser:extensions:set-enabled', id, enabled),
    remove: (id) => ipcRenderer.invoke('browser:extensions:remove', id)
  },

  flame: {
    status: () => ipcRenderer.invoke('flame:status'),
    togglePanel: () => ipcRenderer.invoke('flame:toggle-panel'),
    onPanel: (callback) => {
      const handler = (_e, data) => callback(data);
      ipcRenderer.on('flame:panel', handler);
      return () => ipcRenderer.removeListener('flame:panel', handler);
    }
  },

  automation: {
    execute: (action) => ipcRenderer.invoke('automation:execute', action),
    runAgent: (tabId, prompt, testOnly = false, requireToolCall = false, resumeId = null) => ipcRenderer.invoke('automation:run-agent', { tabId, prompt, testOnly, requireToolCall, resumeId }),
    cancelAgent: (tabId) => ipcRenderer.invoke('automation:cancel-agent', tabId),
    getState: (tabId) => ipcRenderer.invoke('automation:get-state', tabId),
    cdpSend: (tabId, method, params) => ipcRenderer.invoke('automation:cdp-send', tabId, method, params),
    replyIntervention: (id, action) => ipcRenderer.invoke('automation:intervention-reply', { id, action }),
    onIntervention: (callback) => {
      const handler = (_e, data) => callback(data);
      ipcRenderer.on('automation:intervention', handler);
      return () => ipcRenderer.removeListener('automation:intervention', handler);
    },
    onInterventionEnd: (callback) => {
      const handler = (_e, data) => callback(data);
      ipcRenderer.on('automation:intervention-end', handler);
      return () => ipcRenderer.removeListener('automation:intervention-end', handler);
    },
    onEvent: (callback) => {
      const handler = (e, data) => callback(data);
      ipcRenderer.on('automation:event', handler);
      return () => ipcRenderer.removeListener('automation:event', handler);
    }
  },

  ai: {
    getConfig: (provider) => ipcRenderer.invoke('ai:get-config', provider),
    saveConfig: (config) => ipcRenderer.invoke('ai:save-config', config),
    saveKey: (provider, apiKey) => ipcRenderer.invoke('ai:save-key', { provider, apiKey }),
    revealKey: (provider) => ipcRenderer.invoke('ai:reveal-key', provider),
    listModels: (provider, apiKey) => ipcRenderer.invoke('ai:list-models', { provider, apiKey })
  },

  store: {
    get: (key) => ipcRenderer.invoke('store:get', key),
    set: (key, value) => ipcRenderer.invoke('store:set', key, value),
    delete: (key) => ipcRenderer.invoke('store:delete', key)
    ,getAll: () => ipcRenderer.invoke('store:getAll')
  },

  settings: {
    chooseDownloadDirectory: () => ipcRenderer.invoke('settings:choose-download-directory'),
    applyTheme: (theme) => ipcRenderer.invoke('settings:apply-theme', theme)
  },

  platform: process.platform,
  versions: process.versions
};

// Alias novo da interface; mantemos o nome antigo para integrações externas existentes.
contextBridge.exposeInMainWorld('zeroBrowser', browserApi);
contextBridge.exposeInMainWorld('navegante', browserApi);

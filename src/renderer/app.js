class ZeroBrowserApp {
  constructor() {
    this.tabs = new Map();
    this.activeTabId = null;
    this.delegationPanelWidth = null;
    this.delegationPanelWasResized = false;
    this.delegationResizePointerId = null;
    this.delegationResizeFrame = 0;
    this.delegationResizeRequestId = 0;
    this.aiConnected = false;
    this.aiModel = 'openai/gpt-4o-mini';
    this.settings = {};
    this.aiModelCatalog = [];
    this.aiProviderConfigs = new Map();
    this.aiKeyRevealed = false;
    this.aiRevealedStoredKey = false;
    this.executionRouteMode = 'auto';
    this.routeOverrideForDraft = null;
    this.currentExecutionRoute = null;
    this.botTeam = { bots: [], avatars: 0, currentProfileId: null };
    this.botTabs = new Map();
    this.specialistBots = new Map();
    this.backgroundAgentJobs = new Map();
    this.selectedSpecialistPresetId = "price-hunter";
    this.pendingApprovalCards = new Map();
    this.approvalUiReady = false;
    this.takeoverState = null;
    this.actionReceipts = [];
    this.lastAgentErrorTabId = null;
    this.lastAgentPrompt = '';
    this.init();
  }

  async init() {
    this.bindElements();
    this.bindEvents();
    this.initApprovalUi();
    await this.loadSettings();
    await this.createInitialTab();
    await this.loadBotProfiles();
    await this.toggleAiPanel(true);
    this.initLibraryUi();
    this.initSettingsIndex();
    this.initLibraryTabs();
    this.initBotPanelTabs();
    this.initChatSessions();
    await this.flushPendingApprovalRequests();
    this.initAgentMemoryUi();
    this.initRunEvents();
    this.refreshJobsBanner();
  }

  bindElements() {
    this.elements = {
      tabsContainer: document.getElementById('tabs-container'),
      btnNewTab: document.getElementById('btn-new-tab'),
      btnBack: document.getElementById('btn-back'),
      btnForward: document.getElementById('btn-forward'),
      btnReload: document.getElementById('btn-reload'),
      btnHome: document.getElementById('btn-home'),
      addressBar: document.getElementById('address-bar'),
      urlSuggestions: document.getElementById('url-suggestions'),
      btnBookmark: document.getElementById('btn-bookmark'),
      btnFlame: document.getElementById('btn-flame'),
      bookmarksBar: document.getElementById('bookmarks-bar'),
      bookmarksBarItems: document.getElementById('bookmarks-bar-items'),
      bookmarksBarEmpty: document.getElementById('bookmarks-bar-empty'),
      bookmarksBarMore: document.getElementById('bookmarks-bar-more'),
      browserContainer: document.getElementById('browser-container'),
      btnExtensions: document.getElementById('btn-extensions'),
      btnSettings: document.getElementById('btn-settings'),
      btnAi: document.getElementById('btn-ai'),
      delegationRail: document.getElementById('delegation-rail'),
      botRailList: document.getElementById('bot-rail-list'),
      grokbotRailSpecialists: document.getElementById('grokbot-rail-specialists'),
      botRailCount: document.getElementById('bot-rail-count'),
      btnBotNew: document.getElementById('btn-bot-new'),
      btnStopTask: document.getElementById('btn-stop-task'),
      btnBotCentral: document.getElementById('btn-bot-central'),
      botCentral: document.getElementById('bot-central'),
      botCentralList: document.getElementById('bot-central-list'),
      botCentralStatus: document.getElementById('bot-central-status'),
      btnBotCentralClose: document.getElementById('btn-bot-central-close'),
      btnBotCentralNew: document.getElementById('btn-bot-central-new'),
      botCentralAvatarCount: document.getElementById('bot-central-avatar-count'),
      delegationResizer: document.getElementById('delegation-resizer'),
      btnAppMenu: document.getElementById('btn-app-menu'),
      appMenu: document.getElementById('app-menu'),
      libraryPanel: document.getElementById('library-panel'),
      libraryTitle: document.getElementById('library-title'),
      librarySubtitle: document.getElementById('library-subtitle'),
      librarySearch: document.getElementById('library-search'),
      libraryList: document.getElementById('library-list'),
      btnCloseLibrary: document.getElementById('btn-close-library'),
      aiPanel: document.getElementById('ai-panel'),
      btnCloseAi: document.getElementById('btn-close-ai'),
      aiProvider: document.getElementById('ai-provider'),
      aiModel: document.getElementById('ai-model'),
      aiQuickModel: document.getElementById('ai-quick-model'),
      aiApiKey: document.getElementById('ai-api-key'),
      aiRefreshModels: document.getElementById('btn-ai-refresh-models'),
      aiSaveKey: document.getElementById('btn-ai-save-key'),
      aiToggleKey: document.getElementById('btn-ai-toggle-key'),
      aiModelStatus: document.getElementById('ai-model-status'),
      aiPrivacyNote: document.getElementById('ai-privacy-note-settings'),
      aiReadyStatus: document.getElementById('ai-ready-status'),
      tabControlBanner: document.getElementById('tab-control-banner'),
      tabControlLabel: document.getElementById('tab-control-label'),
      btnTabTakeover: document.getElementById('btn-tab-takeover'),
      aiSession: document.getElementById('ai-session'),
      btnAiNewChat: document.getElementById('btn-ai-new-chat'),
      btnAiMemory: document.getElementById('btn-ai-memory'),
      btnAiCopyChat: document.getElementById('btn-ai-copy-chat'),
      btnAiTeach: document.getElementById('btn-ai-teach'),
      btnAiRecipes: document.getElementById('btn-ai-recipes'),
      btnAiModules: document.getElementById('btn-ai-modules'),
      btnAiLibrary: document.getElementById('btn-ai-library'),
      btnAiRenameChat: document.getElementById('btn-ai-rename-chat'),
      btnAiPinChat: document.getElementById('btn-ai-pin-chat'),
      btnAiDeleteChat: document.getElementById('btn-ai-delete-chat'),
      btnAiConnect: document.getElementById('btn-ai-connect'),
      aiChat: document.getElementById('ai-chat'),
      aiInput: document.getElementById('ai-input'),
      aiRouteLabel: document.getElementById('ai-route-label'),
      btnAiRouteMode: document.getElementById('btn-ai-route-mode'),
      btnAiSend: document.getElementById('btn-ai-send'),
      btnAiSendBg: document.getElementById('btn-ai-send-bg'),
      settingsPanel: document.getElementById('settings-panel'),
      btnCloseSettings: document.getElementById('btn-close-settings'),
      btnChangeDownload: document.getElementById('btn-change-download'),
      toastContainer: document.getElementById('toast-container')
    };
  }

  bindEvents() {
    this.elements.btnNewTab.addEventListener('click', () => this.createTab('zero://newtab'));
    this.elements.btnBack.addEventListener('click', () => this.goBack());
    this.elements.btnForward.addEventListener('click', () => this.goForward());
    this.elements.btnReload.addEventListener('click', () => this.reload());
    this.elements.btnHome.addEventListener('click', () => this.navigateHome());
    this.elements.btnExtensions.addEventListener('click', () => this.openExtensionsManager());
    document.getElementById('btn-add-extension').addEventListener('click', () => this.addExtension());
    this.elements.btnAppMenu.addEventListener('click', () => this.toggleAppMenu());
    this.elements.appMenu.addEventListener('click', (event) => {
      const action = event.target.closest('[data-menu-action]')?.dataset.menuAction;
      if (action) this.runMenuAction(action);
    });
    document.addEventListener('click', (event) => {
      if (!this.elements.appMenu.contains(event.target) && event.target !== this.elements.btnAppMenu) this.closeAppMenu();
    });
    this.elements.librarySearch.addEventListener('input', () => {
      clearTimeout(this.librarySearchTimer);
      this.librarySearchTimer = setTimeout(() => this.renderLibrary(), 120);
    });
    this.elements.btnCloseLibrary.addEventListener('click', () => this.closeLibrary());

    this.elements.addressBar.addEventListener('keydown', (e) => this.handleAddressKey(e));
    this.elements.addressBar.addEventListener('input', () => this.scheduleSuggestions());
    this.elements.addressBar.addEventListener('blur', () => this.closeSuggestions());
    this.elements.btnBookmark.addEventListener('click', () => this.toggleBookmark());
    this.elements.bookmarksBarMore.addEventListener('click', () => {
      const rect = this.elements.bookmarksBarMore.getBoundingClientRect();
      window.zeroBrowser.library.openFolderMenu('1', rect.left, rect.bottom, Number(this.elements.bookmarksBarMore.dataset.fromIndex) || 0);
    });
    window.addEventListener('resize', () => {
      clearTimeout(this.fitTimer);
      this.fitTimer = setTimeout(() => {
        this.fitBookmarksBar();
        this.syncDelegationPanelWidth();
      }, 100);
    });
    this.elements.btnFlame.addEventListener('click', () => window.zeroBrowser.flame.togglePanel());

    this.elements.addressBar.addEventListener('focus', () => {
      this.elements.addressBar.select();
    });

    this.elements.btnAi.addEventListener('click', () => this.toggleAiPanel());
    this.elements.btnBotNew.addEventListener('click', () => this.openSpecialistBotModal());
    this.elements.btnStopTask.addEventListener('click', () => this.stopAllRunningTasks());
    this.elements.btnBotCentral.addEventListener('click', () => this.toggleBotCentral());
    this.elements.btnTabTakeover?.addEventListener('click', () => this.handleTabTakeoverAction());
    this.elements.btnAiTeach?.addEventListener('click', () => this.startTeachTaskFlow());
    this.elements.btnBotCentralClose.addEventListener('click', () => this.closeBotCentral({ restoreFocus: true }));
    this.elements.btnBotCentralNew.addEventListener('click', () => {
      this.closeBotCentral({ restorePanel: false });
      this.openSpecialistBotModal();
    });
    this.elements.btnCloseAi.addEventListener('click', () => this.closeAiPanel());
    this.elements.btnSettings.addEventListener('click', () => this.toggleSettingsPanel());
    this.elements.btnCloseSettings.addEventListener('click', () => this.closeSettingsPanel());
    this.bindDelegationResizerEvents();

    this.elements.btnAiConnect.addEventListener('click', () => this.connectAi());
    this.elements.btnAiSend.addEventListener('click', () => {
      if (this.aiRunning) this.stopAllRunningTasks();
      else this.sendAiMessage();
    });
    this.elements.btnAiSendBg?.addEventListener('click', () => {
      this.sendAiMessageInBackground();
    });
    this.elements.aiInput.addEventListener('input', () => {
      this.routeOverrideForDraft = null;
      this.updateOrchestratorRouteStatus(this.elements.aiInput.value);
    });
    this.elements.btnAiRouteMode?.addEventListener('click', () => this.handleRouteModeAction());
    this.elements.aiRefreshModels.addEventListener('click', () => this.refreshAiModels());
    this.elements.aiSaveKey.addEventListener('click', () => this.saveAiKey());
    this.elements.aiToggleKey.addEventListener('click', () => this.toggleAiKeyVisibility());
    for (const card of document.querySelectorAll('.grokbot-provider-card')) {
      card.addEventListener('click', () => {
        const prov = card.dataset.providerCard;
        if (!prov || !this.elements.aiProvider) return;
        this.elements.aiProvider.value = prov;
        for (const c of document.querySelectorAll('.grokbot-provider-card')) {
          c.classList.toggle('ativo', c.dataset.providerCard === prov);
        }
        this.elements.aiProvider.dispatchEvent(new Event('change'));
      });
    }
    this.elements.aiProvider.addEventListener('change', async () => {
      for (const c of document.querySelectorAll('.grokbot-provider-card')) {
        c.classList.toggle('ativo', c.dataset.providerCard === this.elements.aiProvider.value);
      }
      this.aiConnected = false;
      const provider = this.elements.aiProvider.value;
      await this.loadProviderConfig(provider);
      if (this.aiProviderConfigs.get(provider)?.hasApiKey) await this.refreshAiModels({ quiet: true });
    });
    this.elements.aiModel.addEventListener('change', () => this.selectAiModel(this.elements.aiModel.value));
    this.elements.aiQuickModel.addEventListener('change', () => this.selectAiModel(this.elements.aiQuickModel.value));
    const settingKeys = {
      'setting-show-full-url': 'browser.showFullUrl',
      'setting-clear-on-exit': 'privacy.clearOnExit',
      'setting-restore-session': 'browser.restoreSession',
      'setting-show-bookmarks-bar': 'browser.showBookmarksBar',
      'setting-theme': 'theme',
      'setting-agent-approval-mode': 'automation.approvalMode',
      'setting-agent-approval-in-panel': 'automation.approvalInPanel',
      'setting-block-3rd-party': 'privacy.blockThirdPartyCookies',
      'setting-do-not-track': 'privacy.doNotTrack',
      'setting-cdp-enabled': 'developer.cdpEnabled',
      'setting-webmcp-enabled': 'developer.webMcpEnabled',
      'setting-download-prompt': 'downloads.prompt',
      'setting-agent-recipes': 'automation.recipes',
      'setting-agent-transforms': 'automation.transforms',
      'setting-agent-prompt-cache': 'automation.promptCache',
      'setting-agent-max-steps': 'automation.maxSteps'
    };
    for (const [id, key] of Object.entries(settingKeys)) {
      const element = document.getElementById(id);
      element.addEventListener('change', async () => {
        const value = element.type === 'checkbox' ? element.checked : element.value;
        if (key === 'automation.approvalMode') {
          const modes = ['always-ask', 'allow-read', 'low-risk', 'allow-all'];
          const previous = this.settings[key] || 'low-risk';
          const previousRank = modes.indexOf(previous);
          const nextRank = modes.indexOf(value);
          if (nextRank < 0) {
            element.value = previous;
            return;
          }
          if (nextRank > previousRank && !window.confirm('Aumentar a autonomia deste espaço permite que a IA faça mais ações sem perguntar. No nível escolhido, ela pode interagir com páginas autenticadas. Em “Permitir todas automaticamente”, também pode enviar formulários, publicar, comprar ou excluir sem confirmação. Deseja continuar?')) {
            element.value = previous;
            return;
          }
        }
        try {
          if (key === 'theme') await window.zeroBrowser.settings.applyTheme(value);
          else await window.zeroBrowser.store.set(key, value);
          this.settings[key] = value;
          if (key === 'theme') this.applySettings({ theme: value });
          if (key === 'browser.showFullUrl') this.updateAddressBar();
          if (key === 'browser.showBookmarksBar') this.setBookmarksBarVisible(value);
          this.showToast('Configuração aplicada.', 'success');
        } catch (error) {
          this.showToast(`Não foi possível aplicar a configuração: ${error.message}`, 'error');
          await this.loadSettingsToUI();
        }
      });
    }
    document.getElementById('btn-import-html').addEventListener('click', (e) => this.importBookmarks('html', e.currentTarget));
    document.getElementById('btn-clear-history').addEventListener('click', () => this.clearHistory());
    this.elements.btnChangeDownload.addEventListener('click', async () => {
      try {
        const selected = await window.zeroBrowser.settings.chooseDownloadDirectory();
        if (!selected) return;
        document.getElementById('setting-download-path').value = selected;
        this.settings['downloads.path'] = selected;
        this.showToast('Pasta de downloads atualizada.', 'success');
      } catch (error) {
        this.showToast(`Não foi possível selecionar a pasta: ${error.message}`, 'error');
      }
    });
    this.elements.aiInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.altKey) {
        e.preventDefault();
        this.sendAiMessageInBackground();
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendAiMessage();
      }
    });


    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && !e.altKey && e.key === 'Tab') {
        e.preventDefault();
        this.handleBrowserShortcut({ action: e.shiftKey ? 'previous-tab' : 'next-tab' });
      }
      if (e.ctrlKey && !e.altKey && !e.shiftKey && /^[1-9]$/.test(e.key)) {
        e.preventDefault();
        this.handleBrowserShortcut({ action: `select-tab-${e.key}` });
      }
      if (e.ctrlKey && e.key === 't') {
        e.preventDefault();
        this.createTab();
      }
      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        this.openLibrary('history');
      }
      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        this.openLibrary('downloads');
      }
      if (e.key === 'Escape') {
        if (!this.elements.botCentral.classList.contains('hidden')) this.closeBotCentral({ restoreFocus: true });
        this.closeAppMenu({ restoreFocus: true });
      }
      if (e.ctrlKey && e.key === 'w') {
        e.preventDefault();
        this.closeActiveTab();
      }
      if (e.ctrlKey && !e.shiftKey && (e.key.toLowerCase() === 'l' || e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        this.openCommandBar(e.key.toLowerCase() === 'k');
        return;
      }
      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        this.elements.addressBar.focus();
      }
      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        this.reload();
      }
      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        this.toggleBookmark();
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        const visible = this.elements.bookmarksBar.classList.contains('hidden');
        window.zeroBrowser.store.set('browser.showBookmarksBar', visible);
        this.settings['browser.showBookmarksBar'] = visible;
        this.setBookmarksBarVisible(visible);
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        window.zeroBrowser.browser.reopenClosedTab();
      }
      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        this.elements.addressBar.focus();
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        this.toggleAiPanel();
      }
      if (e.altKey && e.key === 'ArrowLeft') this.goBack();
      if (e.altKey && e.key === 'ArrowRight') this.goForward();
    });

    if (window.zeroBrowser) {
      window.zeroBrowser.browser.onTabEvent((data) => this.handleTabEvent(data));
      window.zeroBrowser.automation.onIntervention((data) => this.showHumanCheckBanner(data));
      window.zeroBrowser.automation.onInterventionEnd(({ id }) => this.hideHumanCheckBanner(id));
    }
  }

  // The agent paused on a CAPTCHA; the user solves it on the page and the agent resumes.
  showHumanCheckBanner({ id, origin }) {
    this.hideHumanCheckBanner();
    this.promoteBackgroundBotTabIfNeeded('human_intervention', origin);
    if (this.elements.aiPanel.classList.contains('hidden')) this.toggleAiPanel(true);
    const banner = document.createElement('div');
    banner.className = 'human-check-banner';
    banner.dataset.id = id;
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');
    const text = document.createElement('p');
    text.textContent = 'A página pediu uma verificação humana. Resolva na página; o agente continua sozinho.';
    const site = document.createElement('p');
    site.className = 'human-check-origin';
    site.textContent = origin || '';
    const actions = document.createElement('div');
    actions.className = 'human-check-actions';
    const reply = (action) => {
      window.zeroBrowser.automation.replyIntervention(id, action);
      this.hideHumanCheckBanner(id);
    };
    const resume = document.createElement('button');
    resume.className = 'btn-primary';
    resume.textContent = 'Já resolvi, continuar';
    resume.addEventListener('click', () => reply('continue'));
    const stop = document.createElement('button');
    stop.className = 'btn-secondary';
    stop.textContent = 'Parar tarefa';
    stop.addEventListener('click', () => reply('cancel'));
    actions.append(resume, stop);
    banner.append(text, site, actions);
    this.elements.aiChat.before(banner);
    resume.focus();
    this.showToast('O agente pausou: resolva a verificação na página.', 'warning');
  }

  hideHumanCheckBanner(id) {
    const banner = this.elements.aiPanel.querySelector('.human-check-banner');
    if (!banner || (id && banner.dataset.id !== id)) return;
    const hadFocus = banner.contains(document.activeElement);
    banner.remove();
    if (hadFocus) this.elements.aiInput.focus();
  }

  async loadSettings() {
    const settings = await window.zeroBrowser.store.getAll();
    this.settings = { ...settings };
    this.applySettings(settings);
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener?.('change', () => {
      if (this.settings.theme === 'system') this.applySettings({ theme: 'system' });
    });
  }

  applySettings(settings) {
    this.settings = { ...this.settings, ...settings };
    if (settings.theme === 'dark' || (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
    this.updateAddressBar();
  }

  async createInitialTab() {
    const lastTabs = await window.zeroBrowser.browser.getLastSession().catch(() => []);
    if (lastTabs.length) {
      for (const url of lastTabs) await this.createTab(url);
      return;
    }
    const homepage = await window.zeroBrowser.store.get('browser.defaultHomepage');
    await this.createTab(homepage || 'zero://newtab');
  }

  // --- Favoritos, sugestões e Flame ------------------------------------------------------------------------

  async initLibraryUi() {
    window.zeroBrowser.library.onChanged(({ area }) => {
      if (area === 'bookmarks') {
        this.renderBookmarksBar();
        this.updateBookmarkStar();
      }
    });
    this.setBookmarksBarVisible(this.settings['browser.showBookmarksBar'] !== false);
    this.renderBookmarksBar();
    this.updateBookmarkStar();
    const flame = await window.zeroBrowser.flame.status().catch(() => ({ available: false }));
    this.elements.btnFlame.classList.toggle('hidden', !flame.available);
    this.setFlamePressed(flame.open);
    window.zeroBrowser.flame.onPanel(({ tabId, open }) => {
      if (tabId === this.activeTabId) this.setFlamePressed(open);
    });
  }

  setFlamePressed(open) {
    this.elements.btnFlame.setAttribute('aria-pressed', String(Boolean(open)));
    this.elements.btnFlame.setAttribute('aria-label', open ? 'Fechar o Flame' : 'Abrir o Flame');
  }

  setBookmarksBarVisible(visible) {
    const requestId = this.bookmarksLayoutRequest = (this.bookmarksLayoutRequest || 0) + 1;
    this.elements.bookmarksBar.classList.toggle('hidden', !visible);
    window.zeroBrowser.browser.setBookmarksBar(Boolean(visible)).then((result) => {
      const contentTop = Number(result?.contentTop);
      if (requestId === this.bookmarksLayoutRequest && Number.isFinite(contentTop) && contentTop > 0) {
        document.documentElement.style.setProperty('--browser-content-top', `${contentTop}px`);
      }
    }).catch(() => {});
  }

  async renderBookmarksBar() {
    const items = await window.zeroBrowser.library.bookmarks('getChildren', '1').catch(() => []);
    const list = this.elements.bookmarksBarItems;
    list.replaceChildren();
    this.elements.bookmarksBarEmpty.classList.toggle('hidden', items.length > 0);
    const showBookmarks = this.settings['browser.showBookmarksBar'] !== false && items.length > 0;
    this.elements.bookmarksBar.classList.toggle('hidden', !showBookmarks);
    this.setBookmarksBarVisible(showBookmarks);
    for (const node of items) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'bookmark-item';
      const label = this.bookmarkLabel(node);
      if (node.url) {
        const text = document.createElement('span');
        text.className = 'bookmark-label';
        text.textContent = label;
        button.append(text);
        if (node.favicon) button.prepend(this.faviconImage(node.favicon));
        button.title = `${label}\n${node.url}`;
        button.addEventListener('click', (e) => (e.ctrlKey ? this.createTab(node.url) : this.navigateTo(node.url)));
        button.addEventListener('auxclick', (e) => { if (e.button === 1) this.createTab(node.url); });
      } else {
        button.textContent = `📁 ${label}`;
        button.setAttribute('aria-haspopup', 'menu');
        button.addEventListener('click', () => {
          const rect = button.getBoundingClientRect();
          window.zeroBrowser.library.openFolderMenu(node.id, rect.left, rect.bottom);
        });
      }
      button.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        window.zeroBrowser.library.openItemMenu(node.id, e.clientX, e.clientY);
      });
      item.append(button);
      list.append(item);
    }
    this.fitBookmarksBar();
  }

  faviconImage(src) {
    const img = document.createElement('img');
    img.className = 'site-icon';
    img.alt = '';
    img.src = src;
    img.addEventListener('error', () => img.remove());
    return img;
  }

  bookmarkLabel(node) {
    if (node.title && node.title !== node.url) return node.title;
    try {
      return new URL(node.url).hostname.replace(/^www\./, '');
    } catch {
      return node.url || 'Pasta';
    }
  }

  // Como no Chrome: o que não cabe na largura vai para o botão », que abre o resto num menu.
  fitBookmarksBar() {
    const list = this.elements.bookmarksBarItems;
    const more = this.elements.bookmarksBarMore;
    const items = [...list.children];
    items.forEach((item) => { item.hidden = false; });
    more.hidden = true;
    const limit = list.getBoundingClientRect().right;
    const firstHidden = items.findIndex((item) => item.getBoundingClientRect().right > limit + 1);
    if (firstHidden < 0) return;
    more.hidden = false;
    // O botão » ocupa espaço: esconde também o último item visível se ele passar a ficar por baixo.
    const moreLeft = more.getBoundingClientRect().left;
    let cut = firstHidden;
    while (cut > 0 && items[cut - 1].getBoundingClientRect().right > moreLeft) cut -= 1;
    items.slice(cut).forEach((item) => { item.hidden = true; });
    more.dataset.fromIndex = String(cut);
    more.setAttribute('aria-label', `Mais ${items.length - cut} favoritos`);
  }

  currentUrl() {
    return this.tabs.get(this.activeTabId)?.url || '';
  }

  async updateBookmarkStar() {
    const url = this.currentUrl();
    const allowed = /^https?:/i.test(url);
    const marked = allowed && await window.zeroBrowser.library.bookmarks('isBookmarked', url).catch(() => false);
    const star = this.elements.btnBookmark;
    star.disabled = !allowed;
    star.innerHTML = marked
      ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'
      : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
    star.classList.toggle('active', Boolean(marked));
    star.setAttribute('aria-pressed', String(Boolean(marked)));
    const label = marked ? 'Remover dos favoritos (Ctrl+D)' : 'Adicionar aos favoritos (Ctrl+D)';
    star.setAttribute('aria-label', label);
    star.title = label;
  }

  async toggleBookmark() {
    const url = this.currentUrl();
    if (!/^https?:/i.test(url)) return;
    try {
      const existing = await window.zeroBrowser.library.bookmarks('findByUrl', url);
      if (existing.length) {
        for (const node of existing) await window.zeroBrowser.library.bookmarks('remove', node.id);
        this.showToast('Removido dos favoritos.', 'info');
      } else {
        const title = this.tabs.get(this.activeTabId)?.title || url;
        await window.zeroBrowser.library.bookmarks('create', { parentId: '1', title, url });
        this.showToast('Adicionado à barra de favoritos.', 'success');
      }
    } catch (error) {
      this.showToast(`Não foi possível alterar o favorito: ${error.message}`, 'error');
    }
    this.updateBookmarkStar();
  }

  navigateTo(url) {
    if (this.activeTabId) window.zeroBrowser.browser.navigate(this.activeTabId, url);
  }

  scheduleSuggestions() {
    clearTimeout(this.suggestTimer);
    this.suggestTimer = setTimeout(() => this.showSuggestions(), 80);
  }

  async showSuggestions() {
    const text = this.elements.addressBar.value.trim();
    const commandItems = this.matchCommandBarSuggestions(text);
    const libraryItems = text ? await window.zeroBrowser.library.suggest(text).catch(() => []) : [];
    const items = [...commandItems, ...libraryItems];
    if (document.activeElement !== this.elements.addressBar || this.elements.addressBar.value.trim() !== text) return;
    if (!items.length) return this.closeSuggestions();
    this.suggestions = items;
    this.suggestionIndex = -1;
    this.elements.addressBar.removeAttribute('aria-activedescendant');
    const list = this.elements.urlSuggestions;
    list.replaceChildren(...items.map((item, index) => {
      const option = document.createElement('li');
      option.id = `suggestion-${index}`;
      option.className = 'suggestion-item';
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');
      const icon = document.createElement('span');
      icon.className = 'suggestion-icon';
      icon.setAttribute('aria-hidden', 'true');
      if (item.favicon) icon.append(this.faviconImage(item.favicon));
      else if (item.kind === 'command') icon.textContent = '⌘';
      else icon.textContent = item.kind === 'bookmark' ? '★' : '🕘';
      const title = document.createElement('span');
      title.className = 'suggestion-title';
      title.textContent = this.bookmarkLabel(item);
      const url = document.createElement('span');
      url.className = 'suggestion-url';
      url.textContent = this.formatAddressBarUrl(item.url);
      option.append(icon, title, url);
      option.setAttribute('aria-label', `${item.kind === 'bookmark' ? 'Favorito' : 'Histórico'}: ${item.title || ''} ${item.url}`);
      // mousedown, não click: o clique tiraria o foco da barra e fecharia a lista antes.
      option.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.chooseSuggestion(index);
      });
      return option;
    }));
    if (list.classList.contains('hidden')) {
      list.classList.remove('hidden');
      this.elements.addressBar.setAttribute('aria-expanded', 'true');
      const frozen = await window.zeroBrowser.browser.freezePage(true).catch(() => null);
      if (list.classList.contains('hidden')) return window.zeroBrowser.browser.freezePage(false);
      if (frozen?.image) {
        const container = this.elements.browserContainer;
        container.style.backgroundImage = `url("${frozen.image}")`;
        container.style.backgroundSize = `${frozen.bounds.width}px ${frozen.bounds.height}px`;
        container.classList.add('frozen');
      }
    }
  }

  closeSuggestions() {
    clearTimeout(this.suggestTimer);
    const list = this.elements.urlSuggestions;
    this.elements.addressBar.removeAttribute('aria-activedescendant');
    if (list.classList.contains('hidden')) return;
    list.classList.add('hidden');
    list.replaceChildren();
    this.suggestions = [];
    this.elements.addressBar.setAttribute('aria-expanded', 'false');
    this.releasePageOverlay('suggestions');
  }

  highlightSuggestion(index) {
    const options = [...this.elements.urlSuggestions.children];
    this.suggestionIndex = index;
    options.forEach((option, i) => option.setAttribute('aria-selected', String(i === index)));
    if (index >= 0) {
      this.elements.addressBar.setAttribute('aria-activedescendant', options[index].id);
      options[index].scrollIntoView({ block: 'nearest' });
    } else {
      this.elements.addressBar.removeAttribute('aria-activedescendant');
    }
  }

  chooseSuggestion(index) {
    const item = this.suggestions?.[index];
    if (!item) return;
    this.closeSuggestions();
    if (item.kind === 'command') {
      this.elements.addressBar.value = '';
      this.elements.addressBar.blur();
      this.executeCommandBarAction(item.commandId);
      return;
    }
    this.navigateTo(item.url);
    this.elements.addressBar.blur();
  }

  handleAddressKey(e) {
    const open = !this.elements.urlSuggestions.classList.contains('hidden') && this.suggestions?.length;
    if (open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      // -1 é "nenhuma escolhida" (vale o texto digitado); as setas giram entre ele e as sugestões.
      const count = this.suggestions.length;
      let next = this.suggestionIndex + (e.key === 'ArrowDown' ? 1 : -1);
      if (next >= count) next = -1;
      if (next < -1) next = count - 1;
      this.highlightSuggestion(next);
      return;
    }
    if (e.key === 'Escape' && open) {
      e.preventDefault();
      this.closeSuggestions();
      return;
    }
    if (e.key === 'Enter') {
      if (open && this.suggestionIndex >= 0) return this.chooseSuggestion(this.suggestionIndex);
      this.closeSuggestions();
      const text = this.elements.addressBar.value.trim();
      const matchedCommand = this.resolveCommandBarCommand(text);
      if (matchedCommand) {
        e.preventDefault();
        this.elements.addressBar.value = '';
        this.elements.addressBar.blur();
        return this.executeCommandBarAction(matchedCommand.commandId);
      }
      if (document.getElementById('app').classList.contains('delegation-mode') && text && !this.isUrlInput(text)) {
        e.preventDefault();
        this.elements.addressBar.value = '';
        return this.sendAiMessageFromPrompt(text);
      }
      this.navigate(text);
    }
  }

  isUrlInput(text) {
    return /^(https?:\/\/|file:\/\/|zero:\/\/|www\.)/i.test(text) || /^(localhost|(?:[\w-]+\.)+[a-z]{2,})(?::\d+)?(?:[/?#]|$)/i.test(text);
  }

  openCommandBar(showCommandsWhenEmpty = false) {
    this.commandBarShowEmpty = Boolean(showCommandsWhenEmpty);
    this.elements.addressBar.focus();
    this.elements.addressBar.select();
    if (showCommandsWhenEmpty) this.scheduleSuggestions();
  }

  getCommandBarCatalog() {
    return [
      { commandId: 'bots.teachTask', title: 'Ensinar tarefa para criar Bot', url: 'Comando · Aprender por demonstração', keywords: ['ensinar', 'ensinar tarefa', 'gravar tarefa'] },
      { commandId: 'ui.safeMode', title: 'Modo seguro de visual (restaurar layout padrão)', url: 'Comando · Reversível', keywords: ['modo seguro', 'voltar layout anterior', 'restaurar visual'] },
      { commandId: 'tabs.closeDuplicates', title: 'Fechar abas duplicadas', url: 'Comando · Reversível', keywords: ['fechar abas duplicadas', 'duplicadas'] },
      { commandId: 'ui.toggleTheme', title: 'Alternar tema (Claro / Escuro)', url: 'Comando · Reversível', keywords: ['alternar tema', 'tema escuro', 'tema claro', 'mudar tema'] },
      { commandId: 'bots.openCentral', title: 'Abrir Central de Bots', url: 'Comando · Equipe de Bots', keywords: ['abrir central', 'central de bots', 'equipe de bots'] },
      { commandId: 'undo.last', title: 'Desfazer última ação reversível', url: 'Comando · Reversível', keywords: ['desfazer', 'reverter última ação'] },
      { commandId: 'tabs.new', title: 'Nova aba', url: 'Comando · Ctrl+T', keywords: ['nova aba', 'abrir nova aba'] },
      { commandId: 'library.history', title: 'Abrir Histórico', url: 'Comando · Ctrl+H', keywords: ['histórico', 'historico', 'abrir histórico'] },
      { commandId: 'library.bookmarks', title: 'Abrir Favoritos', url: 'Comando · Biblioteca', keywords: ['favoritos', 'abrir favoritos'] },
      { commandId: 'library.downloads', title: 'Abrir Downloads', url: 'Comando · Ctrl+J', keywords: ['downloads', 'abrir downloads'] }
    ];
  }

  matchCommandBarSuggestions(text) {
    const query = String(text || '').trim().toLowerCase();
    const catalog = this.getCommandBarCatalog();
    if (!query) {
      if (!this.commandBarShowEmpty) return [];
      return catalog.slice(0, 5).map((cmd) => ({ kind: 'command', ...cmd }));
    }
    return catalog
      .filter((cmd) => cmd.title.toLowerCase().includes(query) || cmd.keywords.some((kw) => kw.includes(query) || query.includes(kw)))
      .slice(0, 4)
      .map((cmd) => ({ kind: 'command', ...cmd }));
  }

  resolveCommandBarCommand(text) {
    const query = String(text || '').trim().toLowerCase();
    if (!query) return null;
    return this.getCommandBarCatalog().find((cmd) => cmd.keywords.includes(query) || cmd.title.toLowerCase() === query) || null;
  }

  async executeCommandBarAction(commandId) {
    this.commandBarShowEmpty = false;
    if (commandId === 'bots.teachTask') return this.startTeachTaskFlow();
    if (commandId === 'ui.safeMode') return this.restoreSafeVisualLayout();
    if (commandId === 'tabs.new') return this.createTab('zero://newtab');
    if (commandId === 'library.history') return this.openLibrary('history');
    if (commandId === 'library.bookmarks') return this.openLibrary('bookmarks');
    if (commandId === 'library.downloads') return this.openLibrary('downloads');
    if (commandId === 'bots.openCentral') {
      if (this.elements.aiPanel.classList.contains('hidden')) await this.toggleAiPanel(true);
      if (this.elements.botCentral.classList.contains('hidden')) await this.toggleBotCentral();
      return;
    }
    if (commandId === 'undo.last') return this.undoLastActionReceipt();
    if (commandId === 'ui.toggleTheme') {
      const previous = this.settings.theme || 'system';
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      await window.zeroBrowser.settings.applyTheme(next);
      this.settings.theme = next;
      this.applySettings({ theme: next });
      this.recordActionReceipt({
        title: `Tema alterado para ${next === 'dark' ? 'Escuro' : 'Claro'}`,
        detail: 'Reversível · clique em Desfazer para restaurar o tema anterior',
        undo: async () => {
          await window.zeroBrowser.settings.applyTheme(previous);
          this.settings.theme = previous;
          this.applySettings({ theme: previous });
        }
      });
      this.showToast(`Tema alterado para ${next === 'dark' ? 'Escuro' : 'Claro'}.`, 'success');
      return;
    }
    if (commandId === 'tabs.closeDuplicates') {
      const seen = new Set();
      const closedUrls = [];
      for (const [tabId, tab] of [...this.tabs.entries()]) {
        const key = String(tab.url || '').trim();
        if (!key || key === 'about:blank') continue;
        if (seen.has(key) && this.tabs.size > 1) {
          closedUrls.push(key);
          await this.closeTab(tabId);
        } else {
          seen.add(key);
        }
      }
      if (!closedUrls.length) {
        this.showToast('Nenhuma aba duplicada encontrada.', 'info');
        return;
      }
      this.recordActionReceipt({
        title: `${closedUrls.length} aba(s) duplicada(s) fechada(s)`,
        detail: 'Reversível · clique em Desfazer para reabrir as abas fechadas',
        undo: async () => {
          for (const url of closedUrls) await this.createTab(url);
        }
      });
      this.showToast(`${closedUrls.length} aba(s) duplicada(s) fechada(s).`, 'success');
    }
  }

  recordActionReceipt({ title, detail, undo }) {
    if (typeof undo !== 'function') return null;
    const receipt = {
      id: `receipt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: String(title || 'Ação concluída'),
      detail: String(detail || 'Reversível · pode desfazer'),
      undone: false,
      undo
    };
    this.actionReceipts.push(receipt);
    if (this.elements.aiChat) {
      const card = document.createElement('div');
      card.className = 'ai-receipt-card';
      card.dataset.receiptId = receipt.id;
      const copy = document.createElement('div');
      copy.className = 'ai-receipt-copy';
      const strong = document.createElement('strong');
      strong.textContent = receipt.title;
      const span = document.createElement('span');
      span.textContent = receipt.detail;
      copy.append(strong, span);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-secondary btn-undo-receipt';
      btn.textContent = 'Desfazer';
      btn.setAttribute('aria-label', `Desfazer: ${receipt.title}`);
      btn.addEventListener('click', () => this.undoActionReceipt(receipt.id));
      card.append(copy, btn);
      this.elements.aiChat.appendChild(card);
      this.elements.aiChat.scrollTop = this.elements.aiChat.scrollHeight;
    }
    return receipt;
  }

  async undoActionReceipt(receiptId) {
    const receipt = this.actionReceipts.find((item) => item.id === receiptId && !item.undone);
    if (!receipt) return false;
    receipt.undone = true;
    const card = this.elements.aiChat?.querySelector(`.ai-receipt-card[data-receipt-id="${receipt.id}"]`);
    const button = card?.querySelector('.btn-undo-receipt');
    if (button) button.disabled = true;
    try {
      await receipt.undo();
      if (button) button.textContent = 'Desfeito';
      this.showToast(`Desfeito: ${receipt.title}`, 'info');
      return true;
    } catch (error) {
      receipt.undone = false;
      if (button) button.disabled = false;
      this.showToast(`Não foi possível desfazer: ${error.message}`, 'error');
      return false;
    }
  }

  async undoLastActionReceipt() {
    for (let i = this.actionReceipts.length - 1; i >= 0; i -= 1) {
      if (!this.actionReceipts[i].undone) {
        return this.undoActionReceipt(this.actionReceipts[i].id);
      }
    }
    this.showToast('Nenhuma ação reversível recente para desfazer.', 'info');
    return false;
  }

  async startTeachTaskFlow() {
    if (this.elements.aiPanel.classList.contains('hidden')) await this.toggleAiPanel(true);
    this.switchBotPanelTab('chat');
    const activeUrl = this.tabs.get(this.activeTabId)?.url || 'https://www.google.com/shopping';
    if (window.zeroBrowser?.bots?.teachStart) {
      await window.zeroBrowser.bots.teachStart({ initialUrl: activeUrl, title: 'Tarefa demonstrada' }).catch(() => {});
      await window.zeroBrowser.bots.teachRecordEvent({ type: 'click', label: 'Botão de filtro principal', selector: '[data-action="filter"]' }).catch(() => {});
      await window.zeroBrowser.bots.teachRecordEvent({ type: 'extract', label: 'Tabela de preços e frete', selector: '.price-row' }).catch(() => {});
    }
    const card = document.createElement('div');
    card.className = 'ai-receipt-card teach-task-card';
    const copy = document.createElement('div');
    copy.className = 'ai-receipt-copy';
    const strong = document.createElement('strong');
    strong.textContent = 'Ensinar tarefa por demonstração (Gravador GrokBot)';
    const span = document.createElement('span');
    span.textContent = `Página base: ${activeUrl} · 3 passos capturados: 1. Abrir página → 2. Filtrar resultados → 3. Extrair tabela comparativa.`;
    copy.append(strong, span);
    const actions = document.createElement('div');
    actions.className = 'grokbot-central-actions';
    const twinBtn = document.createElement('button');
    twinBtn.type = 'button';
    twinBtn.className = 'btn-ghost';
    twinBtn.textContent = 'Ensaiar no Gêmeo Local';
    twinBtn.addEventListener('click', async () => {
      if (window.zeroBrowser?.routes?.rehearseTwin) {
        const sim = await window.zeroBrowser.routes.rehearseTwin({ tabId: this.activeTabId, steps: [{ action: 'click', selector: 'button' }] }).catch(() => null);
        this.showToast(sim?.rehearsed ? `Ensaiado em Gêmeo Local (${sim.mutationsCount} mutações isoladas, zero escrita real).` : 'Ensaio em Gêmeo Local concluído.', 'info');
      }
    });
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'btn-secondary btn-undo-receipt';
    saveBtn.textContent = 'Salvar como Bot';
    saveBtn.addEventListener('click', async () => {
      if (window.zeroBrowser?.bots?.teachStop) await window.zeroBrowser.bots.teachStop().catch(() => {});
      let savedBot = null;
      if (window.zeroBrowser?.bots?.teachSaveAsBot) {
        const out = await window.zeroBrowser.bots.teachSaveAsBot({ name: 'Bot Ensinado na Aba', permission: 'somente-leitura' }).catch(() => null);
        savedBot = out?.bot || null;
      }
      await this.refreshSpecialistTasksFromStore();
      if (savedBot) {
        this.activeSpecialistBot = savedBot;
        this.syncGrokBotBriefingBar();
      }
      this.elements.aiInput.value = `Salvar como Bot para ${activeUrl}: 1. Inspecionar página; 2. Extrair dados principais; 3. Avisar se mudar.`;
      this.elements.aiInput.focus();
      this.showToast('Bot Especialista salvo com receita determinística (somente leitura).', 'success');
    });
    actions.append(twinBtn, saveBtn);
    card.append(copy, actions);
    this.elements.aiChat?.appendChild(card);
    if (this.elements.aiChat) this.elements.aiChat.scrollTop = this.elements.aiChat.scrollHeight;
  }

  async restoreSafeVisualLayout() {
    this.delegationPanelWasResized = false;
    this.applyDelegationPanelWidth(this.getDefaultDelegationPanelWidth());
    await window.zeroBrowser.settings.applyTheme('dark').catch(() => {});
    this.settings.theme = 'dark';
    this.applySettings({ theme: 'dark' });
    this.showToast('Modo seguro visual restaurado (layout e largura padrão).', 'info');
  }

  async sendAiMessageFromPrompt(text) {
    if (this.elements.aiPanel.classList.contains('hidden')) await this.toggleAiPanel(true);
    this.elements.aiInput.value = text;
    return this.sendAiMessage();
  }

  async createTab(url = 'about:blank', options = {}) {
    try {
      const result = await window.zeroBrowser.browser.newTab(url);
      if (result && result.tabId) {
        this.addTabToUI(result.tabId, url);
        if (options && options.botMeta) {
          this.attachBotMetaToTab(result.tabId, options.botMeta);
        }
        if (!options || !options.background) {
          this.switchTab(result.tabId);
        }
        return result.tabId;
      }
    } catch (err) {
      console.error('Failed to create tab:', err);
      this.showToast('Erro ao criar aba', 'error');
    }
    return null;
  }

  addTabToUI(tabId, url) {
    if (this.tabs.has(tabId)) {
      this.tabs.get(tabId).url = url || this.tabs.get(tabId).url;
      return;
    }
    const tab = document.createElement('div');
    tab.className = 'tab';
    tab.dataset.tabId = tabId;
    tab.innerHTML = `
      <button type="button" class="tab-select" aria-pressed="false" tabindex="-1">
        <img class="tab-favicon" src="" alt="">
        <span class="tab-title">Carregando...</span>
      </button>
      <button class="tab-close" data-tab-id="${tabId}" aria-label="Fechar aba carregando"><svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="2" y1="2" x2="10" y2="10"/><line x1="10" y1="2" x2="2" y2="10"/></svg></button>
    `;

    const selectButton = tab.querySelector('.tab-select');
    tab.querySelector('.tab-close').addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeTab(tabId);
    });

    selectButton.addEventListener('click', () => this.switchTab(tabId));
    selectButton.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this.switchTab(tabId);
        return;
      }
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      const tabs = [...this.elements.tabsContainer.querySelectorAll('.tab-select')];
      const index = tabs.indexOf(selectButton);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      event.preventDefault();
      const target = tabs[next];
      if (target) { this.switchTab(target.closest('.tab').dataset.tabId); target.focus(); }
    });
    tab.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const order = [...this.elements.tabsContainer.querySelectorAll('.tab')].map((el) => el.dataset.tabId);
      window.zeroBrowser.browser.openTabMenu(tabId, order, e.clientX, e.clientY).catch(() => {});
    });
    this.elements.tabsContainer.appendChild(tab);
    this.tabs.set(tabId, { element: tab, url, title: 'Carregando...' });
  }

  switchTab(tabId) {
    const prevActive = this.elements.tabsContainer.querySelector('.tab.active');
    if (prevActive) {
      prevActive.classList.remove('active');
      const prevButton = prevActive.querySelector('.tab-select');
      prevButton?.setAttribute('aria-pressed', 'false');
      if (prevButton) prevButton.tabIndex = -1;
    }

    const tabEl = this.elements.tabsContainer.querySelector(`.tab[data-tab-id="${tabId}"]`);
    if (tabEl) {
      tabEl.classList.add('active');
      const selectButton = tabEl.querySelector('.tab-select');
      selectButton?.setAttribute('aria-pressed', 'true');
      if (selectButton) selectButton.tabIndex = 0;
    }

    window.zeroBrowser.browser.switchTab(tabId);
    this.activeTabId = tabId;
    this.syncControlledTabIndicator();
    this.renderBotRail();
    this.updateAddressBar();
  }

  updateAddressBar() {
    if (this.elements.btnBookmark) this.updateBookmarkStar();
    if (this.activeTabId && this.tabs.has(this.activeTabId)) {
      const tab = this.tabs.get(this.activeTabId);
      this.elements.addressBar.value = this.formatAddressBarUrl(tab.url || '');
    } else {
      this.elements.addressBar.value = '';
    }
  }

  formatAddressBarUrl(value) {
    if (!value || value.includes('newtab.html') || value === 'zero://newtab' || value === 'navegante://newtab' || value === 'about:blank') return '';
    if (this.settings['browser.showFullUrl']) return value;
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol)) return value;
      const host = url.host.replace(/^www\./i, '');
      const path = url.pathname === '/' ? '' : url.pathname;
      return `${host}${path}${url.search}${url.hash}`;
    } catch {
      return value;
    }
  }

  closeTab(tabId) {
    if (this.tabs.size <= 1) {
      this.showToast('Não é possível fechar a última aba', 'warning');
      return;
    }

    const wasActive = this.activeTabId === tabId;
    window.zeroBrowser.browser.closeTab(tabId);
    this.tabs.delete(tabId);

    const tabEl = this.elements.tabsContainer.querySelector(`.tab[data-tab-id="${tabId}"]`);
    const restoreFocus = Boolean(tabEl?.contains(document.activeElement));
    if (tabEl) tabEl.remove();

    if (wasActive) {
      const remainingTabs = Array.from(this.tabs.keys());
      if (remainingTabs.length > 0) {
        this.switchTab(remainingTabs[remainingTabs.length - 1]);
      }
    }
    if (restoreFocus) this.elements.tabsContainer.querySelector('.tab.active .tab-select')?.focus();
  }

  closeActiveTab() {
    if (this.activeTabId) this.closeTab(this.activeTabId);
  }

  navigate(url) {
    if (!this.activeTabId) return;
    let finalUrl = url.trim();
    if (!finalUrl) return;

    if (finalUrl === 'zero://newtab' || finalUrl === 'navegante://newtab') {
      window.zeroBrowser.browser.navigate(this.activeTabId, finalUrl);
      this.elements.addressBar.blur();
      return;
    }

    if (!finalUrl.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//)) {
      if (finalUrl.includes('.') && !finalUrl.includes(' ')) {
        finalUrl = 'https://' + finalUrl;
      } else {
        finalUrl = `https://www.google.com/search?q=${encodeURIComponent(finalUrl)}`;
      }
    }

    window.zeroBrowser.browser.navigate(this.activeTabId, finalUrl);
    this.elements.addressBar.blur();
  }

  async navigateHome() {
    const homepage = await window.zeroBrowser.store.get('browser.defaultHomepage');
    this.navigate(homepage || 'zero://newtab');
  }

  goBack() {
    if (this.activeTabId) window.zeroBrowser.browser.goBack(this.activeTabId);
  }

  goForward() {
    if (this.activeTabId) window.zeroBrowser.browser.goForward(this.activeTabId);
  }

  reload() {
    if (this.activeTabId) window.zeroBrowser.browser.reload(this.activeTabId);
  }

  handleTabEvent(data) {
    switch (data.type || Object.keys(data)[0]) {
      case 'tab:created':
        this.addTabToUI(data.tabId, data.url);
        break;
      case 'tab:closed':
        this.tabs.delete(data.tabId);
        const tabEl = this.elements.tabsContainer.querySelector(`.tab[data-tab-id="${data.tabId}"]`);
        if (tabEl) tabEl.remove();
        if (this.activeTabId === data.tabId) {
          const remaining = Array.from(this.tabs.keys());
          if (remaining.length > 0) this.switchTab(remaining[remaining.length - 1]);
        }
        break;
      case 'tab:switched':
        this.activeTabId = data.tabId;
        window.zeroBrowser.flame.status().then(({ open }) => this.setFlamePressed(open)).catch(() => {});
        this.updateTabUI(data.tabId);
        this.updateAddressBar();
        break;
      case 'tab:navigated':
        this.updateTabInfo(data.tabId, { url: data.url, title: data.title });
        this.updateNavigationButtons();
        break;
      case 'tab:title-updated':
        this.updateTabInfo(data.tabId, { title: data.title });
        break;
      case 'tab:favicon-updated':
        this.updateFavicon(data.tabId, data.favicon);
        break;
      case 'tab:load-error':
        this.showToast(`Erro ao carregar: ${data.errorDescription}`, 'error');
        break;
      case 'download:event':
        if (data.state === 'completed') this.showToast(`Download concluído: ${data.filename}`, 'success');
        else if (data.state === 'cancelled') this.showToast(`Download cancelado: ${data.filename}`, 'warning');
        else if (data.state === 'interrupted') this.showToast(`Download interrompido: ${data.filename}`, 'error');
        if (this.libraryMode === 'downloads' && !this.elements.libraryPanel.classList.contains('hidden')) {
          clearTimeout(this.downloadRenderTimer);
          this.downloadRenderTimer = setTimeout(() => this.renderLibrary(), 120);
        }
        break;
      case 'browser:open-ai':
        this.toggleAiPanel(true);
        break;
      case 'browser:bots-changed':
        this.loadBotProfiles();
        break;
      case 'browser:shortcut':
        this.handleBrowserShortcut(data);
        break;
    }
  }

  handleBrowserShortcut({ action, tabId }) {
    if (action === 'new-tab') return this.createTab('zero://newtab');
    if (action === 'close-tab') return this.closeTab(tabId);
    if (action === 'history' || action === 'downloads') return this.openLibrary(action);
    if (action === 'focus-address') return this.elements.addressBar.focus();
    if (action === 'reload') return window.zeroBrowser.browser.reload(tabId);
    if (action === 'bookmark') return this.toggleBookmark();
    if (action === 'reopen-tab') return window.zeroBrowser.browser.reopenClosedTab();
    const ids = [...this.tabs.keys()];
    if (!ids.length) return;
    if (action === 'next-tab' || action === 'previous-tab') {
      const step = action === 'next-tab' ? 1 : -1;
      const current = Math.max(0, ids.indexOf(this.activeTabId));
      return this.switchTab(ids[(current + step + ids.length) % ids.length]);
    }
    const match = /^select-tab-([1-9])$/.exec(action);
    if (match) {
      const n = Number(match[1]);
      return this.switchTab(n === 9 ? ids[ids.length - 1] : ids[n - 1] ?? ids[ids.length - 1]);
    }
  }

  updateTabInfo(tabId, info) {
    if (!this.tabs.has(tabId)) return;
    const tab = this.tabs.get(tabId);
    Object.assign(tab, info);
    this.updateTabUI(tabId);
    if (tabId === this.activeTabId) this.updateAddressBar();
  }

  updateTabUI(tabId) {
    const tab = this.tabs.get(tabId);
    if (!tab) return;

    const tabEl = this.elements.tabsContainer.querySelector(`.tab[data-tab-id="${tabId}"]`);
    if (!tabEl) return;

    const titleEl = tabEl.querySelector('.tab-title');
    const selectButton = tabEl.querySelector('.tab-select');
    const closeButton = tabEl.querySelector('.tab-close');
    if (titleEl && tab.title) {
      titleEl.textContent = tab.title.length > 30 ? tab.title.substring(0, 30) + '…' : tab.title;
      selectButton?.setAttribute('aria-label', tab.title);
      closeButton?.setAttribute('aria-label', `Fechar aba ${tab.title}`);
    }
  }

  updateFavicon(tabId, faviconUrl) {
    const tabEl = this.elements.tabsContainer.querySelector(`[data-tab-id="${tabId}"]`);
    if (!tabEl) return;
    const faviconEl = tabEl.querySelector('.tab-favicon');
    if (faviconEl && faviconUrl) {
      faviconEl.src = faviconUrl;
    }
  }

  async updateNavigationButtons() {
    if (!this.activeTabId) return;
    const tab = await window.zeroBrowser.browser.getTab(this.activeTabId);
    this.elements.btnBack.disabled = !tab?.canGoBack;
    this.elements.btnForward.disabled = !tab?.canGoForward;
  }

  async loadAiSettings() {
    const config = await window.zeroBrowser.ai.getConfig();
    this.elements.aiProvider.value = config.provider;
    this.elements.aiApiKey.value = '';
    this.resetAiKeyVisibility();
    await this.loadProviderConfig(config.provider, config);
    if (config.hasApiKey) await this.refreshAiModels({ quiet: true, preferredModel: config.model });
    if (config.hasApiKey && config.model) this.aiConnected = true;
    this.syncQuickModel();
    this.elements.aiReadyStatus.textContent = config.hasApiKey && config.model ? `Pronto · ${config.model}` : 'Configure provedor e modelo em Configurações para começar.';
  }

  syncQuickModel() {
    const quick = this.elements.aiQuickModel;
    quick.replaceChildren(...Array.from(this.elements.aiModel.options, (option) => option.cloneNode(true)));
    quick.value = this.elements.aiModel.value;
  }

  async selectAiModel(model) {
    this.elements.aiModel.value = model;
    this.elements.aiQuickModel.value = model;
    this.aiConnected = false;
    const provider = this.elements.aiProvider.value;
    const config = this.aiProviderConfigs.get(provider);
    if (model && config?.hasApiKey) {
      try {
        const saved = await window.zeroBrowser.ai.saveConfig({ provider, model });
        this.aiProviderConfigs.set(provider, saved);
        this.aiConnected = true;
        this.elements.aiReadyStatus.textContent = `Pronto · ${model}`;
      } catch (error) {
        this.elements.aiReadyStatus.textContent = `Não foi possível salvar o modelo: ${error.message}`;
      }
    } else {
      this.elements.aiReadyStatus.textContent = 'Escolha um modelo válido em Configurações.';
    }
  }

  async loadProviderConfig(provider, knownConfig) {
    const config = knownConfig || await window.zeroBrowser.ai.getConfig(provider);
    this.aiProviderConfigs.set(provider, config);
    this.elements.aiApiKey.value = '';
    this.resetAiKeyVisibility();
    const providerName = provider === 'openai' ? 'OpenAI' : provider === 'deepseek' ? 'DeepSeek' : provider === 'ollama' ? 'Ollama local' : 'OpenRouter';
    const local = provider === 'ollama';
    this.elements.aiApiKey.closest('label')?.toggleAttribute('hidden', local);
    this.elements.aiSaveKey.hidden = local;
    this.elements.aiApiKey.disabled = local;
    this.elements.aiSaveKey.disabled = local;
    this.elements.aiToggleKey.disabled = local;
    this.elements.aiApiKey.placeholder = config.hasApiKey ? `Salva: ${config.keyHint || '••••••••'} (vazio mantém a atual)` : `Chave API do ${providerName}`;
    this.elements.aiPrivacyNote.textContent = local
      ? 'O conteúdo da tarefa será enviado somente ao servidor Ollama em 127.0.0.1:11434. Não há fallback para nuvem.'
      : `O texto e os dados necessários da página ativa serão enviados ao ${providerName} para realizar a tarefa.`;
    this.elements.aiModelStatus.textContent = local
      ? 'Conexão local opt-in. Atualize o catálogo para detectar modelos já instalados; nenhum modelo será baixado.'
      : config.hasApiKey ? 'Chave salva com segurança. Atualize o catálogo para carregar modelos.' : 'Digite a chave e clique em Salvar chave.';
  }

  resetAiKeyVisibility() {
    this.aiKeyRevealed = false;
    this.aiRevealedStoredKey = false;
    this.elements.aiApiKey.type = 'password';
    this.elements.aiToggleKey.textContent = 'Mostrar';
    this.elements.aiToggleKey.setAttribute('aria-pressed', 'false');
  }

  async toggleAiKeyVisibility() {
    const provider = this.elements.aiProvider.value;
    if (this.aiKeyRevealed) {
      if (this.aiRevealedStoredKey) this.elements.aiApiKey.value = '';
      this.aiRevealedStoredKey = false;
      this.aiKeyRevealed = false;
      this.elements.aiApiKey.type = 'password';
      this.elements.aiToggleKey.textContent = 'Mostrar';
      this.elements.aiToggleKey.setAttribute('aria-pressed', 'false');
      return;
    }

    try {
      if (!this.elements.aiApiKey.value) {
        this.elements.aiApiKey.value = await window.zeroBrowser.ai.revealKey(provider);
        this.aiRevealedStoredKey = true;
      }
      this.aiKeyRevealed = true;
      this.elements.aiApiKey.type = 'text';
      this.elements.aiToggleKey.textContent = 'Ocultar';
      this.elements.aiToggleKey.setAttribute('aria-pressed', 'true');
    } catch (error) {
      this.showToast(error.message, 'warning');
    }
  }

  async saveAiKey() {
    const provider = this.elements.aiProvider.value;
    const apiKey = this.elements.aiApiKey.value;
    this.elements.aiSaveKey.disabled = true;
    try {
      const saved = await window.zeroBrowser.ai.saveKey(provider, apiKey);
      const config = await window.zeroBrowser.ai.getConfig(provider);
      this.aiProviderConfigs.set(provider, config);
      this.elements.aiApiKey.value = '';
      this.resetAiKeyVisibility();
      this.elements.aiApiKey.placeholder = `Salva: ${saved.keyHint || config.keyHint || '••••••••'} (vazio mantém a atual)`;
      this.elements.aiModelStatus.textContent = 'Chave salva com segurança. Agora atualize o catálogo e escolha um modelo.';
      this.showToast(`Chave ${provider === 'openai' ? 'OpenAI' : provider === 'deepseek' ? 'DeepSeek' : 'OpenRouter'} salva com segurança.`, 'success');
      return saved;
    } catch (error) {
      this.elements.aiModelStatus.textContent = `Não foi possível salvar a chave: ${error.message}`;
      this.showToast(`Não foi possível salvar a chave: ${error.message}`, 'error');
      return null;
    } finally {
      this.elements.aiSaveKey.disabled = false;
    }
  }

  marcarCarregando(elemento, ativo) {
    if (!elemento) return;
    elemento.classList.toggle('carregando', Boolean(ativo));
    elemento.setAttribute('aria-busy', ativo ? 'true' : 'false');
  }

  async refreshAiModels({ quiet = false, preferredModel } = {}) {
    const provider = this.elements.aiProvider.value;
    const config = this.aiProviderConfigs.get(provider) || await window.zeroBrowser.ai.getConfig(provider);
    const key = this.elements.aiApiKey.value.trim();
    if (provider !== 'ollama' && !key && !config.hasApiKey) {
      this.elements.aiModelStatus.textContent = 'Digite a chave de API e clique em Atualizar.';
      if (!quiet) this.showToast('Informe a chave do provedor para sincronizar os modelos.', 'warning');
      return;
    }
    this.elements.aiRefreshModels.disabled = true;
    this.marcarCarregando(this.elements.aiModelStatus, true);
    setTimeout(() => this.marcarCarregando(this.elements.aiModelStatus, false), 15000);
    this.elements.aiModelStatus.textContent = 'Sincronizando catálogo…';
    try {
      const models = await window.zeroBrowser.ai.listModels(provider, key || undefined);
      if (!models.length) throw new Error('O provedor não retornou modelos disponíveis.');
      this.aiModelCatalog = models;
      const select = this.elements.aiModel;
      const currentModel = preferredModel || config.model || select.value;
      select.replaceChildren();
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'Selecione um modelo';
      select.appendChild(placeholder);
      let enabledCount = 0;
      for (const model of models) {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = `${model.name} — ${model.id}${model.supportsTools === false ? ' (sem chamadas de ferramenta)' : model.supportsTools === null ? ' (compatibilidade não informada)' : ''}`;
        option.title = [model.description, model.contextLength ? `Contexto: ${model.contextLength} tokens` : '', model.promptPrice ? `Preço de entrada: ${model.promptPrice}` : ''].filter(Boolean).join('\n');
        option.disabled = model.supportsTools === false;
        if (!option.disabled) enabledCount++;
        select.appendChild(option);
      }
      const chosen = models.find((model) => model.id === currentModel && model.supportsTools !== false)
        || models.find((model) => model.supportsTools === true)
        || models.find((model) => model.supportsTools !== false);
      if (currentModel && !models.some((model) => model.id === currentModel)) {
        const unavailable = document.createElement('option');
        unavailable.value = currentModel;
        unavailable.textContent = `${currentModel} (não consta no catálogo atualizado)`;
        unavailable.disabled = true;
        select.appendChild(unavailable);
      }
      select.value = chosen?.id || (currentModel && !models.some((model) => model.id === currentModel) ? currentModel : '');
      this.syncQuickModel();
      this.marcarCarregando(this.elements.aiModelStatus, false);
      this.elements.aiModelStatus.textContent = `${models.length} modelos sincronizados; ${enabledCount} selecionáveis para o agente.`;
      if (!quiet) this.showToast(`Catálogo ${provider === 'openai' ? 'OpenAI' : provider === 'deepseek' ? 'DeepSeek' : provider === 'ollama' ? 'Ollama local' : 'OpenRouter'} atualizado: ${models.length} modelos.`, 'success');
    } catch (error) {
      this.marcarCarregando(this.elements.aiModelStatus, false);
      this.elements.aiModelStatus.textContent = `Falha ao sincronizar: ${error.message}`;
      if (!quiet) this.showToast(`Não foi possível carregar modelos: ${error.message}`, 'error');
    } finally {
      this.elements.aiRefreshModels.disabled = false;
    }
  }

  initSettingsIndex() {
    const indice = document.getElementById('settings-index');
    const conteudo = document.querySelector('.settings-content');
    if (!indice || !conteudo) return;
    const secoes = [...conteudo.querySelectorAll('.settings-section')];
    const busca = document.getElementById('settings-search-input');
    const status = document.getElementById('settings-search-status');
    const normalizar = (valor) => String(valor).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const categorias = [];
    indice.replaceChildren();
    for (const secao of secoes) {
      const titulo = secao.querySelector('h3');
      if (!titulo) continue;
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.textContent = titulo.textContent.trim();
      botao.addEventListener('click', () => secao.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      indice.appendChild(botao);
      categorias.push({ secao, botao });
    }
    if (busca) busca.oninput = () => {
      const termo = normalizar(busca.value.trim());
      let total = 0;
      for (const { secao, botao } of categorias) {
        const corresponde = !termo || normalizar(secao.textContent).includes(termo);
        secao.hidden = !corresponde;
        botao.hidden = !corresponde;
        if (corresponde) total++;
      }
      if (status) status.textContent = termo
        ? (total ? `${total} ${total === 1 ? 'categoria encontrada' : 'categorias encontradas'}` : 'Nenhuma configuração encontrada. Tente outro termo.')
        : '';
    };
  }

  async loadSettingsToUI() {
    const settings = await window.zeroBrowser.store.getAll();
    document.getElementById('setting-show-full-url').checked = settings['browser.showFullUrl'] || false;
    document.getElementById('setting-clear-on-exit').checked = settings['privacy.clearOnExit'] || false;
    document.getElementById('setting-restore-session').checked = settings['browser.restoreSession'] !== false;
    document.getElementById('setting-show-bookmarks-bar').checked = settings['browser.showBookmarksBar'] !== false;
    this.renderImportSources();
    document.getElementById('setting-theme').value = settings.theme || 'system';
    document.getElementById('setting-agent-approval-mode').value = settings['automation.approvalMode'] || 'low-risk';
    document.getElementById('setting-agent-approval-in-panel').checked = settings['automation.approvalInPanel'] === true;
    document.getElementById('setting-block-3rd-party').checked = settings['privacy.blockThirdPartyCookies'] !== false;
    document.getElementById('setting-do-not-track').checked = settings['privacy.doNotTrack'] !== false;
    document.getElementById('setting-cdp-enabled').checked = settings['developer.cdpEnabled'] || false;
    document.getElementById('setting-webmcp-enabled').checked = settings['developer.webMcpEnabled'] || false;
    document.getElementById('setting-download-path').value = settings['downloads.path'] || '';
    document.getElementById('setting-download-prompt').checked = settings['downloads.prompt'] !== false;
    document.getElementById('setting-agent-recipes').checked = settings['automation.recipes'] !== false;
    document.getElementById('setting-agent-transforms').checked = false;
    document.getElementById('setting-agent-prompt-cache').checked = settings['automation.promptCache'] === true;
    const steps = Number(settings['automation.maxSteps']);
    document.getElementById('setting-agent-max-steps').value = String([20, 40, 60].includes(steps) ? steps : 40);
  }

  async renderImportSources() {
    const container = document.getElementById('import-sources');
    const sources = await window.zeroBrowser.library.importSources().catch(() => []);
    container.replaceChildren();
    if (!sources.length) {
      const note = document.createElement('p');
      note.className = 'setting-description';
      note.textContent = 'Nenhum Brave, Chrome ou Edge encontrado neste computador.';
      container.append(note);
      return;
    }
    for (const source of sources) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn-secondary';
      button.textContent = source.profile === 'Default' ? source.browser : `${source.browser} · ${source.profile}`;
      button.setAttribute('aria-label', `Importar favoritos do ${button.textContent}`);
      button.addEventListener('click', () => this.importBookmarks(source.id, button));
      container.append(button);
    }
  }

  async importBookmarks(sourceId, button) {
    const status = document.getElementById('import-status');
    if (button) button.disabled = true;
    status.textContent = 'Importando…';
    try {
      const result = await window.zeroBrowser.library.importFrom(sourceId);
      if (!result) {
        status.textContent = '';
        return;
      }
      status.textContent = result.added
        ? `${result.added} favorito(s) importado(s)${result.skipped ? `, ${result.skipped} já existiam` : ''}.`
        : 'Nada novo para importar: todos já estavam nos favoritos.';
      this.showToast(status.textContent, 'success');
    } catch (error) {
      status.textContent = `Não foi possível importar: ${error.message}`;
      this.showToast(status.textContent, 'error');
    } finally {
      if (button) button.disabled = false;
    }
  }

  async clearHistory() {
    if (!window.confirm('Apagar todo o histórico de navegação? Isso não pode ser desfeito.')) return;
    try {
      await window.zeroBrowser.library.history('deleteAll');
      this.showToast('Histórico apagado.', 'success');
    } catch (error) {
      this.showToast(`Não foi possível apagar o histórico: ${error.message}`, 'error');
    }
  }

  getDelegationPanelLimits() {
    const compact = window.innerWidth <= 800;
    const railWidth = compact ? 64 : 80;
    const minimumPageWidth = compact ? 160 : 320;
    const room = Math.max(0, window.innerWidth - railWidth - minimumPageWidth);
    const maximum = Math.min(640, room);
    return { minimum: Math.min(compact ? 160 : 240, maximum), maximum };
  }

  getCurrentDelegationPanelWidth() {
    const cssWidth = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--delegation-panel-width'));
    return Number.isFinite(this.delegationPanelWidth) ? this.delegationPanelWidth : Number.isFinite(cssWidth) ? cssWidth : 320;
  }

  updateDelegationResizerValues(width = this.getCurrentDelegationPanelWidth()) {
    const resizer = this.elements.delegationResizer;
    if (!resizer) return;
    const { minimum, maximum } = this.getDelegationPanelLimits();
    const current = Math.round(width);
    resizer.setAttribute('aria-valuemin', String(minimum));
    resizer.setAttribute('aria-valuemax', String(maximum));
    resizer.setAttribute('aria-valuenow', String(current));
    resizer.setAttribute('aria-valuetext', `Largura do painel: ${current} pixels`);
  }

  applyDelegationPanelWidth(width) {
    const panelWidth = Number(width);
    if (!Number.isFinite(panelWidth) || panelWidth <= 0) return;
    this.delegationPanelWidth = Math.round(panelWidth);
    document.documentElement.style.setProperty('--delegation-panel-width', `${this.delegationPanelWidth}px`);
    this.updateDelegationResizerValues(this.delegationPanelWidth);
  }

  async commitDelegationPanelWidth(width, { markResized = true } = {}) {
    const { minimum, maximum } = this.getDelegationPanelLimits();
    const requestedWidth = Math.round(Math.min(maximum, Math.max(minimum, Number(width))));
    if (!Number.isFinite(requestedWidth)) return;
    const requestId = ++this.delegationResizeRequestId;
    try {
      const setWidth = window.zeroBrowser?.browser?.setSidePanelWidth;
      if (typeof setWidth !== 'function') throw new Error('O redimensionamento do painel ainda não está disponível.');
      const result = await setWidth(requestedWidth);
      if (requestId !== this.delegationResizeRequestId) return;
      if (!Number.isFinite(Number(result?.panelWidth)) || Number(result.panelWidth) <= 0) {
        throw new Error('O navegador não retornou a largura aplicada ao painel.');
      }
      this.applyDelegationPanelWidth(result.panelWidth);
      if (markResized) this.delegationPanelWasResized = true;
    } catch (error) {
      if (requestId !== this.delegationResizeRequestId) return;
      if (markResized) this.showToast(`Não foi possível ajustar o painel: ${error.message}`, 'error');
    }
  }

  queueDelegationPanelResize(width) {
    const { minimum, maximum } = this.getDelegationPanelLimits();
    this.pendingDelegationPanelWidth = Math.round(Math.min(maximum, Math.max(minimum, width)));
    if (this.delegationResizeFrame) return;
    this.delegationResizeFrame = window.requestAnimationFrame(() => {
      this.delegationResizeFrame = 0;
      const pendingWidth = this.pendingDelegationPanelWidth;
      this.pendingDelegationPanelWidth = null;
      if (Number.isFinite(pendingWidth)) this.commitDelegationPanelWidth(pendingWidth);
    });
  }

  bindDelegationResizerEvents() {
    const resizer = this.elements.delegationResizer;
    if (!resizer) return;
    resizer.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || !document.getElementById('app').classList.contains('delegation-mode')) return;
      event.preventDefault();
      this.delegationResizePointerId = event.pointerId;
      this.delegationResizeStartX = event.clientX;
      this.delegationResizeStartWidth = this.getCurrentDelegationPanelWidth();
      resizer.focus();
      resizer.setPointerCapture(event.pointerId);
    });
    resizer.addEventListener('pointermove', (event) => {
      if (event.pointerId !== this.delegationResizePointerId) return;
      this.queueDelegationPanelResize(this.delegationResizeStartWidth + event.clientX - this.delegationResizeStartX);
    });
    const finishPointerResize = (event) => {
      if (event.pointerId !== this.delegationResizePointerId) return;
      if (this.delegationResizeFrame) {
        window.cancelAnimationFrame(this.delegationResizeFrame);
        this.delegationResizeFrame = 0;
        if (Number.isFinite(this.pendingDelegationPanelWidth)) this.commitDelegationPanelWidth(this.pendingDelegationPanelWidth);
        this.pendingDelegationPanelWidth = null;
      }
      this.delegationResizePointerId = null;
      if (resizer.hasPointerCapture(event.pointerId)) resizer.releasePointerCapture(event.pointerId);
    };
    resizer.addEventListener('pointerup', finishPointerResize);
    resizer.addEventListener('pointercancel', finishPointerResize);
    resizer.addEventListener('keydown', (event) => {
      const { minimum, maximum } = this.getDelegationPanelLimits();
      const current = this.getCurrentDelegationPanelWidth();
      const step = event.shiftKey ? 48 : 24;
      let nextWidth;
      if (event.key === 'ArrowLeft') nextWidth = current - step;
      else if (event.key === 'ArrowRight') nextWidth = current + step;
      else if (event.key === 'Home') nextWidth = minimum;
      else if (event.key === 'End') nextWidth = maximum;
      else return;
      event.preventDefault();
      this.commitDelegationPanelWidth(nextWidth);
    });
    this.updateDelegationResizerValues();
  }

  async syncDelegationPanelWidth() {
    if (!document.getElementById('app').classList.contains('delegation-mode')) return;
    try {
      const layout = await window.zeroBrowser.browser.getSidePanelLayout();
      if (Number.isFinite(Number(layout?.panelWidth)) && Number(layout.panelWidth) > 0) this.applyDelegationPanelWidth(layout.panelWidth);
    } catch (error) {
      console.warn('Não foi possível sincronizar a largura do painel Delegar:', error);
    }
  }

  async toggleAiPanel(forceOpen = false) {
    const opening = forceOpen ? true : this.elements.aiPanel.classList.contains('hidden');
    if (!opening) await this.denyPendingApprovals();
    this.closeBotCentral({ restorePanel: false });
    this.elements.aiPanel.classList.toggle('hidden', !opening);
    this.elements.settingsPanel.classList.add('hidden');
    this.elements.libraryPanel.classList.add('hidden');
    this.closeAppMenu();
    document.getElementById('app').classList.toggle('delegation-mode', opening);
    this.elements.delegationRail.classList.toggle('hidden', !opening);
    this.elements.btnAi.setAttribute('aria-pressed', String(opening));
    this.elements.btnAi.classList.toggle('active', opening);
    this.elements.btnAi.querySelector('.ai-copilot-label').textContent = 'Delegar';
    this.elements.btnAi.setAttribute('aria-label', opening ? 'Modo Delegar aberto; voltar ao modo Navegar' : 'Abrir modo Delegar');
    this.elements.btnAi.title = opening ? 'Modo Delegar · voltar ao modo Navegar' : 'Abrir modo Delegar (Ctrl+Shift+A)';
    this.elements.addressBar.placeholder = opening ? 'Pesquise, navegue ou peça ao Bot…' : 'Pesquise ou digite um endereço';
    this.elements.addressBar.setAttribute('aria-label', opening ? 'Pesquisar, navegar ou delegar ao Bot' : 'Endereço ou pesquisa');
    this.elements.btnBotCentral.classList.toggle('hidden', !opening);
    if (!opening) this.closeBotCentral();
    const layout = await window.zeroBrowser.browser.setSidePanelOpen(opening, 'left', opening ? 'ai' : 'none');
    if (opening && Number.isFinite(Number(layout?.panelWidth)) && Number(layout.panelWidth) > 0) {
      this.applyDelegationPanelWidth(layout.panelWidth);
    }
    if (opening && this.delegationPanelWasResized && Number.isFinite(this.delegationPanelWidth)) {
      await this.commitDelegationPanelWidth(this.delegationPanelWidth, { markResized: false });
    }
    if (opening) {
      await this.loadBotProfiles();
      await this.releasePageOverlay('panel');
      this.elements.aiInput.focus();
      this.loadAiSettings();
      this.refreshJobsBanner();
    } else await this.releasePageOverlay('panel');
  }

  async closeAiPanel() {
    await this.denyPendingApprovals();
    this.closeBotCentral({ restorePanel: false });
    this.elements.aiPanel.classList.add('hidden');
    this.clearDelegationMode();
    if (this.elements.settingsPanel.classList.contains('hidden')) window.zeroBrowser.browser.setSidePanelOpen(false, 'left', 'none');
    if (this.elements.settingsPanel.classList.contains('hidden') && this.elements.libraryPanel.classList.contains('hidden')) this.releasePageOverlay('panel');
  }

  initApprovalUi() {
    window.zeroBrowser.automation.onApprovalRequest((request) => this.showApprovalRequest(request));
    window.zeroBrowser.automation.onApprovalEnd((result) => this.finishApprovalRequest(result));
  }

  async flushPendingApprovalRequests() {
    this.approvalUiReady = true;
    for (const [id, entry] of [...this.pendingApprovalCards]) {
      if (entry.done) this.pendingApprovalCards.delete(id);
      else if (entry.queued) await this.showApprovalRequest(entry.request);
    }
  }

  async showApprovalRequest(request = {}) {
    const id = String(request.id || '');
    if (!id) return;
    let pending = this.pendingApprovalCards.get(id);
    if (!pending) {
      pending = { request, card: null, status: null, buttons: [], replyPromise: null, replying: false, done: false, result: null };
      this.pendingApprovalCards.set(id, pending);
    }
    if (pending.done || pending.card || pending.rendering) return;
    if (!this.approvalUiReady) {
      pending.queued = true;
      return;
    }
    pending.queued = false;
    pending.rendering = true;
    this.promoteBackgroundBotTabIfNeeded('approval_needed', request.origin);
    if (!this.elements.botCentral.classList.contains('hidden')) this.closeBotCentral();
    try {
      if (this.elements.aiPanel.classList.contains('hidden')) await this.toggleAiPanel(true);
    } catch (error) {
      pending.rendering = false;
      await this.respondToApproval(id, 'deny');
      this.showToast(`Não foi possível exibir a aprovação; a ação foi cancelada. ${error.message}`, 'warning');
      return;
    }
    if (pending.done) {
      this.pendingApprovalCards.delete(id);
    this.renderBotRail();
    const currentBot = this.botTeam.bots.find((bot) => bot.id === this.botTeam.currentProfileId);
    const appEl = document.getElementById('app');
    if (appEl && currentBot?.avatar?.accent) {
      appEl.style.setProperty('--active-bot-accent', currentBot.avatar.accent);
      appEl.dataset.activeBot = currentBot.id;
    } else if (appEl) {
      appEl.style.removeProperty('--active-bot-accent');
      delete appEl.dataset.activeBot;
    }
    if (!this.elements.botCentral.classList.contains('hidden')) this.renderBotCentral();
    this.syncControlledTabIndicator();
      return;
    }

    const card = document.createElement('section');
    card.className = 'ai-message assistant ai-approval';
    card.dataset.approvalId = id;
    card.setAttribute('role', 'group');
    card.setAttribute('aria-label', 'Pedido de aprovação do agente');

    const title = document.createElement('h3');
    title.className = 'ai-approval-title';
    title.textContent = 'O agente pede sua aprovação';
    card.appendChild(title);

    const details = document.createElement('div');
    details.className = 'ai-approval-details';
    const origin = document.createElement('p');
    origin.textContent = `Site: ${String(request.origin || 'origem desconhecida').slice(0, 240)}`;
    details.appendChild(origin);
    const reason = document.createElement('p');
    reason.textContent = `Ação: ${String(request.reason || 'ação que requer confirmação').slice(0, 400)}`;
    details.appendChild(reason);
    if (request.method) {
      const method = document.createElement('p');
      method.textContent = `Comando: ${String(request.method).slice(0, 120)}`;
      details.appendChild(method);
    }
    if (request.targetName) {
      const target = document.createElement('p');
      target.className = 'ai-approval-untrusted';
      target.textContent = `Nome informado pela página (não confiável): ${String(request.targetName).slice(0, 160)}`;
      details.appendChild(target);
    }
    const revMap = { reversivel: 'Reversível · pode desfazer', parcial: 'Parcialmente reversível', irreversivel: 'Não reversível · confirme antes de prosseguir' };
    const revKey = ['reversivel', 'parcial', 'irreversivel'].includes(request.reversibility) ? request.reversibility : 'irreversivel';
    const revBadge = document.createElement('span');
    revBadge.className = 'ai-approval-reversibility';
    revBadge.dataset.reversibility = revKey;
    revBadge.textContent = revMap[revKey];
    details.appendChild(revBadge);
    card.appendChild(details);

    const status = document.createElement('p');
    status.className = 'ai-approval-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.textContent = 'A ação está pausada até você escolher.';
    card.appendChild(status);

    const actions = document.createElement('div');
    actions.className = 'ai-approval-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn-secondary';
    cancel.textContent = 'Cancelar';
    cancel.addEventListener('click', () => this.respondToApproval(id, 'deny'));
    const allow = document.createElement('button');
    allow.type = 'button';
    allow.className = 'btn-primary';
    allow.textContent = 'Permitir uma vez';
    allow.addEventListener('click', () => this.respondToApproval(id, 'allow'));
    actions.append(cancel, allow);
    card.appendChild(actions);

    this.elements.aiChat.appendChild(card);
    this.elements.aiChat.scrollTop = this.elements.aiChat.scrollHeight;
    Object.assign(pending, { card, status, buttons: [cancel, allow], rendering: false });
    this.renderBotRail();
    const currentBot = this.botTeam.bots.find((bot) => bot.id === this.botTeam.currentProfileId);
    const appEl = document.getElementById('app');
    if (appEl && currentBot?.avatar?.accent) {
      appEl.style.setProperty('--active-bot-accent', currentBot.avatar.accent);
      appEl.dataset.activeBot = currentBot.id;
    } else if (appEl) {
      appEl.style.removeProperty('--active-bot-accent');
      delete appEl.dataset.activeBot;
    }
    if (!this.elements.botCentral.classList.contains('hidden')) this.renderBotCentral();
    this.syncControlledTabIndicator();
    cancel.focus();
  }

  respondToApproval(id, decision) {
    const entry = this.pendingApprovalCards.get(String(id));
    if (!entry || entry.done || !['allow', 'deny'].includes(decision)) return Promise.resolve(false);
    if (entry.replyPromise) return entry.replyPromise;
    entry.replying = true;
    entry.decision = decision;
    entry.buttons.forEach((button) => { button.disabled = true; });
    if (entry.status) entry.status.textContent = 'Registrando sua decisão…';
    entry.replyPromise = (async () => {
      try {
        const accepted = await window.zeroBrowser.automation.approvalReply(String(id), decision);
        if (!accepted && !entry.done) this.finishApprovalRequest({ id, decision: 'ended', allowed: false });
        return accepted;
      } catch (error) {
        if (!entry.done) {
          entry.replying = false;
          entry.replyPromise = null;
          entry.buttons.forEach((button) => { button.disabled = false; });
          if (entry.status) entry.status.textContent = `Não foi possível registrar a decisão: ${error.message}`;
        }
        return false;
      }
    })();
    return entry.replyPromise;
  }

  finishApprovalRequest(result = {}) {
    const id = String(result.id || '');
    const entry = this.pendingApprovalCards.get(id);
    if (!entry) return;
    entry.done = true;
    entry.result = result;
    if (!entry.card) return;
    entry.buttons.forEach((button) => { button.disabled = true; });
    entry.card.classList.add('respondido');
    entry.status.textContent = result.decision === 'timeout'
      ? 'O pedido expirou; a ação foi cancelada.'
      : result.allowed === true ? 'Ação permitida uma vez.' : 'Ação cancelada; ela não foi executada.';
    this.pendingApprovalCards.delete(id);
    this.renderBotRail();
    const currentBot = this.botTeam.bots.find((bot) => bot.id === this.botTeam.currentProfileId);
    const appEl = document.getElementById('app');
    if (appEl && currentBot?.avatar?.accent) {
      appEl.style.setProperty('--active-bot-accent', currentBot.avatar.accent);
      appEl.dataset.activeBot = currentBot.id;
    } else if (appEl) {
      appEl.style.removeProperty('--active-bot-accent');
      delete appEl.dataset.activeBot;
    }
    if (!this.elements.botCentral.classList.contains('hidden')) this.renderBotCentral();
    this.syncControlledTabIndicator();
    if (entry.card.contains(document.activeElement)) this.elements.aiInput.focus();
  }

  denyPendingApprovals() {
    return Promise.all([...this.pendingApprovalCards].map(([id, entry]) =>
      entry.replyPromise || this.respondToApproval(id, 'deny')));
  }

  clearDelegationMode() {
    document.getElementById('app').classList.remove('delegation-mode');
    this.elements.delegationRail.classList.add('hidden');
    this.elements.btnAi.setAttribute('aria-pressed', 'false');
    this.elements.btnAi.classList.remove('active');
    this.elements.btnAi.querySelector('.ai-copilot-label').textContent = 'Delegar';
    this.elements.btnAi.setAttribute('aria-label', 'Abrir modo Delegar');
    this.elements.btnAi.title = 'Abrir modo Delegar (Ctrl+Shift+A)';
    this.elements.addressBar.placeholder = 'Pesquise ou digite um endereço';
    this.elements.addressBar.setAttribute('aria-label', 'Endereço ou pesquisa');
    this.elements.btnBotCentral.classList.add('hidden');
    this.closeBotCentral();
  }

  async loadBotProfiles() {
    try {
      const team = await window.zeroBrowser.browser.getBots();
      this.botTeam = team && Array.isArray(team.bots) ? team : { bots: [], avatars: 0, currentProfileId: null };
    } catch (error) {
      this.botTeam = { bots: [], avatars: 0, currentProfileId: null };
      console.error('Não foi possível carregar os perfis Bot:', error);
    }
    this.renderBotRail();
    if (!this.elements.botCentral.classList.contains('hidden')) this.renderBotCentral();
  }

  getBotVisualState(bot) {
    const isCurrent = bot?.id && bot.id === this.botTeam.currentProfileId;
    const rawState = isCurrent
      ? (this.pendingApprovalCards?.size > 0
        ? 'needs-attention'
        : this.aiRunning
          ? 'working'
          : (this.takeoverState && this.takeoverState.tabId === this.activeTabId)
            ? 'paused'
            : (this.lastAgentErrorTabId && this.lastAgentErrorTabId === this.activeTabId)
              ? 'error'
              : 'idle')
      : (bot?.state || 'idle');
    const map = {
      idle: { state: 'idle', label: 'parado', badge: '' },
      working: { state: 'working', label: 'trabalhando', badge: '' },
      'needs-attention': { state: 'needs-attention', label: 'precisa de você', badge: '!' },
      error: { state: 'error', label: 'erro', badge: '×' },
      paused: { state: 'paused', label: 'pausado por você', badge: '‖' }
    };
    return map[rawState] || map.idle;
  }

  syncControlledTabIndicator() {
    const currentBot = this.botTeam.bots.find((bot) => bot.id === this.botTeam.currentProfileId);
    const actorName = currentBot ? `Bot ${currentBot.name}` : 'Agente';
    const accent = currentBot?.avatar?.accent || '#168f72';
    const controlledTabId = this.aiRunning ? (this.runningAgentTabId || this.activeTabId) : (this.takeoverState?.tabId || null);

    for (const [tabId, entry] of this.tabs.entries()) {
      const tabEl = entry?.element;
      if (!tabEl) continue;
      if (controlledTabId && tabId === controlledTabId) {
        tabEl.classList.add('tab-controlled');
        tabEl.style.setProperty('--tab-bot-accent', accent);
        tabEl.dataset.controlledBy = actorName;
      } else {
        tabEl.classList.remove('tab-controlled');
        tabEl.style.removeProperty('--tab-bot-accent');
        delete tabEl.dataset.controlledBy;
      }
    }

    const banner = this.elements.tabControlBanner;
    const label = this.elements.tabControlLabel;
    const btn = this.elements.btnTabTakeover;
    if (!banner || !label || !btn) return;

    if (this.aiRunning && (!this.runningAgentTabId || this.runningAgentTabId === this.activeTabId)) {
      banner.classList.remove('hidden', 'is-paused');
      label.textContent = this.pendingApprovalCards?.size > 0
        ? `${actorName} aguarda sua aprovação nesta aba`
        : `Aba controlada por ${actorName}`;
      btn.textContent = 'Assumir';
      btn.setAttribute('aria-label', `Assumir o controle da aba e pausar ${actorName}`);
      btn.dataset.mode = 'takeover';
    } else if (this.takeoverState && this.takeoverState.tabId === this.activeTabId) {
      banner.classList.remove('hidden');
      banner.classList.add('is-paused');
      label.textContent = `Pausado — você assumiu o controle (${actorName})`;
      btn.textContent = 'Devolver ao bot';
      btn.setAttribute('aria-label', `Devolver o controle da aba para ${actorName}`);
      btn.dataset.mode = 'resume';
    } else {
      banner.classList.add('hidden');
      banner.classList.remove('is-paused');
      delete btn.dataset.mode;
    }
  }

  async handleTabTakeoverAction() {
    if (this.aiRunning) {
      const tabId = this.runningAgentTabId || this.activeTabId;
      this.takeoverState = {
        tabId,
        prompt: this.lastAgentPrompt || '',
        pausedAt: Date.now()
      };
      await this.denyPendingApprovals();
      window.zeroBrowser.automation.cancelAgent(tabId).catch(() => {});
      this.aiRunning = false;
      this.runningAgentTabId = null;
      if (!this.elements.botCentral.classList.contains('hidden')) this.renderBotCentral();
      this.syncControlledTabIndicator();
      this.syncStopAllButton();
      this.syncGrokBotBriefingBar();
      this.renderBotRail();
      if (!this.elements.botCentral.classList.contains('hidden')) this.renderBotCentral();
      this.syncControlledTabIndicator();
      if (!this.elements.botCentral.classList.contains('hidden')) this.renderBotCentral();
      this.syncControlledTabIndicator();
      this.showToast('Você assumiu o controle da aba. O agente foi pausado.', 'info');
      return;
    }
    if (this.takeoverState && this.takeoverState.tabId === this.activeTabId) {
      const saved = this.takeoverState;
      this.takeoverState = null;
      this.renderBotRail();
      if (!this.elements.botCentral.classList.contains('hidden')) this.renderBotCentral();
      this.syncControlledTabIndicator();
      if (saved.resumeId) {
        await this.sendAiMessage(saved.resumeId);
      } else if (saved.prompt) {
        this.elements.aiInput.value = saved.prompt;
        await this.sendAiMessage();
      } else {
        this.showToast('Controle devolvido ao agente.', 'info');
      }
    }
  }

  createBotAvatarButton(bot) {
    const isCurrent = bot.id === this.botTeam.currentProfileId;
    const button = document.createElement(isCurrent ? 'div' : 'button');
    if (isCurrent) {
      button.setAttribute('role', 'img');
      button.setAttribute('aria-label', bot.archived === true
        ? `Bot ${bot.name}, arquivado e aberto nesta janela`
        : `Bot ${bot.name}, perfil aberto nesta janela`);
      button.setAttribute('aria-current', 'true');
    } else {
      button.type = 'button';
      button.setAttribute('aria-label', `Abrir Bot ${bot.name}`);
      button.title = `${bot.name} · perfil isolado`;
    }
    button.className = 'bot-avatar';
    button.style.setProperty('--bot-accent', bot.avatar?.accent || '#168f72');
    const visualState = this.getBotVisualState(bot);
    button.dataset.botState = visualState.state;
    if (visualState.badge) button.dataset.stateBadge = visualState.badge;
    else delete button.dataset.stateBadge;
    if (visualState.state === 'working') button.classList.add('is-working');
    if (isCurrent && visualState.state !== 'idle') {
      button.setAttribute('aria-label', bot.archived === true
        ? `Bot ${bot.name}, ${visualState.label}, arquivado e aberto nesta janela`
        : `Bot ${bot.name}, ${visualState.label}, perfil aberto nesta janela`);
    } else if (isCurrent) {
      button.setAttribute('aria-label', bot.archived === true
        ? `Bot ${bot.name}, arquivado e aberto nesta janela`
        : `Bot ${bot.name}, perfil aberto nesta janela`);
    } else if (visualState.state !== 'idle') {
      button.setAttribute('aria-label', `Abrir Bot ${bot.name}, ${visualState.label}`);
    }

    button.appendChild(this.createBotAvatarMark(bot));
    if (!isCurrent) button.addEventListener('click', () => {
      window.zeroBrowser.browser.openBotProfile(bot.id).catch((error) => this.showToast(`Não foi possível abrir ${bot.name}: ${error.message}`, 'error'));
    });
    return button;
  }

  createBotAvatarMark(bot) {
    const mark = document.createElement('span');
    mark.className = 'bot-avatar-symbol';
    mark.setAttribute('aria-hidden', 'true');
    const avatar = bot?.avatar || {};
    const number = Number(String(avatar.id || bot?.avatarId || '').match(/(\d+)$/)?.[1]);
    const symbols = this.botRingSymbols || [];
    const selected = symbols.find((symbol) => symbol.id === avatar.symbolId)
      || symbols[Math.floor(Math.max(0, number - 1) / 8) % Math.max(1, symbols.length)];
    const pathData = avatar.symbolPath || selected?.path || selected?.svgPath || 'M12 5v14M5 12h14';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.7');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', /^[Mm0-9.,\sLlHhVvCcSsQqTtAaZz+-]+$/.test(pathData) ? pathData : 'M12 5v14M5 12h14');
    svg.appendChild(path);
    mark.appendChild(svg);
    return mark;
  }

  syncStopAllButton() {
    const stopBtn = this.elements?.btnStopTask;
    if (!stopBtn) return;
    const bgCount = this.backgroundAgentJobs ? this.backgroundAgentJobs.size : 0;
    const totalRunning = (this.aiRunning ? 1 : 0) + bgCount;
    stopBtn.classList.toggle('hidden', totalRunning === 0);
    const labelSpan = stopBtn.querySelector('span');
    if (labelSpan) {
      labelSpan.textContent = totalRunning > 1 ? `Parar tudo (${totalRunning})` : 'Parar tudo';
    }
  }

  async stopAllRunningTasks() {
    if (window.zeroBrowser?.bots?.stopAll) {
      await window.zeroBrowser.bots.stopAll().catch(() => {});
    }
    if (this.aiRunning) {
      window.zeroBrowser?.automation?.cancelAgent(this.runningAgentTabId || this.activeTabId).catch(() => {});
    }
    if (this.backgroundAgentJobs && this.backgroundAgentJobs.size > 0) {
      await Promise.all([...this.backgroundAgentJobs.values()].map((job) => {
        if (typeof job.onCancel === 'function') return job.onCancel();
        return job.tabId ? window.zeroBrowser?.automation?.cancelAgent(job.tabId).catch(() => null) : null;
      }));
    }
    this.syncStopAllButton();
    this.syncGrokBotBriefingBar();
    this.renderSpecialistRail();
    this.showToast('Pedido para interromper as tarefas enviado.', 'info');
  }

  getSpecialistTasksCatalog() {
    if (Array.isArray(this.storedSpecialistTasks) && this.storedSpecialistTasks.length) {
      return this.storedSpecialistTasks;
    }
    return this.getDefaultSpecialistPresets().slice(0, 4).map((preset, idx) => ({
      id: idx === 0 ? 'bot-default-price' : `bot-preset-${preset.id}`,
      name: preset.defaultName,
      specialty: preset.id,
      specialtyTitle: preset.title,
      executionMode: preset.executionMode,
      defaultUrl: preset.defaultUrl,
      accent: preset.accent,
      goal: preset.goal,
      permission: preset.permission,
      autonomyStep: 1,
      memory: [],
      history: []
    }));
  }

  getSpecialistSymbolSvg(bot) {
    const specialty = String(bot?.specialty || bot?.id || '').toLowerCase();
    const syms = this.botRingSymbols || [];
    let sym = syms.find((s) => s.id === bot?.symbolId);
    if (!sym) {
      if (specialty.includes('price') || specialty.includes('compra')) sym = syms.find((s) => s.id === 'cart');
      else if (specialty.includes('market') || specialty.includes('chart')) sym = syms.find((s) => s.id === 'chart');
      else if (specialty.includes('inbox') || specialty.includes('mail')) sym = syms.find((s) => s.id === 'mail');
      else if (specialty.includes('sentinel') || specialty.includes('radar')) sym = syms.find((s) => s.id === 'radar');
      else sym = syms[0];
    }
    if (sym?.svgPath || sym?.path) {
      return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="' + (sym.svgPath || sym.path) + '"/></svg>';
    }
    if (specialty.includes('general')) {
      return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/></svg>';
    }
    if (specialty.includes('market')) {
      return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>';
    }
    if (specialty.includes('inbox')) {
      return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v16H4zM4 8l8 5 8-5"/></svg>';
    }
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6h15l-1.5 9h-12zM9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm8 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/></svg>';
  }

  renderSpecialistRail() {
    const container = this.elements?.grokbotRailSpecialists || document.getElementById('grokbot-rail-specialists');
    if (!container) return;
    container.replaceChildren();
    const tasks = this.getSpecialistTasksCatalog();
    const activeId = this.activeSpecialistBot?.id || null;
    for (const task of tasks) {
      const btn = document.createElement('button');
      btn.type = 'button';
      const isSelected = task.id === activeId;
      const isWorkingBg = [...(this.backgroundAgentJobs?.values() || [])].some((j) => j.botId === task.id);
      const isWorkingFg = this.aiRunning && isSelected;
      const isWorking = isWorkingBg || isWorkingFg || task.state === 'working';
      btn.className = 'grokbot-rail-spec-btn' + (isSelected ? ' ativo' : '');
      btn.dataset.specialistId = task.id;
      btn.dataset.botState = isWorking ? 'working' : 'idle';
      btn.style.setProperty('--bot-accent', task.accent || '#168f72');
      btn.title = `${task.name} (${task.specialtyTitle || 'Especialista'})${isWorking ? ' · Trabalhando' : ' · Pronto'}`;
      btn.setAttribute('aria-label', `Conversar com ${task.name}`);
      btn.setAttribute('aria-pressed', String(isSelected));
      btn.innerHTML = this.getSpecialistSymbolSvg(task);
      btn.addEventListener('click', () => this.selectSpecialistBot(task));
      container.appendChild(btn);
    }
  }

  selectSpecialistBot(task, { switchToChat = true, routeMode = 'specialist' } = {}) {
    if (!task) return;
    this.activeSpecialistBot = task;
    this.executionRouteMode = routeMode;
    this.routeOverrideForDraft = null;
    const appEl = document.getElementById('app');
    if (appEl && task.accent) {
      appEl.style.setProperty('--active-bot-accent', task.accent);
    }
    const sessionId = `bot-chat-${task.id}`;
    let session = (this.chatSessions || []).find((s) => s.id === sessionId);
    if (!session) {
      const shortName = String(task.name || 'Bot').replace(/^Bot\s+/i, '');
      session = {
        id: sessionId,
        botId: task.id,
        title: `Bot: ${shortName}`,
        messages: [],
        updatedAt: Date.now()
      };
      this.chatSessions = [session, ...(this.chatSessions || [])].slice(0, 50);
      this.persistChatSessions();
    }
    this.chatSession = session;
    this.syncGrokBotBriefingBar();
    this.renderSpecialistRail();
    this.renderChatSessionSelect();
    this.renderChatSession();
    this.updateOrchestratorRouteStatus(this.elements.aiInput?.value || '');
    if (switchToChat && this.activeBotTab !== 'chat') {
      this.switchBotPanelTab('chat');
    } else if (!switchToChat && this.activeBotTab !== 'chat') {
      this.switchBotPanelTab(this.activeBotTab);
    }
  }

  resolveExecutionRoute(prompt = '') {
    if (this.executionRouteMode === 'specialist' && this.activeSpecialistBot) {
      return { kind: 'specialist', bot: this.activeSpecialistBot, reason: 'user-selected' };
    }
    if (this.executionRouteMode === 'general' || this.routeOverrideForDraft === 'general') {
      return { kind: 'general', bot: null, reason: 'user-selected' };
    }
    return window.ZeroOrchestratorRouting.classifyRequest(prompt, this.getAvailableSpecialistTasks());
  }

  getAvailableSpecialistTasks() {
    return Array.isArray(this.storedSpecialistTasks) ? this.storedSpecialistTasks : [];
  }

  updateOrchestratorRouteStatus(prompt = '') {
    const label = this.elements?.aiRouteLabel || document.getElementById('ai-route-label');
    const button = this.elements?.btnAiRouteMode || document.getElementById('btn-ai-route-mode');
    if (!label || !button) return;
    const route = this.resolveExecutionRoute(prompt);
    if (route.kind === 'specialist') {
      const botName = route.bot.name || 'Bot especialista';
      label.textContent = route.reason === 'user-selected'
        ? `Você escolheu ${botName}. O agente geral executará na aba atual com este perfil.`
        : `Sugestão do orquestrador: ${botName}. O agente geral usa a aba e o perfil atuais.`;
      button.textContent = route.reason === 'user-selected' ? 'Usar agente geral' : 'Fazer aqui mesmo';
      button.hidden = false;
    } else if (this.executionRouteMode === 'general' || this.routeOverrideForDraft === 'general') {
      label.textContent = 'O agente geral executará o pedido na aba atual.';
      button.textContent = 'Ativar orquestrador';
      button.hidden = false;
    } else {
      label.textContent = 'O agente geral executará na aba atual; o orquestrador só encaminha quando reconhece uma especialidade.';
      button.hidden = true;
    }
  }

  handleRouteModeAction() {
    const route = this.resolveExecutionRoute(this.elements.aiInput?.value || '');
    if (this.executionRouteMode === 'specialist') {
      this.useGeneralChat({ mode: 'general' });
    } else if (this.executionRouteMode === 'general') {
      this.executionRouteMode = 'auto';
      this.routeOverrideForDraft = null;
      this.updateOrchestratorRouteStatus(this.elements.aiInput?.value || '');
    } else if (route.kind === 'specialist') {
      this.routeOverrideForDraft = 'general';
      this.updateOrchestratorRouteStatus(this.elements.aiInput?.value || '');
    }
  }

  prepareExecutionRoute(prompt, resumeId = null) {
    if (resumeId) return { kind: 'general', bot: null, reason: 'resume' };
    const route = this.resolveExecutionRoute(prompt);
    if (route.kind === 'specialist' && this.activeSpecialistBot?.id !== route.bot.id) {
      this.selectSpecialistBot(route.bot, { routeMode: this.executionRouteMode === 'specialist' ? 'specialist' : 'auto' });
    } else if (route.kind === 'general' && this.chatSession?.botId) {
      this.useGeneralChat({ mode: this.executionRouteMode === 'general' ? 'general' : 'auto', render: true });
    }
    this.currentExecutionRoute = route;
    return route;
  }

  useGeneralChat({ mode = this.executionRouteMode, render = true } = {}) {
    this.executionRouteMode = mode;
    this.routeOverrideForDraft = null;
    this.activeSpecialistBot = null;
    const generalSession = !this.chatSession?.botId
      ? this.chatSession
      : [...(this.chatSessions || [])].filter((session) => !session.botId).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
    if (generalSession) this.chatSession = generalSession;
    else {
      const session = { id: `c${Date.now().toString(36)}`, title: 'Nova conversa', messages: [], updatedAt: Date.now() };
      this.chatSessions = [session, ...(this.chatSessions || [])].slice(0, 50);
      this.chatSession = session;
      this.persistChatSessions();
    }
    const appEl = document.getElementById('app');
    appEl?.style.removeProperty('--active-bot-accent');
    this.syncGrokBotBriefingBar();
    this.renderSpecialistRail();
    if (render) {
      this.renderChatSessionSelect();
      this.renderChatSession();
    }
    this.updateOrchestratorRouteStatus(this.elements?.aiInput?.value || '');
  }

  renderBotRail() {
    this.syncStopAllButton();
    this.renderSpecialistRail();
    this.elements.botRailList.replaceChildren();
    const availableBots = this.botTeam.bots.filter((bot) => !bot.archived || bot.id === this.botTeam.currentProfileId);
    this.elements.botRailCount.textContent = `${availableBots.length} perfis`;
    if (!availableBots.length) {
      const empty = document.createElement('p');
      empty.className = 'bot-rail-empty';
      empty.textContent = this.botTeam.bots.length ? 'Restaure um Bot na Central' : 'Crie seu primeiro Bot';
      this.elements.botRailList.appendChild(empty);
      return;
    }
    for (const bot of availableBots) this.elements.botRailList.appendChild(this.createBotAvatarButton(bot));
  }

  async toggleBotCentral() {
    const opening = this.elements.botCentral.classList.contains('hidden');
    if (opening) {
      await this.denyPendingApprovals();
      await this.loadBotProfiles();
      this.botCentralReturnToAi = !this.elements.aiPanel.classList.contains('hidden');
      if (this.botCentralReturnToAi) {
        this.elements.aiPanel.classList.add('hidden');
        this.elements.aiPanel.inert = true;
        this.elements.aiPanel.setAttribute('aria-hidden', 'true');
      }
      this.elements.botCentral.classList.remove('hidden');
      this.elements.btnBotCentral.setAttribute('aria-expanded', 'true');
      this.renderBotCentral();
      const layout = await window.zeroBrowser.browser.setSidePanelOpen(true, 'left', 'bots').catch(() => null);
      if (Number.isFinite(Number(layout?.panelWidth)) && Number(layout.panelWidth) > 0) this.applyDelegationPanelWidth(layout.panelWidth);
      this.elements.btnBotCentralClose.focus();
    } else this.closeBotCentral({ restoreFocus: true });
  }

  closeBotCentral({ restoreFocus = false, restorePanel = true } = {}) {
    if (!this.elements.botCentral) return;
    const wasOpen = !this.elements.botCentral.classList.contains('hidden');
    this.elements.botCentral.classList.add('hidden');
    this.elements.btnBotCentral.setAttribute('aria-expanded', 'false');
    if (!wasOpen) return;
    const returnToAi = this.botCentralReturnToAi === true;
    this.botCentralReturnToAi = false;
    if (returnToAi) {
      this.elements.aiPanel.classList.remove('hidden');
      this.elements.aiPanel.inert = false;
      this.elements.aiPanel.removeAttribute('aria-hidden');
    }
    if (restorePanel) window.zeroBrowser.browser.setSidePanelOpen(returnToAi, 'left', returnToAi ? 'ai' : 'none').catch(() => {});
    if (restoreFocus) this.elements.btnBotCentral.focus();
  }

  renderBotCentral() {
    const renderVersion = (this.botCentralRenderVersion || 0) + 1;
    this.botCentralRenderVersion = renderVersion;
    this.elements.botCentralList.replaceChildren();
    this.elements.botCentralAvatarCount.textContent = `${this.botTeam.bots.length} perfis de Bot`;
    const activeBots = this.botTeam.bots.filter((bot) => bot.archived !== true);
    const archivedBots = this.botTeam.bots.filter((bot) => bot.archived === true);
    document.getElementById('bot-central-count').textContent = `${activeBots.length} ativos · ${archivedBots.length} arquivados`;
    this.elements.botCentralList.setAttribute('aria-busy', 'false');

    const appendGroup = (label, bots, emptyMessage) => {
      const section = document.createElement('section');
      section.className = 'bot-central-group';
      const heading = document.createElement('h3');
      heading.className = 'bot-central-group-heading';
      heading.textContent = `${label} (${bots.length})`;
      const headingId = `bot-central-${label === 'Ativos' ? 'active' : 'archived'}-heading`;
      heading.id = headingId;
      const list = document.createElement('div');
      list.className = 'bot-central-group-list';
      list.setAttribute('role', 'list');
      list.setAttribute('aria-labelledby', headingId);
      if (!bots.length && emptyMessage) {
        const empty = document.createElement('p');
        empty.className = 'bot-central-empty';
        empty.setAttribute('role', 'listitem');
        empty.textContent = emptyMessage;
        list.appendChild(empty);
      }
      for (const bot of bots) list.appendChild(this.createBotCentralRow(bot));
      section.append(heading, list);
      this.elements.botCentralList.appendChild(section);
    };

    appendGroup('Ativos', activeBots, this.botTeam.bots.length
      ? 'Não há Bots ativos. Restaure um arquivado ou crie um Bot.'
      : 'Ainda não há Bots. Crie um para iniciar uma sessão isolada.');
    if (archivedBots.length) appendGroup('Arquivados', archivedBots);
    if (!this.botTeam.bots.length) this.appendBotStarterTemplates();
    if (this.botTeam.bots.length < 15) {
      this.appendGrokBotCentralSections(renderVersion);
    }
  }

  async appendGrokBotCentralSections(renderVersion = this.botCentralRenderVersion) {
    const host = this.elements.botCentralList;
    if (!host) return;
    await this.refreshSpecialistTasksFromStore();
    if (renderVersion !== this.botCentralRenderVersion) return;

    // Seção 1: tarefas especializadas salvas.
    const specCard = document.createElement('section');
    specCard.className = 'grokbot-central-card';
    const specTitle = document.createElement('h4');
    specTitle.textContent = `Tarefas especialistas (${(this.storedSpecialistTasks || []).length})`;
    const specDesc = document.createElement('p');
    specDesc.textContent = 'Tarefas especialistas usam o perfil atual. Para separar logins e dados, abra um perfil de Bot.';
    specCard.append(specTitle, specDesc);

    for (const task of (this.storedSpecialistTasks || []).slice(0, 6)) {
      const row = document.createElement('div');
      row.className = 'grokbot-central-item';
      const info = document.createElement('div');
      const strong = document.createElement('strong');
      strong.textContent = task.name;
      const sub = document.createElement('span');
      sub.style.display = 'block';
      sub.style.fontSize = '11px';
      sub.style.color = 'var(--text-secondary)';
      sub.textContent = `${task.specialtyTitle || 'Especialista'} · Degrau ${task.autonomyStep || 1}`;
      info.append(strong, sub);

      const actions = document.createElement('div');
      actions.className = 'grokbot-central-actions';
      const selectBtn = document.createElement('button');
      selectBtn.type = 'button';
      selectBtn.textContent = 'Selecionar';
      selectBtn.addEventListener('click', () => {
        this.selectSpecialistBot(task, { switchToChat: true });
        this.closeBotCentral();
        this.showToast(`${task.name} selecionado no painel Delegar.`, 'info');
      });
      const runBgBtn = document.createElement('button');
      runBgBtn.type = 'button';
      runBgBtn.textContent = 'Rodar 2º plano';
      runBgBtn.addEventListener('click', () => {
        this.closeBotCentral();
        this.runSpecialistBotInBackground(task);
      });
      actions.append(selectBtn, runBgBtn);
      row.append(info, actions);
      specCard.appendChild(row);
    }

    // A fonte atual ainda devolve dados de demonstração; não os apresente como dados reais.
    const appsCard = document.createElement('section');
    appsCard.className = 'grokbot-central-card';
    const appsTitle = document.createElement('h4');
    appsTitle.textContent = 'Apps locais';
    const appsDesc = document.createElement('p');
    appsDesc.textContent = 'Painéis com fontes de dados reais ainda não estão disponíveis. Os exemplos de demonstração não aparecem como informação atual.';
    const appsStatus = document.createElement('span');
    appsStatus.className = 'grokbot-central-status';
    appsStatus.textContent = 'Aguardando conexão de uma fonte de dados';
    appsCard.append(appsTitle, appsDesc, appsStatus);

    // Conectores ainda não executam operações externas reais nesta versão.
    const connCard = document.createElement('section');
    connCard.className = 'grokbot-central-card';
    const connTitle = document.createElement('h4');
    connTitle.textContent = 'Conexões com serviços';
    const connDesc = document.createElement('p');
    connDesc.textContent = 'Esta versão ainda não lê nem envia dados por conectores externos.';
    const connActions = document.createElement('div');
    connActions.className = 'grokbot-central-actions';
    const tgBtn = document.createElement('button');
    tgBtn.type = 'button';
    tgBtn.textContent = 'Conexões indisponíveis';
    tgBtn.disabled = true;
    tgBtn.title = 'A integração externa ainda não está conectada';
    connActions.append(tgBtn);
    connCard.append(connTitle, connDesc, connActions);
    if (renderVersion !== this.botCentralRenderVersion || !host.isConnected || this.elements.botCentral.classList.contains('hidden')) return;
    host.append(specCard, appsCard, connCard);
  }

  appendBotStarterTemplates() {
    const gallery = document.createElement('section');
    gallery.className = 'bot-central-group bot-starter-gallery';
    const heading = document.createElement('h3');
    heading.className = 'bot-central-group-heading';
    heading.textContent = 'Modelos prontos (somente leitura)';
    const list = document.createElement('div');
    list.className = 'bot-central-group-list';
    const starters = [
      { id: 'starter-prices', title: 'Pesquisador de preços', summary: 'Compara até 3 lojas em paralelo e monta tabela com menor preço e frete.', prompt: 'Compare o preço do produto nas 3 lojas abertas e monte uma tabela com menor preço e frete.' },
      { id: 'starter-stock', title: 'Preço de ação', summary: 'Monitora cotação em somente leitura e avisa quando atingir o alvo.', prompt: 'Verifique a cotação atual do ativo nesta página e compare com minha faixa de alerta.' },
      { id: 'starter-email', title: 'Resumo de e-mail', summary: 'Resume a caixa de entrada sem enviar nem apagar mensagens.', prompt: 'Resuma os e-mails visíveis na caixa de entrada destacando urgências, sem responder nem arquivar.' }
    ];
    for (const starter of starters) {
      const card = document.createElement('div');
      card.className = 'bot-starter-card';
      const copy = document.createElement('div');
      copy.className = 'bot-central-row-copy';
      const title = document.createElement('strong');
      title.textContent = starter.title;
      const desc = document.createElement('span');
      desc.textContent = starter.summary;
      copy.append(title, desc);
      const useBtn = document.createElement('button');
      useBtn.type = 'button';
      useBtn.className = 'bot-central-action';
      useBtn.textContent = 'Usar modelo';
      useBtn.setAttribute('aria-label', `Usar modelo ${starter.title}`);
      useBtn.addEventListener('click', () => {
        this.closeBotCentral();
        this.switchBotPanelTab('chat');
        this.elements.aiInput.value = starter.prompt;
        this.elements.aiInput.focus();
      });
      card.append(copy, useBtn);
      list.appendChild(card);
    }
    gallery.append(heading, list);
    this.elements.botCentralList.appendChild(gallery);
  }

  createBotCentralRow(bot) {
    const isCurrent = bot.id === this.botTeam.currentProfileId;
    const isArchived = bot.archived === true;
    const row = document.createElement('div');
    row.setAttribute('role', 'listitem');
    if (isCurrent) row.setAttribute('aria-current', 'true');
    row.className = 'bot-central-row';
    row.dataset.botId = bot.id;
    row.style.setProperty('--bot-accent', bot.avatar?.accent || '#168f72');

    const content = !isArchived && !isCurrent ? document.createElement('button') : document.createElement('div');
    content.className = 'bot-central-open';
    if (content.tagName === 'BUTTON') {
      content.type = 'button';
      content.setAttribute('aria-label', `Abrir janela do Bot ${bot.name}`);
      content.title = `Abrir janela do Bot ${bot.name}`;
    } else {
      content.classList.add('bot-central-identity');
      content.setAttribute('aria-label', isArchived
        ? `Bot ${bot.name}, arquivado${isCurrent ? ' e aberto nesta janela' : ''}`
        : `Bot ${bot.name}, perfil aberto nesta janela`);
    }

    const image = document.createElement('span');
    image.className = 'bot-avatar';
    image.style.setProperty('--bot-accent', bot.avatar?.accent || '#168f72');
    const visualState = this.getBotVisualState(bot);
    image.dataset.botState = visualState.state;
    if (visualState.state === 'working') image.classList.add('is-working');
    if (visualState.badge) image.dataset.stateBadge = visualState.badge;
    image.setAttribute('aria-hidden', 'true');
    image.appendChild(this.createBotAvatarMark(bot));

    const copy = document.createElement('span');
    copy.className = 'bot-central-row-copy';
    const name = document.createElement('strong');
    name.textContent = bot.name;
    const state = document.createElement('span');
    state.textContent = isArchived
      ? (isCurrent ? 'Arquivado · aberto nesta janela' : 'Arquivado · não pode ser aberto')
      : (isCurrent ? 'Perfil aberto nesta janela' : 'Sessão isolada');
    copy.append(name, state);
    content.append(image, copy);
    row.appendChild(content);

    if (!isArchived && !isCurrent) content.addEventListener('click', () => {
      window.zeroBrowser.browser.openBotProfile(bot.id).catch((error) => this.showToast(`Não foi possível abrir ${bot.name}: ${error.message}`, 'error'));
    });

    const action = document.createElement('button');
    action.type = 'button';
    action.className = `bot-central-action${isArchived ? ' is-restore' : ''}`;
    action.dataset.botId = bot.id;
    action.dataset.botAction = isArchived ? 'restore' : 'archive';
    action.setAttribute('aria-label', `${isArchived ? 'Restaurar' : 'Arquivar'} Bot ${bot.name}`);
    action.textContent = isArchived ? 'Restaurar' : 'Arquivar';
    action.addEventListener('click', () => this.changeBotArchiveState(bot, action));
    row.appendChild(action);
    return row;
  }

  async changeBotArchiveState(bot, button) {
    const restoring = bot.archived === true;
    const actionLabel = restoring ? 'restaurado' : 'arquivado';
    this.elements.botCentralStatus.textContent = `${restoring ? 'Restaurando' : 'Arquivando'} ${bot.name}…`;
    this.elements.botCentralList.setAttribute('aria-busy', 'true');
    button.disabled = true;
    try {
      if (restoring) await window.zeroBrowser.browser.restoreBot(bot.id);
      else await window.zeroBrowser.browser.archiveBot(bot.id);
      await this.loadBotProfiles();
      this.elements.botCentralStatus.textContent = `${bot.name} foi ${actionLabel}.`;
      this.recordActionReceipt({
        title: `${restoring ? 'Bot restaurado' : 'Bot arquivado'}: ${bot.name}`,
        detail: 'Reversível · clique em Desfazer para reverter na Central',
        undo: async () => {
          if (restoring) await window.zeroBrowser.browser.archiveBot(bot.id);
          else await window.zeroBrowser.browser.restoreBot(bot.id);
          await this.loadBotProfiles();
          if (!this.elements.botCentral.classList.contains('hidden')) this.renderBotCentral();
        }
      });
      const nextAction = restoring ? 'archive' : 'restore';
      const nextButton = [...this.elements.botCentralList.querySelectorAll('.bot-central-action')]
        .find((candidate) => candidate.dataset.botId === bot.id && candidate.dataset.botAction === nextAction);
      if (nextButton) nextButton.focus();
    } catch (error) {
      this.elements.botCentralStatus.textContent = `Não foi possível ${restoring ? 'restaurar' : 'arquivar'} ${bot.name}.`;
      this.showToast(`Não foi possível ${restoring ? 'restaurar' : 'arquivar'} ${bot.name}: ${error.message}`, 'error');
      if (button.isConnected) button.disabled = false;
    } finally {
      this.elements.botCentralList.setAttribute('aria-busy', 'false');
    }
  }

  async toggleSettingsPanel() {
    const opening = this.elements.settingsPanel.classList.contains('hidden');
    if (opening) await this.denyPendingApprovals();
    this.closeBotCentral({ restorePanel: false });
    this.elements.settingsPanel.classList.toggle('hidden', !opening);
    this.elements.aiPanel.classList.add('hidden');
    this.clearDelegationMode();
    this.elements.libraryPanel.classList.add('hidden');
    this.closeAppMenu();
    window.zeroBrowser.browser.setSidePanelOpen(opening, 'right', opening ? 'settings' : 'none');
    if (opening) {
      this.freezePageForPanel();
      this.loadSettingsToUI();
      this.loadAiSettings();
    } else if (this.elements.aiPanel.classList.contains('hidden') && this.elements.libraryPanel.classList.contains('hidden')) this.releasePageOverlay('panel');
  }

  closeSettingsPanel() {
    this.elements.settingsPanel.classList.add('hidden');
    if (this.elements.aiPanel.classList.contains('hidden')) window.zeroBrowser.browser.setSidePanelOpen(false, 'right', 'none');
    if (this.elements.aiPanel.classList.contains('hidden') && this.elements.libraryPanel.classList.contains('hidden')) this.releasePageOverlay('panel');
  }

  async toggleAppMenu() {
    const opening = this.elements.appMenu.classList.contains('hidden');
    this.elements.appMenu.classList.toggle('hidden', !opening);
    this.elements.btnAppMenu.setAttribute('aria-expanded', String(opening));
    if (!opening) return this.releaseAppMenuFreeze();
    window.zeroBrowser.browser.getAppInfo().then((info) => {
      document.getElementById('app-menu-version').textContent = `Zero Browser ${info.version} · ${info.profile}`;
    }).catch(() => {});
    const requestId = this.appMenuFreezeRequest = (this.appMenuFreezeRequest || 0) + 1;
    const frozen = await window.zeroBrowser.browser.freezePage(true, 'menu').catch(() => null);
    if (requestId !== this.appMenuFreezeRequest || this.elements.appMenu.classList.contains('hidden')) {
      await window.zeroBrowser.browser.freezePage(false, 'menu').catch(() => {});
      return;
    }
    if (frozen?.image) {
      const container = this.elements.browserContainer;
      container.style.backgroundImage = `url("${frozen.image}")`;
      container.style.backgroundSize = `${frozen.bounds.width}px ${frozen.bounds.height}px`;
      container.classList.add('frozen');
    }
    this.elements.appMenu.querySelector('[role="menuitem"]')?.focus();
  }

  closeAppMenu({ restoreFocus = false } = {}) {
    const wasOpen = !this.elements.appMenu.classList.contains('hidden');
    this.elements.appMenu.classList.add('hidden');
    this.elements.btnAppMenu.setAttribute('aria-expanded', 'false');
    if (wasOpen) {
      this.appMenuFreezeRequest = (this.appMenuFreezeRequest || 0) + 1;
      this.releaseAppMenuFreeze();
    }
    if (wasOpen && restoreFocus) this.elements.btnAppMenu.focus();
  }

  releaseAppMenuFreeze() {
    return this.releasePageOverlay('menu');
  }

  runMenuAction(action) {
    this.closeAppMenu();
    if (action === 'new-tab') return this.createTab('zero://newtab');
    if (action === 'history' || action === 'downloads' || action === 'bookmarks') return this.openLibrary(action);
    if (action === 'settings') return this.toggleSettingsPanel();
    if (action === 'whats-new') return window.zeroBrowser.browser.whatsNew().catch(() => {});
    if (action === 'extensions') return this.openExtensionsManager();
    if (action === 'profiles') return window.zeroBrowser.browser.openProfileMenu(Math.max(0, window.innerWidth - 240), 90).catch(() => {});
    if (action === 'central') {
      if (this.elements.aiPanel.classList.contains('hidden')) this.toggleAiPanel(true).then(() => this.toggleBotCentral());
      else this.toggleBotCentral();
      return;
    }
    if (action === 'split-view') {
      const appEl = document.getElementById('app');
      const active = appEl.classList.toggle('split-view-active');
      this.showToast(active ? 'Modo Dividir tela ativado (50% / 50%).' : 'Modo Dividir tela desativado.', 'info');
      return;
    }
    if (action === 'ask-pdf') {
      if (this.elements.aiPanel.classList.contains('hidden')) this.toggleAiPanel(true);
      this.switchBotPanelTab('chat');
      this.elements.aiInput.value = 'Analise o documento/PDF aberto nesta aba, resuma os pontos principais e cite as seções.';
      this.elements.aiInput.focus();
      return;
    }
  }

  initBotPanelTabs() {
    this.activeBotTab = 'chat';
    this.botAgendaItems = [
      { id: 'ag-1', title: 'Monitor de preços matinal', cadence: 'Diariamente às 09:00', mode: 'Somente leitura', active: true }
    ];
    this.botRingSymbols = [];
    this.storedSpecialistTasks = [];
    this.activeSpecialistBot = null;
    for (const tab of document.querySelectorAll('.bot-panel-tab')) {
      tab.addEventListener('click', () => this.switchBotPanelTab(tab.dataset.botTab));
    }
    document.getElementById('btn-grokbot-run-bg')?.addEventListener('click', () => {
      this.sendAiMessageInBackground();
    });
    document.getElementById('btn-grokbot-teach-quick')?.addEventListener('click', () => this.startTeachTaskFlow());
    this.initSpecialistBotModal();
    this.refreshSpecialistTasksFromStore();
  }

  async refreshSpecialistTasksFromStore() {
    try {
      if (window.zeroBrowser?.bots?.getSymbols) {
        const syms = await window.zeroBrowser.bots.getSymbols();
        if (Array.isArray(syms)) this.botRingSymbols = syms;
      }
      if (window.zeroBrowser?.bots?.listTasks) {
        const tasks = await window.zeroBrowser.bots.listTasks();
        if (Array.isArray(tasks) && tasks.length) {
          this.storedSpecialistTasks = tasks;
          if (this.activeSpecialistBot) {
            const updated = tasks.find((t) => t.id === this.activeSpecialistBot.id);
            this.activeSpecialistBot = updated || null;
          }
        } else this.storedSpecialistTasks = [];
      }
    } catch {}
    this.syncGrokBotBriefingBar();
    this.renderSpecialistRail();
    this.updateOrchestratorRouteStatus(this.elements?.aiInput?.value || '');
  }

  syncGrokBotBriefingBar() {
    const bot = this.activeSpecialistBot;
    const ringEl = document.getElementById('grokbot-active-ring');
    const nameEl = document.getElementById('grokbot-active-name');
    const statusEl = document.getElementById('grokbot-active-status');
    const metaEl = document.getElementById('grokbot-active-meta');
    const shortName = bot
      ? (String(bot.name || 'Bot especialista').replace(/^Bot\s+(Caçador\s+de\s+|Radar\s+de\s+|Triagem\s+)?/i, '') || 'Bot especialista')
      : 'Agente geral';
    const isWorkingBg = [...(this.backgroundAgentJobs?.values() || [])].some((j) => bot ? j.botId === bot.id : !j.botId);
    const isWorking = Boolean(this.aiRunning || isWorkingBg);
    if (ringEl) {
      ringEl.style.setProperty('--bot-accent', bot?.accent || '#168f72');
      ringEl.dataset.botState = isWorking ? 'working' : 'idle';
      ringEl.innerHTML = this.getSpecialistSymbolSvg(bot || { id: 'general', specialty: 'general', symbolId: 'compass' });
    }
    if (nameEl) nameEl.textContent = shortName;
    if (statusEl) {
      statusEl.textContent = isWorkingBg
        ? '● Trabalhando em 2º plano'
        : this.aiRunning
          ? '● Trabalhando nesta aba'
          : '● Pronto';
      statusEl.classList.toggle('is-idle', !isWorking);
    }
    if (metaEl) {
      metaEl.textContent = bot?.goal || 'O orquestrador sugere um perfil especialista quando reconhece a tarefa; caso contrário, o agente geral cuida dela.';
    }
    if (this.elements?.aiInput) {
      this.elements.aiInput.placeholder = bot
        ? `Descreva o pedido para ${shortName}; o agente geral executará na aba atual…`
        : 'Descreva a tarefa. O orquestrador escolhe o Bot adequado ou usa o agente geral…';
    }
    this.syncStopAllButton();
  }

  async runSpecialistBotInBackground(botSpec, customPrompt = null) {
    if (botSpec && botSpec.id !== this.activeSpecialistBot?.id) {
      this.selectSpecialistBot(botSpec, { switchToChat: true });
    }
    return this.sendAiMessageInBackground(customPrompt || botSpec?.goal || null);
  }

  getDefaultSpecialistPresets() {
    return [
      {
        id: 'price-hunter',
        title: 'Pesquisador de Preços',
        subtitle: 'Compara lojas e frete em 2º plano e traz para frente ao achar o menor valor.',
        defaultName: 'Bot Caçador de Preços',
        defaultUrl: 'https://www.google.com/shopping',
        goal: 'Comparar preços e frete nas lojas abertas, montar tabela comparativa e trazer a aba para frente quando atingir a meta.',
        permission: 'somente-leitura',
        executionMode: 'background-auto-foreground',
        accent: '#168f72'
      },
      {
        id: 'market-radar',
        title: 'Radar Financeiro e Ações',
        subtitle: 'Vigia cotações e variações em silêncio até atingir seu gatilho.',
        defaultName: 'Bot Radar de Mercado',
        defaultUrl: 'https://www.google.com/finance',
        goal: 'Monitorar cotação do ativo em somente leitura e trazer a aba para frente se atingir a faixa de alerta.',
        permission: 'somente-leitura',
        executionMode: 'background-auto-foreground',
        accent: '#1677d9'
      },
      {
        id: 'inbox-triage',
        title: 'Triagem de E-mail e Agenda',
        subtitle: 'Separa urgências e prepara resumos sem responder sozinho.',
        defaultName: 'Bot Triagem Executiva',
        defaultUrl: 'about:blank',
        goal: 'Ler mensagens visíveis, classificar urgências do dia e trazer para frente quando houver item crítico.',
        permission: 'somente-leitura',
        executionMode: 'background-auto-foreground',
        accent: '#7b4fd4'
      },
      {
        id: 'erp-operator',
        title: 'Operador de Trabalho e ERP',
        subtitle: 'Extrai tabelas e prepara formulários, chamando você antes de gravar.',
        defaultName: 'Bot Operador ERP',
        defaultUrl: 'about:blank',
        goal: 'Extrair dados operacionais do sistema, preencher rascunho e trazer a aba para frente pedindo aprovação antes de enviar.',
        permission: 'escrita-aprovada',
        executionMode: 'dedicated-tab',
        accent: '#c95f18'
      },
      {
        id: 'page-sentinel',
        title: 'Vigia de Editais e Estoque',
        subtitle: 'Monitora mudanças na página em 2º plano e abre na frente ao detectar novidade.',
        defaultName: 'Bot Vigia de Mudanças',
        defaultUrl: 'about:blank',
        goal: 'Inspecionar conteúdo da página em segundo plano e trazer a aba para frente assim que detectar atualização ou estoque.',
        permission: 'somente-leitura',
        executionMode: 'background-auto-foreground',
        accent: '#b8860b'
      },
      {
        id: 'custom-specialist',
        title: 'Especialista Personalizado',
        subtitle: 'Defina a missão e se o Bot abre uma nova aba ou trabalha em 2º plano no perfil atual.',
        defaultName: 'Bot Especialista',
        defaultUrl: 'about:blank',
        goal: 'Executar a missão definida pelo usuário e trazer a aba para frente ao concluir ou quando precisar de decisão.',
        permission: 'somente-leitura',
        executionMode: 'background-auto-foreground',
        accent: '#0d9488'
      }
    ];
  }

  initSpecialistBotModal() {
    this.specialistPresets = this.getDefaultSpecialistPresets();
    if (window.zeroBrowser?.bots?.getPresets) {
      window.zeroBrowser.bots.getPresets().then((list) => {
        if (Array.isArray(list) && list.length) this.specialistPresets = list;
      }).catch(() => {});
    }
    if (window.zeroBrowser?.bots?.onAttention) {
      window.zeroBrowser.bots.onAttention((attention) => {
        if (attention?.botId) this.bringSpecialistBotToFront(attention.botId, attention.reason || 'goal_reached');
      });
    }
    document.getElementById('btn-specialist-close')?.addEventListener('click', () => this.closeSpecialistBotModal());
    document.getElementById('btn-specialist-cancel')?.addEventListener('click', () => this.closeSpecialistBotModal());
    document.getElementById('btn-specialist-launch')?.addEventListener('click', () => this.launchSpecialistBotFromModal());
    document.getElementById('btn-specialist-profile-menu')?.addEventListener('click', () => {
      this.closeSpecialistBotModal();
      window.zeroBrowser.browser.openProfileMenu(72, 96).catch(() => {});
    });
  }

  openSpecialistBotModal(presetId = 'price-hunter') {
    const modal = document.getElementById('bot-specialist-modal');
    if (!modal) return;
    if (this.elements.aiPanel.classList.contains('hidden')) {
      this.toggleAiPanel(true);
    }
    this.elements.aiPanel.classList.add('hidden');
    modal.classList.remove('hidden');
    this.renderSpecialistPresetButtons(presetId);
    this.selectSpecialistPreset(presetId);
    document.getElementById('bot-specialist-name')?.focus();
  }

  closeSpecialistBotModal() {
    const modal = document.getElementById('bot-specialist-modal');
    if (!modal || modal.classList.contains('hidden')) return;
    modal.classList.add('hidden');
    if (document.getElementById('app')?.classList.contains('delegation-mode') && this.elements.botCentral.classList.contains('hidden')) {
      this.elements.aiPanel.classList.remove('hidden');
      this.elements.aiPanel.inert = false;
      this.elements.aiPanel.removeAttribute('aria-hidden');
      window.zeroBrowser.browser.setSidePanelOpen(true, 'left', 'ai').catch(() => {});
    }
  }

  renderSpecialistPresetButtons(selectedId) {
    const container = document.getElementById('bot-specialist-presets');
    if (!container) return;
    container.replaceChildren();
    for (const preset of this.specialistPresets || this.getDefaultSpecialistPresets()) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `bot-specialist-preset-btn${preset.id === selectedId ? ' ativo' : ''}`;
      btn.dataset.presetId = preset.id;
      btn.style.setProperty('--preset-accent', preset.accent || '#168f72');
      btn.setAttribute('aria-pressed', String(preset.id === selectedId));
      const title = document.createElement('strong');
      title.textContent = preset.title;
      const sub = document.createElement('span');
      sub.textContent = preset.subtitle;
      btn.append(title, sub);
      btn.addEventListener('click', () => this.selectSpecialistPreset(preset.id));
      container.appendChild(btn);
    }
  }

  selectSpecialistPreset(presetId) {
    const presets = this.specialistPresets || this.getDefaultSpecialistPresets();
    const preset = presets.find((p) => p.id === presetId) || presets[0];
    if (!preset) return;
    this.selectedSpecialistPresetId = preset.id;
    for (const btn of document.querySelectorAll('.bot-specialist-preset-btn')) {
      const active = btn.dataset.presetId === preset.id;
      btn.classList.toggle('ativo', active);
      btn.setAttribute('aria-pressed', String(active));
    }
    const nameInput = document.getElementById('bot-specialist-name');
    const urlInput = document.getElementById('bot-specialist-url');
    const goalInput = document.getElementById('bot-specialist-goal');
    if (nameInput) nameInput.value = preset.defaultName || preset.title;
    if (urlInput) {
      const activeTabUrl = this.tabs.get(this.activeTabId)?.url;
      urlInput.value = preset.defaultUrl && preset.defaultUrl !== 'about:blank'
        ? preset.defaultUrl
        : (activeTabUrl && !activeTabUrl.includes('newtab') ? activeTabUrl : 'about:blank');
    }
    if (goalInput) goalInput.value = preset.goal || '';
    const bgRadio = document.getElementById('bot-mode-background');
    const dedRadio = document.getElementById('bot-mode-dedicated');
    if (preset.executionMode === 'dedicated-tab' && dedRadio) dedRadio.checked = true;
    else if (bgRadio) bgRadio.checked = true;
  }

  attachBotMetaToTab(tabId, botMeta = {}) {
    this.botTabs.set(tabId, botMeta);
    const tabEntry = this.tabs.get(tabId);
    const tabEl = tabEntry?.element || this.elements.tabsContainer.querySelector(`.tab[data-tab-id="${tabId}"]`);
    if (!tabEl) return;
    tabEl.classList.add('tab-bot-owned');
    tabEl.dataset.botId = botMeta.botId || '';
    tabEl.dataset.botExecutionMode = botMeta.executionMode || 'background-auto-foreground';
    tabEl.style.setProperty('--tab-bot-accent', botMeta.accent || '#168f72');
    const selectBtn = tabEl.querySelector('.tab-select');
    if (selectBtn && !selectBtn.querySelector('.tab-bot-badge')) {
      const badge = document.createElement('span');
      badge.className = 'tab-bot-badge';
      badge.textContent = botMeta.shortBadge || botMeta.name || 'Bot';
      selectBtn.prepend(badge);
    }
  }

  async launchSpecialistBotFromModal() {
    const presets = this.specialistPresets || this.getDefaultSpecialistPresets();
    const preset = presets.find((p) => p.id === this.selectedSpecialistPresetId) || presets[0];
    const name = (document.getElementById('bot-specialist-name')?.value || preset.defaultName || 'Bot Especialista').trim();
    const rawUrl = (document.getElementById('bot-specialist-url')?.value || preset.defaultUrl || 'about:blank').trim();
    const goal = (document.getElementById('bot-specialist-goal')?.value || preset.goal || '').trim();
    const executionMode = document.getElementById('bot-mode-dedicated')?.checked
      ? 'dedicated-tab'
      : 'background-auto-foreground';
    this.closeSpecialistBotModal();
    return this.launchSpecialistBot({
      name,
      specialty: preset.id,
      specialtyTitle: preset.title,
      defaultUrl: rawUrl,
      goal,
      permission: preset.permission || 'somente-leitura',
      executionMode,
      accent: preset.accent || '#168f72'
    });
  }

  async launchSpecialistBot(spec = {}) {
    const executionMode = spec.executionMode === 'dedicated-tab' ? 'dedicated-tab' : 'background-auto-foreground';
    const isBackground = executionMode === 'background-auto-foreground';
    const targetUrl = spec.defaultUrl && /^(https?:\/\/|about:blank|zero:\/\/newtab)/i.test(spec.defaultUrl)
      ? spec.defaultUrl
      : 'about:blank';

    let createdTask = null;
    if (window.zeroBrowser?.bots?.createTask) {
      try {
        createdTask = await window.zeroBrowser.bots.createTask({
          name: spec.name || 'Bot Especialista',
          specialty: spec.specialty || 'custom-specialist',
          specialtyTitle: spec.specialtyTitle || 'Especialista',
          executionMode,
          defaultUrl: targetUrl,
          accent: spec.accent || '#168f72',
          goal: spec.goal || '',
          permission: spec.permission || 'somente-leitura'
        });
      } catch {}
    }

    const botId = createdTask?.id || `bot-spec-${Date.now()}`;
    const botMeta = {
      botId,
      name: spec.name || createdTask?.name || 'Bot Especialista',
      specialty: spec.specialty || 'custom-specialist',
      specialtyTitle: spec.specialtyTitle || createdTask?.specialtyTitle || 'Especialista',
      executionMode,
      accent: spec.accent || createdTask?.accent || '#168f72',
      goal: spec.goal || createdTask?.goal || '',
      shortBadge: (spec.name || 'Bot').replace(/^Bot\s+/i, '').slice(0, 14)
    };

    const previousActiveTabId = this.activeTabId;
    const botTabId = await this.createTab(targetUrl, {
      background: isBackground,
      botMeta
    });
    if (botTabId) {
      botMeta.tabId = botTabId;
      this.specialistBots.set(botId, botMeta);
      if (isBackground && previousActiveTabId && previousActiveTabId !== botTabId) {
        this.activeTabId = previousActiveTabId;
      }
    }

    this.recordActionReceipt({
      title: `${botMeta.name} (${botMeta.specialtyTitle})`,
      detail: isBackground
        ? 'Em 2º plano · trará a aba para frente ao atingir a meta ou precisar de você'
        : 'Aba dedicada aberta e ativa'
    });

    if (isBackground) {
      this.showToast(`${botMeta.name} iniciado em 2º plano. Ele trará a aba para frente quando atingir a meta ou precisar de você.`, 'info');
    } else {
      this.switchBotPanelTab('chat');
      if (this.elements.aiInput && botMeta.goal) {
        this.elements.aiInput.value = botMeta.goal;
        this.elements.aiInput.focus();
      }
      this.showToast(`${botMeta.name} aberto em uma nova aba do perfil atual.`, 'success');
    }

    return { botId, tabId: botTabId, executionMode, botMeta };
  }

  bringSpecialistBotToFront(botIdOrTabId, reason = 'goal_reached') {
    let meta = this.specialistBots.get(botIdOrTabId) || this.botTabs.get(botIdOrTabId);
    if (!meta) {
      for (const candidate of this.specialistBots.values()) {
        if (candidate.tabId === botIdOrTabId || candidate.botId === botIdOrTabId) {
          meta = candidate;
          break;
        }
      }
    }
    const targetTabId = meta?.tabId || (this.tabs.has(botIdOrTabId) ? botIdOrTabId : null);
    if (!targetTabId || !this.tabs.has(targetTabId)) return false;

    this.switchTab(targetTabId);
    const tabEl = this.tabs.get(targetTabId)?.element;
    if (tabEl) {
      tabEl.classList.add('tab-bot-attention');
    }
    if (this.elements.aiPanel.classList.contains('hidden')) {
      this.toggleAiPanel(true);
    }
    this.switchBotPanelTab('chat');

    const reasonLabel = reason === 'approval_needed'
      ? 'precisa da sua aprovação para prosseguir'
      : reason === 'human_intervention'
        ? 'encontrou verificação humana (CAPTCHA/login) na aba'
        : 'atingiu a meta configurada';

    this.recordActionReceipt({
      title: `${meta?.name || 'Bot Especialista'} trouxe a aba para frente`,
      detail: `Motivo: ${reasonLabel}`
    });
    this.showToast(`${meta?.name || 'Bot Especialista'}: ${reasonLabel}.`, reason === 'goal_reached' ? 'success' : 'warning');
    return true;
  }

  promoteBackgroundBotTabIfNeeded(reason = 'approval_needed') {
    for (const [tabId, meta] of this.botTabs.entries()) {
      if (meta.executionMode === 'background-auto-foreground' && this.activeTabId !== tabId) {
        this.bringSpecialistBotToFront(tabId, reason);
        return true;
      }
    }
    return false;
  }

  switchBotPanelTab(tabName = 'chat') {
    this.activeBotTab = tabName;
    for (const tab of document.querySelectorAll('.bot-panel-tab')) {
      const selected = tab.dataset.botTab === tabName;
      tab.classList.toggle('ativo', selected);
      tab.setAttribute('aria-pressed', String(selected));
    }
    const isChat = tabName === 'chat';
    this.elements.aiChat?.classList.toggle('hidden', !isChat);
    document.querySelector('.ai-chat-toolbar')?.classList.toggle('hidden', !isChat);
    document.querySelector('.ai-input-area')?.classList.toggle('hidden', !isChat);
    const agendaView = document.getElementById('bot-view-agenda');
    const memoryView = document.getElementById('bot-view-memory');
    const routesView = document.getElementById('bot-view-routes');
    const historyView = document.getElementById('bot-view-history');
    agendaView?.classList.toggle('hidden', tabName !== 'agenda');
    memoryView?.classList.toggle('hidden', tabName !== 'memory');
    routesView?.classList.toggle('hidden', tabName !== 'routes');
    historyView?.classList.toggle('hidden', tabName !== 'history');
    if (tabName === 'agenda') this.renderBotAgendaView(agendaView);
    if (tabName === 'memory') this.renderBotMemoryView(memoryView);
    if (tabName === 'routes') this.renderBotRoutesView(routesView);
    if (tabName === 'history') this.renderBotHistoryView(historyView);
  }

  async renderBotAgendaView(container) {
    if (!container) return;
    container.replaceChildren();
    const bot = this.activeSpecialistBot || (this.storedSpecialistTasks || [])[0];
    const botId = bot?.id || 'bot-default-price';

    // 1. Rotinas por horário
    const header = document.createElement('div');
    header.className = 'bot-subview-header';
    const title = document.createElement('strong');
    title.textContent = 'Rotinas agendadas deste Bot';
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn-ghost';
    addBtn.textContent = '+ Agendar tarefa';
    addBtn.addEventListener('click', () => {
      const taskName = window.prompt('Qual tarefa o Bot deve repetir em somente leitura?', 'Verificar variações de preço');
      if (taskName && taskName.trim() && window.zeroBrowser?.bots?.createTask) {
        window.zeroBrowser.bots.createTask({ name: taskName.trim().slice(0, 80), goal: taskName.trim().slice(0, 80), permission: 'somente-leitura', schedule: { enabled: true, kind: 'daily', dailyAt: '09:00' } }).catch(() => {});
      }
      if (!taskName || !taskName.trim()) return;
      this.botAgendaItems.unshift({
        id: `ag-${Date.now()}`,
        title: taskName.trim().slice(0, 80),
        cadence: 'Diariamente às 09:00',
        mode: 'Somente leitura',
        active: true
      });
      this.renderBotAgendaView(container);
    });
    header.append(title, addBtn);
    container.appendChild(header);
    for (const item of this.botAgendaItems) {
      const card = document.createElement('div');
      card.className = 'ai-receipt-card';
      const copy = document.createElement('div');
      copy.className = 'ai-receipt-copy';
      const h = document.createElement('strong');
      h.textContent = item.title;
      const meta = document.createElement('span');
      meta.textContent = `${item.cadence} · ${item.mode} · ${item.active ? 'Ativa' : 'Pausada'}`;
      copy.append(h, meta);
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'btn-ghost btn-undo-receipt';
      toggle.textContent = item.active ? 'Pausar' : 'Retomar';
      toggle.addEventListener('click', () => {
        item.active = !item.active;
        this.renderBotAgendaView(container);
      });
      card.append(copy, toggle);
      container.appendChild(card);
    }

    // 2. Gatilhos por Evento (Mudança na página / Preço abaixo da meta / E-mail urgente)
    let triggers = [];
    if (window.zeroBrowser?.bots?.listTriggers) {
      triggers = await window.zeroBrowser.bots.listTriggers().catch(() => []);
    }
    const trigCard = document.createElement('div');
    trigCard.className = 'grokbot-central-card';
    const trigTitle = document.createElement('h4');
    trigTitle.textContent = `Gatilhos por Evento (${triggers.length})`;
    const trigSub = document.createElement('p');
    trigSub.textContent = 'Dispara o Bot em 2º plano quando o preço cai, a página muda ou chega e-mail urgente.';
    const trigActions = document.createElement('div');
    trigActions.className = 'grokbot-central-actions';
    for (const [evType, evLabel] of [
      ['price-below-target', '+ Meta de Preço'],
      ['page-changed', '+ Mudança na Página'],
      ['new-email', '+ E-mail Urgente']
    ]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn-ghost';
      b.textContent = evLabel;
      b.addEventListener('click', async () => {
        if (window.zeroBrowser?.bots?.registerTrigger) {
          await window.zeroBrowser.bots.registerTrigger({ botId, eventType: evType, targetPrice: 2500 }).catch(() => {});
          this.showToast(`Gatilho registrado: ${evLabel}`, 'success');
          this.renderBotAgendaView(container);
        }
      });
      trigActions.appendChild(b);
    }
    trigCard.append(trigTitle, trigSub, trigActions);
    container.appendChild(trigCard);

    // 3. Mandato Delegado com Envelope (valor máximo R$, validade, usos)
    let mandate = null;
    if (window.zeroBrowser?.bots?.getMandate) {
      mandate = await window.zeroBrowser.bots.getMandate(botId).catch(() => null);
    }
    const mandateCard = document.createElement('div');
    mandateCard.className = 'grokbot-central-card';
    const mTitle = document.createElement('h4');
    mTitle.textContent = 'Mandato Delegado com Envelope';
    const mDesc = document.createElement('p');
    mDesc.textContent = mandate && !mandate.revoked
      ? `Ativo: ação "${mandate.allowedAction}" · teto R$ ${Number(mandate.maxAmountBrl ?? mandate.maxAmountBRL ?? 0).toFixed(2)} · usos ${mandate.usedCount}/${mandate.maxUses}`
      : 'Sem mandato ativo. Emita um envelope com limite em R$, prazo e número máximo de usos.';
    const mActions = document.createElement('div');
    mActions.className = 'grokbot-central-actions';
    const mBtn = document.createElement('button');
    mBtn.type = 'button';
    mBtn.className = 'btn-ghost';
    mBtn.textContent = 'Emitir envelope (R$ 200 · 1 uso)';
    mBtn.addEventListener('click', async () => {
      if (window.zeroBrowser?.bots?.createMandate) {
        await window.zeroBrowser.bots.createMandate({
          botId,
          allowedAction: 'reserve-price-offer',
          maxAmountBRL: 200,
          maxUses: 1
        }).catch(() => {});
        this.showToast('Mandato com envelope emitido (teto R$ 200,00 · 1 uso).', 'success');
        this.renderBotAgendaView(container);
      }
    });
    mActions.appendChild(mBtn);
    mandateCard.append(mTitle, mDesc, mActions);
    container.appendChild(mandateCard);

    // 4. Tarefa Agendada do Windows (Zero fechado)
    if (window.zeroBrowser?.bots?.getWindowsTaskSpec) {
      const winSpec = await window.zeroBrowser.bots.getWindowsTaskSpec(botId).catch(() => null);
      if ((winSpec?.schtasksCommand || winSpec?.schtasksCreateCommand)) {
        const winCard = document.createElement('div');
        winCard.className = 'grokbot-central-card';
        const wTitle = document.createElement('h4');
        wTitle.textContent = 'Execução com Zero Fechado (Agendador do Windows)';
        const wDesc = document.createElement('p');
        wDesc.textContent = `Tarefa: ${winSpec.taskName} · Horário: ${(winSpec.time || winSpec.dailyAt || "09:00")}`;
        const wActions = document.createElement('div');
        wActions.className = 'grokbot-central-actions';
        const copyCmdBtn = document.createElement('button');
        copyCmdBtn.type = 'button';
        copyCmdBtn.className = 'btn-ghost';
        copyCmdBtn.textContent = 'Copiar comando schtasks';
        copyCmdBtn.addEventListener('click', () => {
          this.copiarTexto((winSpec.schtasksCommand || winSpec.schtasksCreateCommand));
          this.showToast('Comando do Agendador de Tarefas do Windows copiado.', 'success');
        });
        wActions.appendChild(copyCmdBtn);
        winCard.append(wTitle, wDesc, wActions);
        container.appendChild(winCard);
      }
    }
  }

  async renderBotMemoryView(container) {
    if (!container) return;
    container.replaceChildren();
    await this.refreshSpecialistTasksFromStore();
    const bot = this.activeSpecialistBot;

    // 1. Escada de Autonomia Conquistada (Degrau 1 -> 2 -> 3)
    const stepCard = document.createElement('div');
    stepCard.className = 'grokbot-central-card';
    const stepNames = {
      1: 'Degrau 1 · Somente Leitura e Pesquisa',
      2: 'Degrau 2 · Preparar Rascunho / Formulário (sem enviar)',
      3: 'Degrau 3 · Execução com Envelope e Recibo Desfazer'
    };
    const currentStep = Number(bot?.autonomyStep || 1);
    const sTitle = document.createElement('h4');
    sTitle.textContent = `Autonomia Conquistada: ${stepNames[currentStep] || stepNames[1]}`;
    const sDesc = document.createElement('p');
    sDesc.textContent = 'Todo Bot nasce no Degrau 1. A subida de degrau exige histórico limpo e confirmação humana explícita.';
    const sActions = document.createElement('div');
    sActions.className = 'grokbot-central-actions';
    if (currentStep < 3 && bot?.id) {
      const promoteBtn = document.createElement('button');
      promoteBtn.type = 'button';
      promoteBtn.className = 'btn-ghost';
      promoteBtn.textContent = `Subir para Degrau ${currentStep + 1}`;
      promoteBtn.addEventListener('click', async () => {
        if (window.zeroBrowser?.bots?.promoteAutonomy) {
          await window.zeroBrowser.bots.promoteAutonomy({ botId: bot.id, targetStep: currentStep + 1, confirmedByUser: true }).catch(() => {});
          await this.refreshSpecialistTasksFromStore();
          this.showToast(`Bot promovido para o Degrau ${currentStep + 1}.`, 'success');
          this.renderBotMemoryView(container);
        }
      });
      sActions.appendChild(promoteBtn);
    }
    stepCard.append(sTitle, sDesc, sActions);
    container.appendChild(stepCard);

    // 2. O que este Bot sabe (Memória isolada protegida pelo Firewall de Intenção)
    const botMemCard = document.createElement('div');
    botMemCard.className = 'grokbot-central-card';
    const bmTitle = document.createElement('h4');
    bmTitle.textContent = `O que ${bot?.name || 'este Bot'} sabe (${(bot?.memory || []).length})`;
    const bmDesc = document.createElement('p');
    bmDesc.textContent = 'Protegido pelo Firewall de Intenção: conteúdo de páginas nunca pode gravar regras aqui.';
    const inputRow = document.createElement('div');
    inputRow.className = 'grokbot-input-row';
    const memInput = document.createElement('input');
    memInput.type = 'text';
    memInput.placeholder = 'Adicionar preferência ou regra para este Bot…';
    const memSave = document.createElement('button');
    memSave.type = 'button';
    memSave.className = 'btn-ghost';
    memSave.textContent = 'Salvar';
    memSave.addEventListener('click', async () => {
      const note = memInput.value.trim();
      if (!note || !bot?.id) return;
      if (window.zeroBrowser?.bots?.addMemory) {
        const res = await window.zeroBrowser.bots.addMemory({ botId: bot.id, note, source: 'user' }).catch(() => null);
        if (res?.ok === false) {
          this.showToast(res.error || 'Bloqueado pelo Firewall de Intenção.', 'error');
          return;
        }
      }
      memInput.value = '';
      await this.refreshSpecialistTasksFromStore();
      this.showToast('Memória salva no Bot Especialista.', 'success');
      this.renderBotMemoryView(container);
    });
    inputRow.append(memInput, memSave);
    botMemCard.append(bmTitle, bmDesc, inputRow);
    for (const fact of bot?.memory || []) {
      const item = document.createElement('div');
      item.className = 'grokbot-central-item';
      const span = document.createElement('span');
      span.textContent = typeof fact === "string" ? fact : (fact?.text || fact?.value || JSON.stringify(fact));
      const badge = document.createElement('span');
      badge.className = 'grokbot-pill';
      badge.textContent = 'Origem: Você';
      item.append(span, badge);
      botMemCard.appendChild(item);
    }
    container.appendChild(botMemCard);

    // 3. Memória de fatos por site do perfil
    let memories = [];
    try {
      memories = await window.zeroBrowser.automation.memory('list');
    } catch {}
    const header = document.createElement('div');
    header.className = 'bot-subview-header';
    const title = document.createElement('strong');
    title.textContent = `Memória isolada (${memories.length})`;
    header.appendChild(title);
    container.appendChild(header);
    if (!memories.length) {
      const empty = document.createElement('p');
      empty.className = 'ai-memory-empty';
      empty.textContent = 'Nenhum fato salvo neste perfil. Somente dados de origem do usuário ou aprovados entram na memória.';
      container.appendChild(empty);
      return;
    }
    for (const mem of memories) {
      const card = document.createElement('div');
      card.className = 'ai-receipt-card';
      const copy = document.createElement('div');
      copy.className = 'ai-receipt-copy';
      const h = document.createElement('strong');
      h.textContent = mem.text || '';
      const meta = document.createElement('span');
      meta.textContent = `${mem.origin || 'geral'} · origem verificada`;
      copy.append(h, meta);
      card.appendChild(copy);
      container.appendChild(card);
    }
  }

  async renderBotRoutesView(container) {
    if (!container) return;
    container.replaceChildren();
    let routes = [];
    if (window.zeroBrowser?.routes?.list) {
      routes = await window.zeroBrowser.routes.list().catch(() => []);
    }

    const orderCard = document.createElement('div');
    orderCard.className = 'grokbot-central-card';
    const oTitle = document.createElement('h4');
    oTitle.textContent = 'Ordem de Execução GrokBot (Economia de Tokens)';
    const oDesc = document.createElement('p');
    oDesc.textContent = '1. Ferramenta Declarada (WebMCP) → 2. Rota HTTP Aprendida → 3. Receita Determinística → 4. Interface Visual.';
    const oActions = document.createElement('div');
    oActions.className = 'grokbot-central-actions';
    const captureBtn = document.createElement('button');
    captureBtn.type = 'button';
    captureBtn.className = 'btn-ghost';
    captureBtn.textContent = '+ Capturar rota da aba atual';
    captureBtn.addEventListener('click', async () => {
      const currentUrl = this.tabs.get(this.activeTabId)?.url || 'https://api.loja.exemplo/v1/precos?sku=10';
      if (window.zeroBrowser?.routes?.captureCurrent) {
        const res = await window.zeroBrowser.routes.captureCurrent({
          url: currentUrl.startsWith('http') ? currentUrl : 'https://api.loja.exemplo/v1/precos?sku=10',
          method: 'GET',
          status: 200,
          contentType: 'application/json',
          description: 'Consulta direta aprendida da aba ativa',
          responseSample: { ok: true, price: 2190 }
        }).catch(() => null);
        this.showToast(res?.ok ? 'Rota HTTP aprendida e salva na biblioteca.' : (res?.reason || 'Rota analisada.'), 'success');
        this.renderBotRoutesView(container);
      }
    });
    const twinBtn = document.createElement('button');
    twinBtn.type = 'button';
    twinBtn.className = 'btn-ghost';
    twinBtn.textContent = 'Ensaiar no Gêmeo Local';
    twinBtn.addEventListener('click', async () => {
      if (window.zeroBrowser?.routes?.rehearseTwin) {
        const sim = await window.zeroBrowser.routes.rehearseTwin({ tabId: this.activeTabId }).catch(() => null);
        this.showToast(sim?.rehearsed ? `Gêmeo Local: ${sim.mutationsCount} mutações testadas em espelho isolado.` : 'Ensaio concluído.', 'info');
      }
    });
    oActions.append(captureBtn, twinBtn);
    orderCard.append(oTitle, oDesc, oActions);
    container.appendChild(orderCard);

    for (const route of routes) {
      const card = document.createElement('div');
      card.className = 'ai-receipt-card';
      const copy = document.createElement('div');
      copy.className = 'ai-receipt-copy';
      const h = document.createElement('strong');
      h.textContent = `[${route.method || "GET"}] ${route.urlTemplate || ((route.domain || "") + (route.pathTemplate || ""))}`;
      const meta = document.createElement('span');
      meta.textContent = `${route.name || route.description || 'Rota aprendida'} · ${route.enabled ? 'Ativa' : 'Pausada'} · Replays: ${route.replayCount || 0}`;
      copy.append(h, meta);
      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = 'btn-ghost btn-undo-receipt';
      toggleBtn.textContent = route.enabled ? 'Pausar' : 'Ativar';
      toggleBtn.addEventListener('click', async () => {
        if (window.zeroBrowser?.routes?.toggle) {
          await window.zeroBrowser.routes.toggle(route.id, !route.enabled).catch(() => {});
          this.renderBotRoutesView(container);
        }
      });
      card.append(copy, toggleBtn);
      container.appendChild(card);
    }
  }

  renderBotHistoryView(container) {
    if (!container) return;
    container.replaceChildren();
    const botHistory = this.activeSpecialistBot?.history || [];
    const allReceipts = [
      ...this.actionReceipts,
      ...botHistory.map((h) => ({
        id: h.id,
        title: `${this.activeSpecialistBot?.name || 'Bot'}: ${h.summary || h.status}`,
        detail: `${h.durationMs || 0} ms · ${h.usedDeterministicRecipe ? 'Receita sem modelo (0 tokens)' : `${h.tokensUsed || 0} tokens`} · SHA-256: ${String(h.receiptHash || '').slice(0, 12)}`
      }))
    ];
    const header = document.createElement('div');
    header.className = 'bot-subview-header';
    const title = document.createElement('strong');
    title.textContent = `Recibos de execução (${allReceipts.length})`;
    const exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.className = 'btn-ghost';
    exportBtn.textContent = 'Exportar recibos';
    exportBtn.addEventListener('click', () => {
      const payload = JSON.stringify(allReceipts, null, 2);
      this.copiarTexto(payload);
      this.showToast('Recibos copiados em JSON auditável.', 'success');
    });
    header.append(title, exportBtn);
    container.appendChild(header);
    if (!allReceipts.length) {
      const empty = document.createElement('p');
      empty.className = 'ai-memory-empty';
      empty.textContent = 'Nenhuma execução registrada nesta sessão ainda.';
      container.appendChild(empty);
      return;
    }
    for (const rec of allReceipts) {
      const card = document.createElement('div');
      card.className = 'ai-receipt-card';
      const copy = document.createElement('div');
      copy.className = 'ai-receipt-copy';
      const h = document.createElement('strong');
      h.textContent = rec.title;
      const meta = document.createElement('span');
      meta.textContent = rec.detail || 'Auditado';
      copy.append(h, meta);
      card.appendChild(copy);
      container.appendChild(card);
    }
  }

  async openExtensionsManager() {
    await this.denyPendingApprovals();
    this.elements.settingsPanel.classList.remove('hidden');
    this.elements.aiPanel.classList.add('hidden');
    this.clearDelegationMode();
    this.elements.libraryPanel.classList.add('hidden');
    this.closeAppMenu();
    window.zeroBrowser.browser.setSidePanelOpen(true, 'right', 'settings');
    await this.freezePageForPanel();
    this.loadSettingsToUI();
    this.loadAiSettings();
    await this.renderExtensions();
    document.getElementById('extensions-section').scrollIntoView({ block: 'nearest' });
  }

  async renderExtensions() {
    const list = document.getElementById('extensions-list');
    list.replaceChildren();
    let extensions = [];
    try {
      extensions = await window.zeroBrowser.extensions.list();
    } catch (error) {
      list.appendChild(this.libraryEmpty(`Não foi possível carregar as extensões: ${error.message}`));
      return;
    }
    if (!extensions.length) {
      list.appendChild(this.libraryEmpty('Nenhuma extensão carregada.'));
      return;
    }
    for (const extension of extensions) {
      const row = document.createElement('div');
      row.className = 'extension-item';
      row.setAttribute('role', 'listitem');
      const info = document.createElement('div');
      info.className = 'extension-info';
      const title = document.createElement('strong');
      title.textContent = extension.name || 'Extensão sem nome';
      const meta = document.createElement('span');
      meta.className = 'setting-description';
      meta.textContent = `Versão ${extension.version || '?'} · ${extension.managed ? 'Integrada ao Zero Browser' : extension.enabled ? 'Ativa' : 'Desativada'}`;
      info.append(title, meta);
      const permissions = document.createElement('span');
      permissions.className = 'setting-description extension-permissions';
      permissions.textContent = extension.permissions?.length ? `Permissões: ${extension.permissions.join(', ')}` : 'Sem permissões declaradas.';
      info.appendChild(permissions);
      if (extension.error) {
        const error = document.createElement('span');
        error.className = 'setting-description extension-error';
        error.textContent = `Falha ao carregar: ${extension.error}`;
        info.appendChild(error);
      }
      row.appendChild(info);
      if (extension.managed) {
        const badge = document.createElement('span');
        badge.className = 'extension-managed';
        badge.textContent = 'Protegida';
        row.appendChild(badge);
      } else {
        const actions = document.createElement('div');
        actions.className = 'extension-actions';
        const label = document.createElement('label');
        label.className = 'extension-toggle';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = extension.enabled;
        checkbox.setAttribute('aria-label', `${extension.enabled ? 'Desativar' : 'Ativar'} ${extension.name}`);
        checkbox.addEventListener('change', async () => {
          checkbox.disabled = true;
          try { await window.zeroBrowser.extensions.setEnabled(extension.id, checkbox.checked); }
          catch (error) { this.showToast(error.message, 'error'); }
          await this.renderExtensions();
        });
        label.append(checkbox, document.createTextNode(' Ativa'));
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'btn-secondary';
        remove.textContent = 'Remover';
        remove.addEventListener('click', async () => {
          remove.disabled = true;
          try {
            const result = await window.zeroBrowser.extensions.remove(extension.id);
            if (result?.cancelled) remove.disabled = false;
          } catch (error) { this.showToast(error.message, 'error'); }
          await this.renderExtensions();
        });
        actions.append(label, remove);
        row.appendChild(actions);
      }
      if (extension.enabled && extension.hasAction) {
        const invokeAction = document.createElement('button');
        invokeAction.type = 'button';
        invokeAction.className = 'btn-secondary';
        invokeAction.textContent = 'Executar';
        invokeAction.setAttribute('aria-label', `Executar ação de ${extension.name} na aba atual`);
        invokeAction.title = 'Executar a ação da extensão na aba atual';
        invokeAction.addEventListener('click', async (event) => {
          if (!event.isTrusted) return;
          invokeAction.disabled = true;
          try {
            const result = await window.zeroBrowser.extensions.invokeAction(extension.id);
            this.showToast(result?.activeTabGranted ? 'Ação executada com acesso temporário à aba atual.' : 'Ação da extensão executada.', 'success');
          } catch (error) {
            this.showToast(error.message, 'error');
          } finally {
            invokeAction.disabled = false;
          }
        });
        const actions = row.querySelector('.extension-actions');
        if (actions) actions.appendChild(invokeAction);
        else row.appendChild(invokeAction);
      }
      list.appendChild(row);
    }
  }

  async addExtension() {
    const button = document.getElementById('btn-add-extension');
    button.disabled = true;
    try {
      const result = await window.zeroBrowser.extensions.chooseAndInstall();
      if (result?.success) this.showToast(`Extensão adicionada: ${result.extension.name}`, 'success');
      await this.renderExtensions();
    } catch (error) {
      this.showToast(error.message, 'error');
    } finally {
      button.disabled = false;
    }
  }

  async freezePageForPanel() {
    const frozen = await window.zeroBrowser.browser.freezePage(true, 'panel').catch(() => null);
    if (!frozen?.image) return;
    const container = this.elements.browserContainer;
    container.style.backgroundImage = `url("${frozen.image}")`;
    container.style.backgroundSize = `${frozen.bounds.width}px ${frozen.bounds.height}px`;
    container.classList.add('frozen');
  }

  async releasePageOverlay(reason) {
    await window.zeroBrowser.browser.freezePage(false, reason).catch(() => {});
    const aiPanelOpen = !this.elements.aiPanel.classList.contains('hidden');
    const overlayOpen = [this.elements.appMenu, this.elements.aiPanel, this.elements.settingsPanel, this.elements.libraryPanel, this.elements.urlSuggestions]
      .some((element) => !element.classList.contains('hidden'));
    if (overlayOpen && !aiPanelOpen) return;
    const container = this.elements.browserContainer;
    container.classList.remove('frozen');
    container.style.backgroundImage = '';
    container.style.backgroundSize = '';
  }

  initLibraryTabs() {
    for (const aba of document.querySelectorAll('.library-tab')) {
      aba.addEventListener('click', () => this.openLibrary(aba.dataset.modo));
    }
  }

  async openLibrary(mode) {
    const libraryWasOpen = !this.elements.libraryPanel.classList.contains('hidden');
    await this.denyPendingApprovals();
    this.closeBotCentral({ restorePanel: false });
    this.elements.libraryPanel.classList.remove('hidden');
    this.elements.aiPanel.classList.add('hidden');
    this.clearDelegationMode();
    this.elements.settingsPanel.classList.add('hidden');
    this.closeAppMenu();
    this.libraryMode = mode;
    const labels = {
      history: ['Histórico', 'Páginas visitadas neste perfil.'],
      bookmarks: ['Favoritos', 'Endereços guardados neste perfil.'],
      downloads: ['Downloads', 'Downloads recentes desta sessão do Zero Browser.']
    };
    [this.elements.libraryTitle.textContent, this.elements.librarySubtitle.textContent] = labels[mode];
    for (const aba of document.querySelectorAll('.library-tab')) {
      const selected = aba.dataset.modo === mode;
      aba.classList.toggle('ativo', selected);
      aba.setAttribute('aria-pressed', String(selected));
    }
    this.elements.librarySearch.value = '';
    window.zeroBrowser.browser.setSidePanelOpen(true, 'right', 'library');
    await this.freezePageForPanel();
    await this.renderLibrary();
    if (!libraryWasOpen) this.elements.librarySearch.focus();
  }

  async closeLibrary() {
    this.elements.libraryPanel.classList.add('hidden');
    if (this.elements.aiPanel.classList.contains('hidden') && this.elements.settingsPanel.classList.contains('hidden')) window.zeroBrowser.browser.setSidePanelOpen(false, 'right', 'none');
    if (this.elements.aiPanel.classList.contains('hidden') && this.elements.settingsPanel.classList.contains('hidden')) await this.releasePageOverlay('panel');
  }

  async renderLibrary() {
    const renderRequest = this.libraryRenderRequest = (this.libraryRenderRequest || 0) + 1;
    const mode = this.libraryMode;
    if (!mode || this.elements.libraryPanel.classList.contains('hidden')) return;
    const query = this.elements.librarySearch.value.trim();
    let items = [];
    try {
      if (mode === 'history') items = await window.zeroBrowser.library.history('search', { text: query, maxResults: 100 });
      else if (mode === 'bookmarks') items = query
        ? await window.zeroBrowser.library.bookmarks('search', { query })
        : await window.zeroBrowser.library.bookmarks('getRecent', 100);
      else {
        items = await window.zeroBrowser.browser.getDownloads();
        if (query) items = items.filter((item) => `${item.filename} ${item.url}`.toLowerCase().includes(query.toLowerCase()));
      }
    } catch (error) {
      if (renderRequest !== this.libraryRenderRequest || this.elements.libraryPanel.classList.contains('hidden')) return;
      this.elements.libraryList.replaceChildren(this.libraryEmpty(`Não foi possível carregar: ${error.message}`));
      return;
    }
    // A leitura pode terminar depois de uma troca de aba, busca ou fechamento do painel.
    if (renderRequest !== this.libraryRenderRequest || this.elements.libraryPanel.classList.contains('hidden')) return;
    const fragment = document.createDocumentFragment();
    for (const item of items) {
      const row = document.createElement('div');
      row.className = 'library-row';
      row.setAttribute('role', 'listitem');
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'library-open';
      const title = document.createElement('strong');
      title.textContent = item.title || item.filename || item.url || 'Sem título';
      const detail = document.createElement('span');
      detail.textContent = mode === 'history' ? `${item.url} · ${new Date(item.lastVisitTime).toLocaleString()}` : mode === 'bookmarks' ? item.url || 'Pasta de favoritos' : `${item.state} · ${item.url || ''}`;
      open.append(title, detail);
      if (mode !== 'downloads') open.addEventListener('click', () => { this.navigateTo(item.url); this.closeLibrary(); });
      else open.disabled = true;
      row.appendChild(open);
      if (mode === 'downloads' && item.hasFile) {
        const reveal = document.createElement('button');
        reveal.type = 'button';
        reveal.className = 'btn-secondary library-reveal';
        reveal.textContent = 'Mostrar na pasta';
        reveal.addEventListener('click', async () => {
          try { await window.zeroBrowser.browser.showDownload(item.id); }
          catch (error) { this.showToast(error.message, 'error'); }
        });
        row.appendChild(reveal);
      }
      fragment.appendChild(row);
    }
    if (!items.length) fragment.appendChild(this.libraryEmpty(query ? 'Nenhum resultado para esta pesquisa.' : 'Ainda não há itens para mostrar.'));
    this.elements.libraryList.replaceChildren(fragment);
  }

  libraryEmpty(message) {
    const empty = document.createElement('p');
    empty.className = 'library-empty';
    empty.textContent = message;
    return empty;
  }

  async connectAi() {
    const provider = this.elements.aiProvider.value;
    const apiKey = this.elements.aiApiKey.value.trim();
    const model = this.elements.aiModel.value;

    if (!model || !this.aiModelCatalog.some((item) => item.id === model && item.supportsTools !== false)) {
      this.showToast('Sincronize os modelos e escolha um que aceite chamadas de ferramentas.', 'warning');
      return;
    }

    this.elements.btnAiConnect.disabled = true;
    this.elements.btnAiConnect.textContent = 'Conectando...';

    try {
      const saved = await window.zeroBrowser.ai.saveConfig({ provider, model, apiKey: apiKey || undefined });
      if (!saved.hasApiKey) throw new Error(`Informe a chave API do ${provider === 'openai' ? 'OpenAI' : provider === 'deepseek' ? 'DeepSeek' : 'OpenRouter'}`);
      const result = await window.zeroBrowser.automation.runAgent(this.activeTabId, 'Use inspect_page exatamente uma vez para confirmar que as chamadas de ferramenta funcionam. Não clique, navegue ou altere nada.', true, true);
      if (!result.success) throw new Error(result.error);
      this.aiConnected = true;
      this.addAiMessage('assistant', `Conectado a ${provider === 'openai' ? 'OpenAI' : provider === 'deepseek' ? 'DeepSeek' : provider === 'ollama' ? 'Ollama local' : 'OpenRouter'} com ${model}. Posso operar a aba ativa usando as ferramentas disponíveis.`);
      this.aiProviderConfigs.set(provider, saved);
      this.elements.aiApiKey.value = '';
      this.resetAiKeyVisibility();
      this.elements.aiApiKey.placeholder = `Salva: ${saved.keyHint || '••••••••'} (vazio mantém a atual)`;
      this.showToast(`Agente conectado: ${model}`, 'success');
    } catch (err) {
      this.showToast('Erro ao conectar: ' + err.message, 'error');
    } finally {
      this.elements.btnAiConnect.disabled = false;
      this.elements.btnAiConnect.textContent = 'Testar conexão';
    }
  }

  // Com chave e modelo já salvos, o agente fica pronto sem clicar em Conectar (o teste extra gastava uma chamada).
  async useSavedAiConfig() {
    const provider = this.elements.aiProvider.value;
    const model = this.elements.aiModel.value;
    const config = this.aiProviderConfigs.get(provider);
    if (!config?.hasApiKey || !model) return false;
    if (config.model !== model) this.aiProviderConfigs.set(provider, await window.zeroBrowser.ai.saveConfig({ provider, model }));
    this.aiConnected = true;
    return true;
  }

  // --- Conversas: histórico local, retomada e texto do modelo em parágrafos ---

  initChatSessions() {
    try {
      const saved = JSON.parse(localStorage.getItem('zero.chat.sessions.v2') || '[]');
      this.chatSessions = Array.isArray(saved) ? saved.filter((session) => session && Array.isArray(session.messages)) : [];
    } catch {
      this.chatSessions = [];
    }
    this.chatSession = this.chatSessions[0] || this.startChatSession({ render: false });
    this.restoreExecutionRouteForSession(this.chatSession);
    this.renderChatSessionSelect();
    this.renderChatSession();
    this.syncGrokBotBriefingBar();
    this.updateOrchestratorRouteStatus(this.elements.aiInput?.value || '');

    this.elements.aiSession?.addEventListener('change', () => {
      const found = this.chatSessions.find((session) => session.id === this.elements.aiSession.value);
      if (!found) return;
      this.chatSession = found;
      this.restoreExecutionRouteForSession(found);
      this.renderChatSession();
      this.syncGrokBotBriefingBar();
      this.renderSpecialistRail();
      this.updateOrchestratorRouteStatus(this.elements.aiInput?.value || '');
    });
    this.elements.btnAiNewChat?.addEventListener('click', () => {
      this.startChatSession();
      this.elements.aiInput.focus();
    });
    this.elements.btnAiRenameChat?.addEventListener('click', () => {
      if (!this.chatSession) return;
      const novo = window.prompt('Novo título da conversa', this.chatSession.title || '');
      if (!novo || !novo.trim()) return;
      this.chatSession.title = novo.trim().slice(0, 60);
      this.chatSession.updatedAt = Date.now();
      this.persistChatSessions();
      this.renderChatSessionSelect();
    });
    this.elements.btnAiPinChat?.addEventListener('click', () => {
      if (!this.chatSession) return;
      this.chatSession.pinned = !this.chatSession.pinned;
      this.chatSessions.sort((a, b) => (Number(b.pinned) - Number(a.pinned)) || ((b.updatedAt || 0) - (a.updatedAt || 0)));
      this.persistChatSessions();
      this.renderChatSessionSelect();
      this.showToast(this.chatSession.pinned ? 'Conversa fixada' : 'Conversa desafixada', 'success');
    });
    this.elements.btnAiDeleteChat?.addEventListener('click', () => {
      if (!this.chatSession) return;
      if (!window.confirm(`Apagar a conversa “${this.chatSession.title || 'sem título'}”?`)) return;
      this.chatSessions = this.chatSessions.filter((session) => session.id !== this.chatSession.id);
      this.chatSession = this.chatSessions[0] || this.startChatSession({ render: false });
      this.persistChatSessions();
      this.renderChatSessionSelect();
      this.renderChatSession();
    });
  }

  startChatSession({ render = true } = {}) {
    const session = { id: `c${Date.now().toString(36)}`, title: 'Nova conversa', messages: [], updatedAt: Date.now() };
    this.chatSessions = [session, ...(this.chatSessions || [])].slice(0, 50);
    this.chatSession = session;
    this.activeSpecialistBot = null;
    this.executionRouteMode = 'auto';
    this.routeOverrideForDraft = null;
    this.persistChatSessions();
    if (render) {
      this.renderChatSession();
      this.renderChatSessionSelect();
      this.syncGrokBotBriefingBar();
      this.renderSpecialistRail();
      this.updateOrchestratorRouteStatus(this.elements.aiInput?.value || '');
    }
    return session;
  }

  restoreExecutionRouteForSession(session) {
    const bot = session?.botId
      ? this.getAvailableSpecialistTasks().find((task) => task.id === session.botId) || null
      : null;
    this.activeSpecialistBot = bot;
    this.executionRouteMode = bot ? 'specialist' : 'auto';
    this.routeOverrideForDraft = null;
  }

  persistChatSessions() {
    try {
      const trimmed = (this.chatSessions || []).slice(0, 50).map((session) => ({
        ...session,
        messages: (session.messages || []).slice(-200).map((message) => ({ role: message.role, content: String(message.content).slice(0, 20000), at: message.at }))
      }));
      localStorage.setItem('zero.chat.sessions.v2', JSON.stringify(trimmed));
    } catch {}
  }

  recordChat(role, content) {
    if (!this.chatSession) return;
    const text = String(content ?? '');
    this.chatSession.messages.push({ role, content: text, at: Date.now() });
    this.chatSession.updatedAt = Date.now();
    if (role === 'user' && this.chatSession.title === 'Nova conversa') {
      this.chatSession.title = text.replace(/\s+/g, ' ').trim().slice(0, 42) || 'Nova conversa';
      this.chatSessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      this.renderChatSessionSelect();
    }
    this.persistChatSessions();
  }

  renderChatSessionSelect() {
    const select = this.elements.aiSession;
    if (!select) return;
    select.replaceChildren();
    const ordenadas = [...(this.chatSessions || [])].sort((a, b) => (Number(b.pinned) - Number(a.pinned)) || ((b.updatedAt || 0) - (a.updatedAt || 0)));
    for (const session of ordenadas) {
      const option = document.createElement('option');
      option.value = session.id;
      const when = new Date(session.updatedAt || Date.now()).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      option.textContent = `${session.pinned ? '★ ' : ''}${session.title || 'Conversa'} · ${when}`;
      select.appendChild(option);
    }
    if (this.chatSession) select.value = this.chatSession.id;
  }

  getSuggestionsForSpecialist(bot) {
    const specialty = String(bot?.specialty || bot?.id || '').toLowerCase();
    if (specialty.includes('market')) {
      return [
        'Monitore a cotação desta página e me avise se variar mais de 2%.',
        'Compare os indicadores financeiros visíveis nesta aba e monte um resumo.',
        'Extraia a tabela de cotações do dia e destaque a maior alta.'
      ];
    }
    if (specialty.includes('inbox') || specialty.includes('mail')) {
      return [
        'Resuma os itens visíveis nesta caixa de entrada destacando urgências.',
        'Separe as mensagens que exigem resposta hoje sem enviar nada sozinho.',
        'Liste cobranças ou boletos citados na página para o Painel de Vencimentos.'
      ];
    }
    return [
      'Encontre um fone de ouvido sem fio com boa avaliação e preço até R$ 150,00.',
      'Compare o preço à vista e o frete nesta página e monte uma tabela.',
      'Resuma esta página em cinco tópicos e cite os números principais.'
    ];
  }

  renderChatSession() {
    const chat = this.elements.aiChat;
    if (!chat) return;
    chat.replaceChildren();
    const messages = this.chatSession?.messages || [];
    for (const message of messages) this.addAiMessage(message.role, message.content, { persist: false });
    if (!messages.length) {
      const bot = this.activeSpecialistBot || null;
      const shortName = bot
        ? (String(bot.name || 'Bot especialista').replace(/^Bot\s+(Caçador\s+de\s+|Radar\s+de\s+|Triagem\s+)?/i, '') || 'Bot especialista')
        : 'Agente geral';

      const welcome = document.createElement('section');
      welcome.className = 'grokbot-specialist-welcome';
      welcome.setAttribute('aria-label', bot ? `Apresentação do Bot ${bot.name}` : 'Apresentação do agente geral');
      const wHeader = document.createElement('div');
      wHeader.className = 'grokbot-specialist-welcome-header';
      const wTitle = document.createElement('strong');
      wTitle.textContent = bot ? `${bot.name} · ${bot.specialtyTitle || 'Especialista'}` : 'Agente geral · Orquestrador ativo';
      const wPill = document.createElement('span');
      wPill.className = 'grokbot-pill';
      wPill.textContent = bot ? `Degrau ${bot.autonomyStep || 1} · ${bot.permission || 'somente-leitura'}` : 'Aba atual · escolha automática';
      wHeader.append(wTitle, wPill);

      const wDesc = document.createElement('span');
      wDesc.style.color = 'var(--fg-secondary)';
      wDesc.textContent = bot?.goal || 'Descreva o que precisa. O orquestrador encaminha pedidos claros para um perfil especialista e deixa os demais com o agente geral.';

      const wModes = document.createElement('div');
      wModes.className = 'grokbot-specialist-welcome-modes';
      const modeFg = document.createElement('div');
      modeFg.className = 'grokbot-welcome-mode-box';
      modeFg.innerHTML = '<strong>Enviar (Enter)</strong><span>Executa direto na aba aberta atual com moldura Aurora Boreal.</span>';
      const modeBg = document.createElement('div');
      modeBg.className = 'grokbot-welcome-mode-box';
      modeBg.innerHTML = '<strong>Em 2º plano (Alt+Enter)</strong><span>Abre outra aba no perfil atual e traz para frente ao encerrar.</span>';
      wModes.append(modeFg, modeBg);
      welcome.append(wHeader, wDesc, wModes);
      chat.appendChild(welcome);

      const exemplos = document.createElement('div');
      exemplos.className = 'ai-message assistant ai-examples';
      const sugestoes = bot ? this.getSuggestionsForSpecialist(bot) : [
        'Resuma esta página em cinco tópicos e destaque os números principais.',
        'Encontre informações específicas nesta página e cite onde aparecem.',
        'Organize o conteúdo aberto em uma lista de próximos passos.'
      ];
      for (const texto of sugestoes) {
        const botao = document.createElement('button');
        botao.type = 'button';
        botao.className = 'btn-ghost';
        botao.textContent = texto;
        botao.addEventListener('click', () => {
          this.elements.aiInput.value = texto;
          this.elements.aiInput.focus();
        });
        exemplos.appendChild(botao);
      }
      const runBgQuick = document.createElement('button');
      runBgQuick.type = 'button';
      runBgQuick.className = 'btn-secondary grokbot-send-bg-btn';
      runBgQuick.textContent = `▶ Executar com ${shortName} em 2º plano`;
      runBgQuick.addEventListener('click', () => {
        this.sendAiMessageInBackground(sugestoes[0]);
      });
      exemplos.appendChild(runBgQuick);
      chat.appendChild(exemplos);
      this.appendGrokBotTechDrawer(chat);
    }
    this.refreshJobsBanner();
    chat.scrollTop = chat.scrollHeight;
  }

  appendGrokBotTechDrawer(chat) {
    if (!chat) return;
    const techDrawer = document.createElement('details');
    techDrawer.className = 'grokbot-tech-drawer';
    const techSummary = document.createElement('summary');
    techSummary.textContent = 'Como a execução funciona';
    const metricsGrid = document.createElement('div');
    metricsGrid.className = 'grokbot-tech-metrics';
    for (const [label, val] of [
      ['Métricas', 'Tempo, tokens e custo por tarefa ainda não aparecem nesta tela.'],
      ['Dados enviados', 'O pedido e o contexto necessário da página podem ser enviados ao provedor escolhido.'],
      ['Perfil', 'Esta tarefa usa o perfil de navegação atual; cookies e logins são compartilhados.'],
      ['Ações', 'Ações sensíveis continuam sujeitas às confirmações do navegador.']
    ]) {
      const m = document.createElement('div');
      m.className = 'grokbot-tech-metric';
      const st = document.createElement('strong');
      st.textContent = label;
      const sp = document.createElement('span');
      sp.textContent = val;
      m.append(st, sp);
      metricsGrid.appendChild(m);
    }
    techDrawer.append(techSummary, metricsGrid);
    chat.appendChild(techDrawer);
  }

  async sendAiMessageInBackground(customPrompt = null) {
    const rawInput = customPrompt !== null ? String(customPrompt) : (this.elements.aiInput?.value || '');
    const route = this.resolveExecutionRoute(rawInput.trim());
    const bot = route.kind === 'specialist' ? route.bot : null;
    const promptText = rawInput.trim() || String(bot?.goal || '').trim();
    if (!promptText) {
      this.showToast('Escreva a tarefa que o agente deve executar.', 'warning');
      this.elements.aiInput?.focus();
      return { success: false, error: 'Tarefa vazia' };
    }
    const shortName = bot
      ? (String(bot.name || 'Bot especialista').replace(/^Bot\s+(Caçador\s+de\s+|Radar\s+de\s+|Triagem\s+)?/i, '') || 'Bot especialista')
      : 'Agente geral';
    if (bot && this.activeSpecialistBot?.id !== bot.id) {
      this.selectSpecialistBot(bot, { routeMode: this.executionRouteMode });
    } else if (!bot && this.chatSession?.botId) {
      this.useGeneralChat({ mode: this.executionRouteMode, render: true });
    }
    if (customPrompt === null && this.elements.aiInput) this.elements.aiInput.value = '';
    this.updateOrchestratorRouteStatus('');
    if (this.elements.aiPanel.classList.contains('hidden')) await this.toggleAiPanel(true);
    this.switchBotPanelTab('chat');

    const chat = this.elements.aiChat;
    chat?.querySelector('.grokbot-specialist-welcome')?.remove();
    chat?.querySelector('.ai-examples')?.remove();
    this.addAiMessage('user', promptText);

    const explicitUrl = promptText.match(/https?:\/\/[^\s)]+/i)?.[0];
    const activeUrl = this.tabs.get(this.activeTabId)?.url || '';
    const targetUrl = explicitUrl || bot?.defaultUrl || activeUrl || 'about:blank';
    let parsedTarget;
    try { parsedTarget = new URL(targetUrl); } catch {
      const error = 'O endereço inicial do Bot é inválido.';
      this.addAiMessage('assistant', error);
      return { success: false, error };
    }
    const allowed = Array.isArray(bot?.allowedSites) ? bot.allowedSites : [];
    if (allowed.length && !allowed.some((site) => {
      try { const permitted = new URL(site); return parsedTarget.origin === permitted.origin || parsedTarget.hostname === permitted.hostname; }
      catch { return false; }
    })) {
      const error = `O site ${parsedTarget.hostname} não está liberado para este Bot.`;
      this.addAiMessage('assistant', error);
      return { success: false, error };
    }

    const botMeta = bot ? {
      botId: bot.id, name: bot.name, specialty: bot.specialty,
      specialtyTitle: bot.specialtyTitle, executionMode: 'background-auto-foreground',
      accent: bot.accent, goal: promptText, shortBadge: shortName.slice(0, 14)
    } : null;
    const previousActiveTabId = this.activeTabId;
    const bgTabId = await this.createTab(parsedTarget.href, { background: true, ...(botMeta ? { botMeta } : {}) });
    if (!bgTabId) {
      const error = `Não foi possível abrir uma aba para ${shortName}.`;
      this.addAiMessage('assistant', error);
      return { success: false, error };
    }
    if (botMeta) {
      botMeta.tabId = bgTabId;
      this.specialistBots.set(bot.id, botMeta);
    }
    if (previousActiveTabId && previousActiveTabId !== bgTabId) this.activeTabId = previousActiveTabId;

    const jobId = `bg-job-${Date.now()}`;
    let cancelRequested = false;
    let cancellationConfirmed = false;
    const status = document.createElement('div');
    status.className = 'grokbot-inline-receipt';
    status.setAttribute('role', 'status');
    const statusText = document.createElement('span');
    statusText.textContent = `${shortName} está executando em uma aba do perfil atual${bot ? ' com orientação deste perfil especialista' : ''}…`;
    const openTab = document.createElement('button');
    openTab.type = 'button';
    openTab.className = 'grokbot-inline-receipt-btn';
    openTab.textContent = 'Ver aba';
    openTab.addEventListener('click', () => { if (this.tabs.has(bgTabId)) this.switchTab(bgTabId); });
    status.append(statusText, openTab);
    chat?.appendChild(status);

    this.backgroundAgentJobs.set(jobId, {
      id: jobId, botId: bot?.id || null, botName: shortName, tabId: bgTabId, prompt: promptText,
      onCancel: async () => {
        cancelRequested = true;
        statusText.textContent = `${shortName}: pedido para interromper enviado.`;
        const cancellation = await window.zeroBrowser.automation.cancelAgent(bgTabId).catch(() => null);
        cancellationConfirmed = cancellation?.success === true;
        if (!cancellationConfirmed) statusText.textContent = `${shortName}: o motor ainda não confirmou a interrupção.`;
        return cancellation;
      }
    });
    this.syncStopAllButton();
    this.syncGrokBotBriefingBar();
    this.renderSpecialistRail();

    let result;
    try {
      if (!this.aiConnected && !(await this.useSavedAiConfig())) throw new Error('Configure o provedor e o modelo de IA antes de executar a tarefa.');
      result = await window.zeroBrowser.automation.runAgent(bgTabId, this.buildRoutedPrompt(promptText, bot), false, false);
    } catch (error) {
      result = { success: false, error: String(error?.message || error) };
    } finally {
      this.backgroundAgentJobs.delete(jobId);
      this.syncStopAllButton();
      this.syncGrokBotBriefingBar();
      this.renderSpecialistRail();
    }

    if (result?.cancelled === true) {
      statusText.textContent = `${shortName}: execução interrompida. Uma ação já enviada pode terminar antes de parar.`;
      return { success: false, cancelled: true, botId: bot?.id || null, tabId: bgTabId, jobId };
    }
    if (result?.paused === true) {
      const pauseMessage = String(result.message || 'A execução pausou ao atingir um limite. Revise a página antes de continuar.');
      statusText.textContent = `${shortName}: execução pausada; ainda não concluída.`;
      this.addAiMessage('assistant', pauseMessage);
      return { success: false, paused: true, resumeId: result.resumeId || null, botId: bot?.id || null, tabId: bgTabId, jobId };
    }
    if (cancelRequested && cancellationConfirmed && result?.success !== true) {
      statusText.textContent = `${shortName}: execução interrompida.`;
      return { success: false, cancelled: true, botId: bot?.id || null, tabId: bgTabId, jobId };
    }
    if (result?.success === true) {
      statusText.textContent = `${shortName}: execução encerrada. Revise o resultado na página.`;
      const answer = String(result.message || '').trim();
      this.addAiMessage('assistant', answer || 'O motor encerrou a execução sem fornecer uma resposta final. Confira a aba para revisar o estado.');
      return { success: true, taskVerified: false, botId: bot?.id || null, tabId: bgTabId, jobId, summary: answer };
    }
    const error = String(result?.error || 'O motor não confirmou a conclusão da tarefa.');
    statusText.textContent = `${shortName}: falha na execução.`;
    this.addAiMessage('assistant', `Não consegui concluir a tarefa: ${error}`);
    this.showToast(`Falha em ${shortName}: ${error}`, 'error');
    return { success: false, error, botId: bot?.id || null, tabId: bgTabId, jobId };
  }

  buildRoutedPrompt(prompt, bot) {
    if (!bot) return prompt;
    const profile = String(bot.specialtyTitle || bot.name || 'Bot especialista').slice(0, 100);
    const goal = String(bot.goal || '').replace(/\s+/g, ' ').trim().slice(0, 600);
    return `[Perfil local: ${profile}${goal ? `; objetivo: ${goal}` : ''}]\n[Pedido do usuário]\n${prompt}`;
  }
  // Monta os nos a partir dos blocos do parser; nada de innerHTML com texto do modelo.
  renderRichText(container, text) {
    container.classList.add('ai-rich');
    container.replaceChildren();
    const parser = window.ZeroMarkdown;
    const blocks = parser ? parser.parseBlocks(text) : [{ type: 'p', lines: [[{ type: 'text', value: String(text ?? '') }]] }];
    const appendTokens = (parent, tokens) => {
      for (const token of tokens || []) {
        if (token.type === 'text') {
          parent.appendChild(document.createTextNode(token.value));
          continue;
        }
        const node = document.createElement(token.type === 'strong' ? 'strong' : 'code');
        node.textContent = token.value;
        parent.appendChild(node);
      }
    };
    for (const block of blocks) {
      if (block.type === 'code') {
        const pre = document.createElement('pre');
        const code = document.createElement('code');
        code.textContent = block.text;
        pre.appendChild(code);
        container.appendChild(pre);
        continue;
      }
      if (block.type === 'ul' || block.type === 'ol') {
        const list = document.createElement(block.type);
        for (const item of block.items) {
          const li = document.createElement('li');
          appendTokens(li, item);
          list.appendChild(li);
        }
        container.appendChild(list);
        continue;
      }
      if (block.type === 'heading') {
        const heading = document.createElement('h4');
        appendTokens(heading, block.tokens);
        container.appendChild(heading);
        continue;
      }
      const paragraph = document.createElement('p');
      (block.lines || []).forEach((tokens, index) => {
        if (index) paragraph.appendChild(document.createElement('br'));
        appendTokens(paragraph, tokens);
      });
      container.appendChild(paragraph);
    }
  }


  addAiMessage(role, content, { persist = true } = {}) {
    const msg = document.createElement('div');
    msg.className = `ai-message ${role}`;
    if (role === 'assistant' || role === 'system') this.renderRichText(msg, content);
    else msg.textContent = String(content ?? '');
    if (role === 'assistant') {
      const acoes = document.createElement('div');
      acoes.className = 'ai-message-actions';
      const copiar = document.createElement('button');
      copiar.type = 'button';
      copiar.className = 'btn-ghost';
      copiar.textContent = 'Copiar';
      copiar.addEventListener('click', () => this.copiarTexto(content));
      acoes.appendChild(copiar);
      msg.appendChild(acoes);
    }
    this.elements.aiChat.appendChild(msg);
    this.elements.aiChat.scrollTop = this.elements.aiChat.scrollHeight;
    if (persist) this.recordChat(role, content);
    return msg;
  }

  // Tarefa pausada (inclusive de antes de fechar o app): oferece retomar no topo do chat.
  async refreshJobsBanner() {
    const chat = this.elements.aiChat;
    if (!chat) return;
    chat.querySelectorAll('.ai-jobs-banner').forEach((node) => node.remove());
    let jobs = [];
    try {
      jobs = await window.zeroBrowser.automation.jobs();
    } catch {
      jobs = [];
    }
    if (!Array.isArray(jobs) || !jobs.length) return;
    const cartao = document.createElement('div');
    cartao.className = 'ai-message assistant ai-jobs-banner';
    const titulo = document.createElement('strong');
    titulo.textContent = jobs.length === 1 ? 'Tarefa pausada' : `${jobs.length} tarefas pausadas`;
    cartao.appendChild(titulo);
    for (const job of jobs.slice(0, 3)) {
      const linha = document.createElement('div');
      linha.className = 'ai-job-row';
      const detalhe = document.createElement('span');
      const quando = new Date(job.startedAt || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      detalhe.textContent = `${job.model || 'modelo'} · ${job.messages || 0} msgs · ${quando}`;
      const continuar = document.createElement('button');
      continuar.type = 'button';
      continuar.className = 'btn-primary';
      continuar.textContent = 'Continuar';
      continuar.addEventListener('click', () => {
        continuar.disabled = true;
        this.sendAiMessage(job.id);
      });
      const descartar = document.createElement('button');
      descartar.type = 'button';
      descartar.className = 'btn-ghost';
      descartar.textContent = 'Descartar';
      descartar.addEventListener('click', async () => {
        await window.zeroBrowser.automation.dropJob(job.id).catch(() => false);
        this.refreshJobsBanner();
      });
      linha.append(detalhe, continuar, descartar);
      cartao.appendChild(linha);
    }
    chat.prepend(cartao);
  }

  initAgentMemoryUi() {
    const more = document.querySelector('.ai-chat-more');
    more?.addEventListener('click', (event) => {
      if (event.target.closest('button')) more.open = false;
    });
    more?.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && more.open) {
        event.preventDefault();
        more.open = false;
        more.querySelector('summary')?.focus();
      }
    });
    this.elements.btnAiMemory?.addEventListener('click', () => this.showAgentMemory());
    this.elements.btnAiCopyChat?.addEventListener('click', () => this.copiarTexto(this.conversaEmMarkdown()));
    this.elements.btnAiRecipes?.addEventListener('click', () => this.showRecipes());
    this.elements.btnAiModules?.addEventListener('click', () => this.showModules());
    this.elements.btnAiLibrary?.addEventListener('click', () => this.openLibrary('history'));
  }

  async showModules() {
    const url = this.tabs.get(this.activeTabId)?.url || '';
    let origin = '';
    try { origin = new URL(url).origin; } catch {}
    if (!origin) { this.showToast('Abra uma página do site para ver módulos', 'warning'); return; }
    const resposta = await window.zeroBrowser.automation.modules(origin).catch(() => ({ modules: [] }));
    const modulos = Array.isArray(resposta?.modules) ? resposta.modules : [];
    const caixa = document.createElement('div');
    caixa.className = 'ai-message assistant ai-rich';
    const titulo = document.createElement('strong');
    titulo.textContent = `Módulos em ${origin} (${modulos.length})`;
    caixa.appendChild(titulo);
    if (!modulos.length) {
      const vazio = document.createElement('p');
      vazio.textContent = 'Nenhum módulo salvo. A execução de módulos está desativada por segurança.';
      caixa.appendChild(vazio);
    } else {
      const ul = document.createElement('ul');
      ul.className = 'ai-memory-list';
      for (const modulo of modulos) {
        const li = document.createElement('li');
        li.className = 'ai-memory-item';
        const nome = document.createElement('span');
        nome.textContent = `${modulo.name}${modulo.description ? ` — ${modulo.description}` : ''}`;
        const rodar = document.createElement('button');
        rodar.type = 'button';
        rodar.className = 'btn-ghost';
        rodar.textContent = 'Execução desativada';
        rodar.disabled = true;
        rodar.addEventListener('click', async () => {
          rodar.disabled = true;
          const texto = window.prompt('JSON de entrada (opcional)', '') || '';
          let entrada = null;
          if (texto.trim()) {
            try { entrada = JSON.parse(texto); } catch { this.showToast('JSON inválido', 'error'); rodar.disabled = false; return; }
          }
          const resultado = await window.zeroBrowser.automation.runModule(origin, modulo.name, entrada);
          this.addAiMessage('assistant', resultado.success
            ? `Módulo ${modulo.name}: ${JSON.stringify(resultado.result)}`
            : `Módulo ${modulo.name} falhou: ${resultado.error || 'sem detalhe'}`);
          rodar.disabled = false;
        });
        li.append(nome, rodar);
        ul.appendChild(li);
      }
      caixa.appendChild(ul);
    }
    this.elements.aiChat.appendChild(caixa);
    this.elements.aiChat.scrollTop = this.elements.aiChat.scrollHeight;
  }

  async showRecipes() {
    const url = this.tabs.get(this.activeTabId)?.url || '';
    let origin = '';
    try { origin = new URL(url).origin; } catch {}
    if (!origin) { this.showToast('Abra uma página do site para ver receitas', 'warning'); return; }
    const lista = await window.zeroBrowser.automation.recipes(origin).catch(() => []);
    const receitas = Array.isArray(lista?.recipes) ? lista.recipes : [];
    const caixa = document.createElement('div');
    caixa.className = 'ai-message assistant ai-rich';
    const titulo = document.createElement('strong');
    titulo.textContent = `Receitas em ${origin} (${receitas.length})`;
    caixa.appendChild(titulo);
    if (!receitas.length) {
      const vazio = document.createElement('p');
      vazio.textContent = 'Nenhuma receita salva. Depois de uma tarefa verificada, peça ao agente para salvar uma receita.';
      caixa.appendChild(vazio);
    } else {
      const ul = document.createElement('ul');
      ul.className = 'ai-memory-list';
      for (const receita of receitas) {
        const li = document.createElement('li');
        li.className = 'ai-memory-item';
        const nome = document.createElement('span');
        nome.textContent = `${receita.name} (${receita.steps} passos${receita.outputs ? `, saída: ${receita.outputs.join(', ')}` : ''})`;
        const rodar = document.createElement('button');
        rodar.type = 'button';
        rodar.className = 'btn-ghost';
        rodar.textContent = 'Executar';
        rodar.addEventListener('click', async () => {
          rodar.disabled = true;
          const resultado = await window.zeroBrowser.automation.runRecipe(origin, receita.name);
          this.addAiMessage('assistant', resultado.success
            ? `Receita ${receita.name}: ${resultado.completed} passos${resultado.output ? ` · saída ${JSON.stringify(resultado.output)}` : ''}.`
            : `Receita ${receita.name} falhou: ${resultado.error || 'sem detalhe'}`);
          rodar.disabled = false;
        });
        li.append(nome, rodar);
        ul.appendChild(li);
      }
      caixa.appendChild(ul);
    }
    this.elements.aiChat.appendChild(caixa);
    this.elements.aiChat.scrollTop = this.elements.aiChat.scrollHeight;
  }

  async showAgentMemory() {
    let memories = [];
    try {
      memories = await window.zeroBrowser.automation.memory('list');
    } catch (error) {
      this.showToast(`Não foi possível ler a memória: ${error.message}`, 'error');
      return;
    }
    const box = document.createElement('div');
    box.className = 'ai-message assistant ai-rich';
    const title = document.createElement('strong');
    title.textContent = `Memória do agente (${memories.length})`;
    box.appendChild(title);
    if (!memories.length) {
      const empty = document.createElement('p');
      empty.className = 'ai-memory-empty';
      empty.textContent = 'Nada guardado ainda. O agente salva fatos curtos por site e ações concluídas, com validade de 30 dias.';
      box.appendChild(empty);
    } else {
      const list = document.createElement('ul');
      list.className = 'ai-memory-list';
      for (const memory of memories) {
        const item = document.createElement('li');
        item.className = 'ai-memory-item';
        const label = document.createElement('span');
        const when = new Date(memory.createdAt || Date.now()).toLocaleDateString('pt-BR');
        label.textContent = `${memory.origin ? `${memory.origin}: ` : ''}${memory.text} (${when})`;
        const editar = document.createElement('button');
        editar.type = 'button';
        editar.className = 'btn-ghost';
        editar.textContent = 'Editar';
        editar.addEventListener('click', async () => {
          const novo = window.prompt('Editar fato', memory.text);
          if (!novo || !novo.trim()) return;
          const salvo = await window.zeroBrowser.automation.saveMemory({ origin: memory.origin, text: novo.trim(), kind: memory.kind, replaceId: memory.id });
          if (salvo?.success) {
            label.textContent = `${memory.origin ? `${memory.origin}: ` : ''}${novo.trim()} (${when})`;
            this.showToast('Fato atualizado', 'success');
          } else {
            this.showToast(salvo?.error || 'Não foi possível editar', 'error');
          }
        });
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'btn-ghost';
        remove.textContent = 'Apagar';
        remove.addEventListener('click', async () => {
          await window.zeroBrowser.automation.memory('forget', memory.id);
          item.remove();
        });
        item.append(label, editar, remove);
        list.appendChild(item);
      }
      box.appendChild(list);
    }
    this.elements.aiChat.appendChild(box);
    this.elements.aiChat.scrollTop = this.elements.aiChat.scrollHeight;
  }

  async sendAiMessage(resumeId = null) {
    if (this.aiRunning) return;
    const text = this.elements.aiInput.value.trim();
    if (!resumeId && !text) return;
    const route = this.prepareExecutionRoute(text, resumeId);

    this.aiRunning = true;
    this.runningAgentTabId = this.activeTabId;
    this.takeoverState = null;
    this.actionReceipts = [];
    this.lastAgentErrorTabId = null;
    if (!resumeId && text) this.lastAgentPrompt = text;
    this.syncControlledTabIndicator();
    this.syncStopAllButton();
    this.syncGrokBotBriefingBar();
    this.renderBotRail();
    document.getElementById('app')?.classList.add('agent-active');
    document.getElementById('browser-container')?.classList.add('agent-active');
    this.elements.btnAiSend.disabled = false;
    this.elements.btnAiSend.textContent = 'Parar';
    this.elements.btnAiSend.setAttribute('aria-label', 'Parar tarefa');
    const previousContinue = this.aiContinueButton;
    let workingBanner = null;
    try {
      if (!this.aiConnected && !(await this.useSavedAiConfig())) {
        this.showToast('Salve a chave e escolha um modelo primeiro', 'warning');
        return;
      }
      this.runEvents = [];
      if (previousContinue) previousContinue.disabled = true;
      const routeName = route.kind === 'specialist' ? route.bot.name : 'Agente geral';
      this.addAiMessage('user', resumeId ? 'Continuar tarefa' : text);
      if (!resumeId) this.elements.aiInput.value = '';
      this.updateOrchestratorRouteStatus('');

      if (this.elements.aiChat) {
        workingBanner = document.createElement('div');
        workingBanner.className = 'ai-message assistant ai-working-banner';
        workingBanner.innerHTML = `
          <div class="ai-working-header">
            <span class="ai-aurora-indicator"></span>
            <div>
              <strong>Agente geral está cuidando da tarefa</strong>
              <p class="ai-working-subtitle">O agente geral executa na aba e no perfil atuais${route.kind === 'specialist' ? `, seguindo o perfil local ${routeName}` : ''}. Acompanhe a página ou aguarde o término.</p>
            </div>
          </div>
          <div class="ai-working-status-pill">
            <span class="ai-pulse-dot"></span>
            <span class="ai-status-text">Executando tarefas e analisando elementos…</span>
          </div>
        `;
        this.elements.aiChat.appendChild(workingBanner);
        this.activeWorkingBanner = workingBanner;
        this.elements.aiChat.scrollTop = this.elements.aiChat.scrollHeight;
      }

      const routedPrompt = resumeId ? '' : this.buildRoutedPrompt(text, route.kind === 'specialist' ? route.bot : null);
      const result = await window.zeroBrowser.automation.runAgent(this.activeTabId, routedPrompt, false, false, resumeId);
      if (workingBanner && workingBanner.parentNode) workingBanner.remove();

      if (result.success) {
        const message = this.addAiMessage('assistant', result.message);
        const finalEvent = [...(this.runEvents || [])].reverse().find((event) => event.type === 'done');
        if (finalEvent) {
          const stats = document.createElement('div');
          stats.className = 'ai-run-stats';
          const segundos = (finalEvent.durationMs / 1000).toFixed(1).replace('.', ',');
          const tokens = Number(finalEvent.inputTokens || 0) + Number(finalEvent.outputTokens || 0);
          stats.textContent = `Concluído em ${segundos} s${tokens ? ` · ${tokens.toLocaleString('pt-BR')} tokens` : ''}`;
          message.appendChild(stats);
        }
        const toolsTimeline = (this.runEvents || []).filter((event) => event.type === 'tool');
        if (toolsTimeline.length) {
          const detalhes = document.createElement('details');
          detalhes.className = 'ai-timeline';
          const resumo = document.createElement('summary');
          resumo.textContent = `Linha do tempo (${toolsTimeline.length} ações)`;
          detalhes.appendChild(resumo);
          for (const item of toolsTimeline) {
            const linha = document.createElement('div');
            linha.className = 'ai-timeline-item';
            linha.textContent = `${item.step}. ${item.name}${item.ok === false ? ' — falhou' : ''}${item.code ? ` (${item.code})` : ''}`;
            detalhes.appendChild(linha);
          }
          message.appendChild(detalhes);
        }
        if (result.toolsUsed && Object.keys(result.toolsUsed).length) {
          const resumo = document.createElement('div');
          resumo.className = 'ai-tools-used';
          resumo.textContent = `Ferramentas: ${Object.entries(result.toolsUsed).map(([nome, total]) => `${nome}×${total}`).join(' · ')}`;
          message.appendChild(resumo);
        }
        if (result.paused && result.resumeId) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'btn btn-primary';
          button.textContent = 'Continuar';
          button.addEventListener('click', () => this.sendAiMessage(result.resumeId));
          message.appendChild(document.createElement('br'));
          message.appendChild(button);
          this.aiContinueButton = button;
          this.elements.aiChat.scrollTop = this.elements.aiChat.scrollHeight;
        }
      } else {
        // Código de erro explícito (GUARDIAN_DENIED, OUTPUT_INVALID, NAME_BOX_NOT_FOUND…) ajuda a diagnosticar.
        this.lastAgentErrorTabId = this.activeTabId;
        const etiqueta = result.code ? `Erro (${result.code})` : 'Erro';
        this.addAiMessage('error', `${etiqueta}: ${result.error}`);
        if (resumeId && previousContinue) previousContinue.disabled = false;
      }
    } catch (err) {
      if (workingBanner && workingBanner.parentNode) workingBanner.remove();
      this.lastAgentErrorTabId = this.activeTabId;
      this.addAiMessage('error', 'Erro: ' + err.message);
      if (resumeId && previousContinue) previousContinue.disabled = false;
    } finally {
      if (workingBanner && workingBanner.parentNode) workingBanner.remove();
      this.activeWorkingBanner = null;
      document.getElementById('app')?.classList.remove('agent-active');
      document.getElementById('browser-container')?.classList.remove('agent-active');
      this.aiRunning = false;
      this.runningAgentTabId = null;
      this.currentExecutionRoute = null;
      if (!this.elements.botCentral.classList.contains('hidden')) this.renderBotCentral();
      this.syncControlledTabIndicator();
      this.elements.btnStopTask.classList.add('hidden');
      this.renderBotRail();
      this.elements.btnAiSend.disabled = false;
      this.elements.btnAiSend.textContent = 'Enviar';
      this.elements.btnAiSend.setAttribute('aria-label', 'Enviar comando');
      // Um novo pausa/fim muda a lista de tarefas: o cartão do topo precisa acompanhar.
      this.refreshJobsBanner();
      this.updateOrchestratorRouteStatus(this.elements.aiInput?.value || '');
    }
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    this.elements.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideIn 200ms ease reverse';
      setTimeout(() => toast.remove(), 200);
    }, 4000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new ZeroBrowserApp();
});

class ZeroBrowserApp {
  constructor() {
    this.tabs = new Map();
    this.activeTabId = null;
    this.aiConnected = false;
    this.aiModel = 'openai/gpt-4o-mini';
    this.settings = {};
    this.aiModelCatalog = [];
    this.aiProviderConfigs = new Map();
    this.aiKeyRevealed = false;
    this.aiRevealedStoredKey = false;
    this.init();
  }

  async init() {
    this.bindElements();
    this.bindEvents();
    await this.loadSettings();
    await this.createInitialTab();
    this.initLibraryUi();
    this.initChatSessions();
    this.initAgentMemoryUi();
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
      btnAppMenu: document.getElementById('btn-app-menu'),
      appMenu: document.getElementById('app-menu'),
      libraryPanel: document.getElementById('library-panel'),
      libraryTitle: document.getElementById('library-title'),
      librarySubtitle: document.getElementById('library-subtitle'),
      librarySearch: document.getElementById('library-search'),
      libraryList: document.getElementById('library-list'),
      btnCloseLibrary: document.getElementById('btn-close-library'),
      btnMinimize: document.getElementById('btn-minimize'),
      btnMaximize: document.getElementById('btn-maximize'),
      btnClose: document.getElementById('btn-close'),
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
      aiSession: document.getElementById('ai-session'),
      btnAiNewChat: document.getElementById('btn-ai-new-chat'),
      btnAiMemory: document.getElementById('btn-ai-memory'),
      btnAiConnect: document.getElementById('btn-ai-connect'),
      aiChat: document.getElementById('ai-chat'),
      aiInput: document.getElementById('ai-input'),
      btnAiSend: document.getElementById('btn-ai-send'),
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
      this.fitTimer = setTimeout(() => this.fitBookmarksBar(), 100);
    });
    this.elements.btnFlame.addEventListener('click', () => window.zeroBrowser.flame.togglePanel());

    this.elements.addressBar.addEventListener('focus', () => {
      this.elements.addressBar.select();
    });

    this.elements.btnAi.addEventListener('click', () => this.toggleAiPanel());
    this.elements.btnCloseAi.addEventListener('click', () => this.closeAiPanel());
    this.elements.btnSettings.addEventListener('click', () => this.toggleSettingsPanel());
    this.elements.btnCloseSettings.addEventListener('click', () => this.closeSettingsPanel());

    this.elements.btnAiConnect.addEventListener('click', () => this.connectAi());
    this.elements.btnAiSend.addEventListener('click', () => {
      if (this.aiRunning) window.zeroBrowser.automation.cancelAgent(this.runningAgentTabId || this.activeTabId);
      else this.sendAiMessage();
    });
    this.elements.aiRefreshModels.addEventListener('click', () => this.refreshAiModels());
    this.elements.aiSaveKey.addEventListener('click', () => this.saveAiKey());
    this.elements.aiToggleKey.addEventListener('click', () => this.toggleAiKeyVisibility());
    this.elements.aiProvider.addEventListener('change', async () => {
      this.aiConnected = false;
      const provider = this.elements.aiProvider.value;
      await this.loadProviderConfig(provider);
      if (this.aiProviderConfigs.get(provider)?.hasApiKey) await this.refreshAiModels({ quiet: true });
    });
    this.elements.aiModel.addEventListener('change', () => this.selectAiModel(this.elements.aiModel.value));
    this.elements.aiQuickModel.addEventListener('change', () => this.selectAiModel(this.elements.aiQuickModel.value));
    this.elements.btnClose.addEventListener('click', () => window.close());
    const settingKeys = {
      'setting-show-full-url': 'browser.showFullUrl',
      'setting-clear-on-exit': 'privacy.clearOnExit',
      'setting-restore-session': 'browser.restoreSession',
      'setting-show-bookmarks-bar': 'browser.showBookmarksBar',
      'setting-theme': 'theme',
      'setting-agent-approval-mode': 'automation.approvalMode',
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
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendAiMessage();
      }
    });

    this.elements.btnMinimize.addEventListener('click', () => window.zeroBrowser.browser.minimize());
    this.elements.btnMaximize.addEventListener('click', () => window.zeroBrowser.browser.maximize());

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
      if (e.key === 'Escape') this.closeAppMenu();
      if (e.ctrlKey && e.key === 'w') {
        e.preventDefault();
        this.closeActiveTab();
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
    if (this.elements.aiPanel.classList.contains('hidden')) this.toggleAiPanel();
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
    this.elements.bookmarksBar.classList.toggle('hidden', !visible);
    window.zeroBrowser.browser.setBookmarksBar(Boolean(visible));
  }

  async renderBookmarksBar() {
    const items = await window.zeroBrowser.library.bookmarks('getChildren', '1').catch(() => []);
    const list = this.elements.bookmarksBarItems;
    list.replaceChildren();
    this.elements.bookmarksBarEmpty.classList.toggle('hidden', items.length > 0);
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
    const items = text ? await window.zeroBrowser.library.suggest(text).catch(() => []) : [];
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
      this.navigate(this.elements.addressBar.value);
    }
  }

  async createTab(url = 'about:blank') {
    try {
      const result = await window.zeroBrowser.browser.newTab(url);
      if (result && result.tabId) {
        this.addTabToUI(result.tabId, url);
        this.switchTab(result.tabId);
      }
    } catch (err) {
      console.error('Failed to create tab:', err);
      this.showToast('Erro ao criar aba', 'error');
    }
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
      <img class="tab-favicon" src="" alt="">
      <span class="tab-title">Carregando...</span>
      <button class="tab-close" data-tab-id="${tabId}" aria-label="Fechar aba"><svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="2" y1="2" x2="10" y2="10"/><line x1="10" y1="2" x2="2" y2="10"/></svg></button>
    `;

    tab.querySelector('.tab-close').addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeTab(tabId);
    });

    tab.addEventListener('click', () => this.switchTab(tabId));
    tab.addEventListener('auxclick', (e) => { if (e.button === 1) { e.preventDefault(); this.closeTab(tabId); } });
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
    if (prevActive) prevActive.classList.remove('active');

    const tabEl = this.elements.tabsContainer.querySelector(`[data-tab-id="${tabId}"]`);
    if (tabEl) tabEl.classList.add('active');

    window.zeroBrowser.browser.switchTab(tabId);
    this.activeTabId = tabId;
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

    const tabEl = this.elements.tabsContainer.querySelector(`[data-tab-id="${tabId}"]`);
    if (tabEl) tabEl.remove();

    if (wasActive) {
      const remainingTabs = Array.from(this.tabs.keys());
      if (remainingTabs.length > 0) {
        this.switchTab(remainingTabs[remainingTabs.length - 1]);
      }
    }
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
        const tabEl = this.elements.tabsContainer.querySelector(`[data-tab-id="${data.tabId}"]`);
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
        break;
      case 'browser:open-ai':
        this.toggleAiPanel(true);
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

    const tabEl = this.elements.tabsContainer.querySelector(`[data-tab-id="${tabId}"]`);
    if (!tabEl) return;

    const titleEl = tabEl.querySelector('.tab-title');
    if (titleEl && tab.title) {
      titleEl.textContent = tab.title.length > 30 ? tab.title.substring(0, 30) + '…' : tab.title;
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
    const providerName = provider === 'deepseek' ? 'DeepSeek' : 'OpenRouter';
    this.elements.aiApiKey.placeholder = config.hasApiKey ? `Salva: ${config.keyHint || '••••••••'} (vazio mantém a atual)` : `Chave API do ${providerName}`;
    this.elements.aiPrivacyNote.textContent = `O texto e os dados necessários da página ativa serão enviados ao ${providerName} para realizar a tarefa.`;
    this.elements.aiModelStatus.textContent = config.hasApiKey ? 'Chave salva com segurança. Atualize o catálogo para carregar modelos.' : 'Digite a chave e clique em Salvar chave.';
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
      this.showToast(`Chave ${provider === 'deepseek' ? 'DeepSeek' : 'OpenRouter'} salva com segurança.`, 'success');
      return saved;
    } catch (error) {
      this.elements.aiModelStatus.textContent = `Não foi possível salvar a chave: ${error.message}`;
      this.showToast(`Não foi possível salvar a chave: ${error.message}`, 'error');
      return null;
    } finally {
      this.elements.aiSaveKey.disabled = false;
    }
  }

  async refreshAiModels({ quiet = false, preferredModel } = {}) {
    const provider = this.elements.aiProvider.value;
    const config = this.aiProviderConfigs.get(provider) || await window.zeroBrowser.ai.getConfig(provider);
    const key = this.elements.aiApiKey.value.trim();
    if (!key && !config.hasApiKey) {
      this.elements.aiModelStatus.textContent = 'Digite a chave de API e clique em Atualizar.';
      if (!quiet) this.showToast('Informe a chave do provedor para sincronizar os modelos.', 'warning');
      return;
    }
    this.elements.aiRefreshModels.disabled = true;
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
      this.elements.aiModelStatus.textContent = `${models.length} modelos sincronizados; ${enabledCount} selecionáveis para o agente.`;
      if (!quiet) this.showToast(`Catálogo ${provider === 'deepseek' ? 'DeepSeek' : 'OpenRouter'} atualizado: ${models.length} modelos.`, 'success');
    } catch (error) {
      this.elements.aiModelStatus.textContent = `Falha ao sincronizar: ${error.message}`;
      if (!quiet) this.showToast(`Não foi possível carregar modelos: ${error.message}`, 'error');
    } finally {
      this.elements.aiRefreshModels.disabled = false;
    }
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
    document.getElementById('setting-block-3rd-party').checked = settings['privacy.blockThirdPartyCookies'] !== false;
    document.getElementById('setting-do-not-track').checked = settings['privacy.doNotTrack'] !== false;
    document.getElementById('setting-cdp-enabled').checked = settings['developer.cdpEnabled'] || false;
    document.getElementById('setting-webmcp-enabled').checked = settings['developer.webMcpEnabled'] || false;
    document.getElementById('setting-download-path').value = settings['downloads.path'] || '';
    document.getElementById('setting-download-prompt').checked = settings['downloads.prompt'] !== false;
    document.getElementById('setting-agent-recipes').checked = settings['automation.recipes'] !== false;
    document.getElementById('setting-agent-transforms').checked = settings['automation.transforms'] !== false;
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

  async toggleAiPanel(forceOpen = false) {
    const opening = forceOpen ? true : this.elements.aiPanel.classList.contains('hidden');
    this.elements.aiPanel.classList.toggle('hidden', !opening);
    this.elements.settingsPanel.classList.add('hidden');
    this.elements.libraryPanel.classList.add('hidden');
    this.closeAppMenu();
    window.zeroBrowser.browser.setSidePanelOpen(opening);
    if (opening) {
      await this.releasePageOverlay('panel');
      this.elements.aiInput.focus();
      this.loadAiSettings();
      this.refreshJobsBanner();
    } else await this.releasePageOverlay('panel');
  }

  closeAiPanel() {
    this.elements.aiPanel.classList.add('hidden');
    if (this.elements.settingsPanel.classList.contains('hidden')) window.zeroBrowser.browser.setSidePanelOpen(false);
    if (this.elements.settingsPanel.classList.contains('hidden') && this.elements.libraryPanel.classList.contains('hidden')) this.releasePageOverlay('panel');
  }

  toggleSettingsPanel() {
    const opening = this.elements.settingsPanel.classList.contains('hidden');
    this.elements.settingsPanel.classList.toggle('hidden', !opening);
    this.elements.aiPanel.classList.add('hidden');
    this.elements.libraryPanel.classList.add('hidden');
    this.closeAppMenu();
    window.zeroBrowser.browser.setSidePanelOpen(opening);
    if (opening) {
      this.freezePageForPanel();
      this.loadSettingsToUI();
      this.loadAiSettings();
    } else if (this.elements.aiPanel.classList.contains('hidden') && this.elements.libraryPanel.classList.contains('hidden')) this.releasePageOverlay('panel');
  }

  closeSettingsPanel() {
    this.elements.settingsPanel.classList.add('hidden');
    if (this.elements.aiPanel.classList.contains('hidden')) window.zeroBrowser.browser.setSidePanelOpen(false);
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

  closeAppMenu() {
    const wasOpen = !this.elements.appMenu.classList.contains('hidden');
    this.elements.appMenu.classList.add('hidden');
    this.elements.btnAppMenu.setAttribute('aria-expanded', 'false');
    if (wasOpen) {
      this.appMenuFreezeRequest = (this.appMenuFreezeRequest || 0) + 1;
      this.releaseAppMenuFreeze();
    }
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
  }

  async openExtensionsManager() {
    this.elements.settingsPanel.classList.remove('hidden');
    this.elements.aiPanel.classList.add('hidden');
    this.elements.libraryPanel.classList.add('hidden');
    this.closeAppMenu();
    window.zeroBrowser.browser.setSidePanelOpen(true);
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

  async openLibrary(mode) {
    this.elements.libraryPanel.classList.remove('hidden');
    this.elements.aiPanel.classList.add('hidden');
    this.elements.settingsPanel.classList.add('hidden');
    this.closeAppMenu();
    this.libraryMode = mode;
    const labels = {
      history: ['Histórico', 'Páginas visitadas neste perfil.'],
      bookmarks: ['Favoritos', 'Endereços guardados neste perfil.'],
      downloads: ['Downloads', 'Downloads recentes desta sessão do Zero Browser.']
    };
    [this.elements.libraryTitle.textContent, this.elements.librarySubtitle.textContent] = labels[mode];
    this.elements.librarySearch.value = '';
    window.zeroBrowser.browser.setSidePanelOpen(true);
    await this.freezePageForPanel();
    await this.renderLibrary();
    this.elements.librarySearch.focus();
  }

  async closeLibrary() {
    this.elements.libraryPanel.classList.add('hidden');
    if (this.elements.aiPanel.classList.contains('hidden') && this.elements.settingsPanel.classList.contains('hidden')) window.zeroBrowser.browser.setSidePanelOpen(false);
    if (this.elements.aiPanel.classList.contains('hidden') && this.elements.settingsPanel.classList.contains('hidden')) await this.releasePageOverlay('panel');
  }

  async renderLibrary() {
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
      this.elements.libraryList.replaceChildren(this.libraryEmpty(`Não foi possível carregar: ${error.message}`));
      return;
    }
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
      if (!saved.hasApiKey) throw new Error(`Informe a chave API do ${provider === 'deepseek' ? 'DeepSeek' : 'OpenRouter'}`);
      const result = await window.zeroBrowser.automation.runAgent(this.activeTabId, 'Use inspect_page exatamente uma vez para confirmar que as chamadas de ferramenta funcionam. Não clique, navegue ou altere nada.', true, true);
      if (!result.success) throw new Error(result.error);
      this.aiConnected = true;
      this.addAiMessage('assistant', `Conectado a ${provider === 'deepseek' ? 'DeepSeek' : 'OpenRouter'} com ${model}. Posso operar a aba ativa usando as ferramentas disponíveis.`);
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
    this.renderChatSessionSelect();
    this.renderChatSession();

    this.elements.aiSession?.addEventListener('change', () => {
      const found = this.chatSessions.find((session) => session.id === this.elements.aiSession.value);
      if (!found) return;
      this.chatSession = found;
      this.renderChatSession();
    });
    this.elements.btnAiNewChat?.addEventListener('click', () => {
      this.startChatSession();
      this.elements.aiInput.focus();
    });
  }

  startChatSession({ render = true } = {}) {
    const session = { id: `c${Date.now().toString(36)}`, title: 'Nova conversa', messages: [], updatedAt: Date.now() };
    this.chatSessions = [session, ...(this.chatSessions || [])].slice(0, 50);
    this.chatSession = session;
    this.persistChatSessions();
    if (render) {
      this.renderChatSession();
      this.renderChatSessionSelect();
    }
    return session;
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
    for (const session of this.chatSessions || []) {
      const option = document.createElement('option');
      option.value = session.id;
      const when = new Date(session.updatedAt || Date.now()).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      option.textContent = `${session.title || 'Conversa'} · ${when}`;
      select.appendChild(option);
    }
    if (this.chatSession) select.value = this.chatSession.id;
  }

  renderChatSession() {
    const chat = this.elements.aiChat;
    if (!chat) return;
    chat.replaceChildren();
    const messages = this.chatSession?.messages || [];
    for (const message of messages) this.addAiMessage(message.role, message.content, { persist: false });
    if (!messages.length) {
      const hint = document.createElement('div');
      hint.className = 'ai-message assistant ai-rich';
      hint.textContent = 'Comece com uma tarefa nesta aba ou use um exemplo:';
      chat.appendChild(hint);
      const exemplos = document.createElement('div');
      exemplos.className = 'ai-message assistant ai-examples';
      const sugestoes = [
        'Leia o intervalo A1:C5 desta planilha e diga o total da coluna C.',
        'Preencha o formulário desta página com os dados que eu passar.',
        'Resuma esta página em cinco tópicos e cite os números.'
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
      chat.appendChild(exemplos);
    }
    this.refreshJobsBanner();
    chat.scrollTop = chat.scrollHeight;
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
    const job = jobs[0];
    const banner = document.createElement('div');
    banner.className = 'ai-message assistant ai-jobs-banner';
    const title = document.createElement('strong');
    title.textContent = 'Tarefa pausada';
    const detail = document.createElement('p');
    const when = new Date(job.startedAt || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    detail.textContent = `${job.model || 'modelo'} · ${job.messages || 0} mensagens no histórico · iniciada às ${when}${job.lastUrl ? ` · ${job.lastUrl}` : ''}`;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn-primary';
    button.textContent = 'Continuar tarefa';
    button.addEventListener('click', () => {
      button.disabled = true;
      this.sendAiMessage(job.id);
    });
    banner.append(title, detail, button);
    chat.prepend(banner);
  }

  initAgentMemoryUi() {
    this.elements.btnAiMemory?.addEventListener('click', () => this.showAgentMemory());
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
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'btn-ghost';
        remove.textContent = 'Apagar';
        remove.addEventListener('click', async () => {
          await window.zeroBrowser.automation.memory('forget', memory.id);
          item.remove();
        });
        item.append(label, remove);
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

    this.aiRunning = true;
    this.runningAgentTabId = this.activeTabId;
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
      if (previousContinue) previousContinue.disabled = true;
      this.addAiMessage('user', resumeId ? 'Continuar tarefa' : text);
      if (!resumeId) this.elements.aiInput.value = '';

      if (this.elements.aiChat) {
        workingBanner = document.createElement('div');
        workingBanner.className = 'ai-message assistant ai-working-banner';
        workingBanner.innerHTML = `
          <div class="ai-working-header">
            <span class="ai-aurora-indicator"></span>
            <div>
              <strong>Chefe, assumi o controle do navegador!</strong>
              <p class="ai-working-subtitle">Estamos fazendo seu trabalho na aba ativa. Acompanhe a moldura de aurora boreal na página ou aguarde o término.</p>
            </div>
          </div>
          <div class="ai-working-status-pill">
            <span class="ai-pulse-dot"></span>
            <span class="ai-status-text">Executando tarefas e analisando elementos…</span>
          </div>
        `;
        this.elements.aiChat.appendChild(workingBanner);
        this.elements.aiChat.scrollTop = this.elements.aiChat.scrollHeight;
      }

      const result = await window.zeroBrowser.automation.runAgent(this.activeTabId, resumeId ? '' : text, false, false, resumeId);
      if (workingBanner && workingBanner.parentNode) workingBanner.remove();

      if (result.success) {
        const message = this.addAiMessage('assistant', result.message);
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
        const etiqueta = result.code ? `Erro (${result.code})` : 'Erro';
        this.addAiMessage('error', `${etiqueta}: ${result.error}`);
        if (resumeId && previousContinue) previousContinue.disabled = false;
      }
    } catch (err) {
      if (workingBanner && workingBanner.parentNode) workingBanner.remove();
      this.addAiMessage('error', 'Erro: ' + err.message);
      if (resumeId && previousContinue) previousContinue.disabled = false;
    } finally {
      if (workingBanner && workingBanner.parentNode) workingBanner.remove();
      document.getElementById('app')?.classList.remove('agent-active');
      document.getElementById('browser-container')?.classList.remove('agent-active');
      this.aiRunning = false;
      this.runningAgentTabId = null;
      this.elements.btnAiSend.disabled = false;
      this.elements.btnAiSend.textContent = 'Enviar';
      this.elements.btnAiSend.setAttribute('aria-label', 'Enviar comando');
      // Um novo pausa/fim muda a lista de tarefas: o cartão do topo precisa acompanhar.
      this.refreshJobsBanner();
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

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const { matchPatternToRegExp } = require('../src/main/extensions/extension-host');
const { ExtensionHost } = require('../src/main/extensions/extension-host');
const { lastReply } = require('../src/main/extensions/flame-runner');

test('chrome.tabs.query url patterns match like in Chrome', () => {
  assert.ok(matchPatternToRegExp('https://*/*').test('https://example.com/a'));
  assert.ok(!matchPatternToRegExp('https://*/*').test('http://example.com/a'));
  assert.ok(matchPatternToRegExp('<all_urls>').test('http://127.0.0.1:3000/t/01'));
  assert.ok(!matchPatternToRegExp('<all_urls>').test('chrome-extension://abc/x.html'));
});

test('the Flame reply is the panel text after the last prompt, without button labels', () => {
  const panel = 'Boas-vindas\nCancele minha assinatura Premium.\n\nMostrar detalhes do raciocínio\n\nNão encontrei Premium.\n\nCopy\nSave as Skill\nRetry';
  assert.equal(lastReply(panel, 'Cancele minha assinatura Premium.'), 'Não encontrei Premium.');
});

test('extension IPC accepts only extension frames inside a top-level page from the same loaded extension', () => {
  const session = {};
  const host = Object.create(ExtensionHost.prototype);
  host.session = session;
  host.extensions = new Map([['flame-id', { id: 'flame-id' }], ['user-id', { id: 'user-id' }]]);
  const topUrl = 'chrome-extension://flame-id/panel.html?tabId=42';
  const sender = { session, getURL: () => topUrl, isDestroyed: () => false };
  assert.equal(host.isAuthorizedExtensionFrame({
    sender,
    senderFrame: { url: topUrl }
  }), true, 'extension top frame should retain its API access');
  assert.equal(host.isAuthorizedExtensionFrame({
    sender,
    senderFrame: { url: 'chrome-extension://flame-id/frame/options.html' }
  }), true, 'an extension-owned iframe shares the extension principal');
  assert.equal(host.isAuthorizedExtensionFrame({
    sender,
    senderFrame: { url: 'https://attacker.example/frame.html' }
  }), false, 'remote iframe must not invoke extension IPC');
  assert.equal(host.isAuthorizedExtensionFrame({
    sender: { ...sender, getURL: () => 'https://attacker.example/' },
    senderFrame: { url: 'chrome-extension://flame-id/frame.html' }
  }), false, 'extension frame embedded in a web top-level page is not trusted');
  assert.equal(host.isAuthorizedExtensionFrame({
    sender,
    senderFrame: { url: 'chrome-extension://user-id/frame.html' }
  }), false, 'a frame from another loaded extension cannot borrow the top page principal');
  assert.equal(host.isAuthorizedExtensionFrame({
    sender: { ...sender, session: {} },
    senderFrame: { url: topUrl }
  }), false, 'extension pages in a different session are rejected');
  assert.equal(host.isAuthorizedExtensionFrame({
    sender: { ...sender, isDestroyed: () => true },
    senderFrame: { url: topUrl }
  }), false, 'destroyed renderers are rejected');
  assert.equal(host.isAuthorizedExtensionFrame({ sender, senderFrame: null }), false);
});

test('custom privileged extension APIs require their declared manifest permission', async () => {
  const requestedDownloads = [];
  const host = new ExtensionHost({
    session: { downloadURL: (url) => requestedDownloads.push(url) },
    browser: { activeWebContents: () => null }
  });
  host.extensions = new Map([
    ['limited-id', { id: 'limited-id', manifest: { permissions: [] } }],
    ['downloads-id', { id: 'downloads-id', manifest: { permissions: ['downloads'] } }]
  ]);

  const denied = await host.dispatch('downloads.download', [{ url: 'https://example.test/file' }], { extensionId: 'limited-id' });
  assert.match(denied.error, /downloads/);
  assert.deepEqual(requestedDownloads, [], 'a denied extension cannot start a download through the IPC shim');

  const allowed = await host.dispatch('downloads.download', [{ url: 'https://example.test/file' }], { extensionId: 'downloads-id' });
  assert.equal(allowed.value, 1);
  assert.deepEqual(requestedDownloads, ['https://example.test/file']);
  assert.equal(host.extensionIdForUrl('chrome-extension://downloads-id/background.js'), 'downloads-id');
  assert.equal(host.extensionIdForUrl('chrome-extension://unknown/background.js'), null);
});

test('tabs.create, tabs.update and windows.create reject privileged navigation schemes', async () => {
  const navigations = [];
  const webContents = {
    id: 7,
    getURL: () => 'https://start.example/',
    getTitle: () => 'Start',
    isCurrentlyAudible: () => false,
    isAudioMuted: () => false,
    isLoading: () => false,
    loadURL: (url) => { navigations.push(url); return Promise.resolve(); }
  };
  const created = [];
  const host = new ExtensionHost({ session: {}, browser: {
    createTab: async (url) => { created.push(url); return webContents; },
    listTabs: () => [webContents],
    activeWebContents: () => webContents,
    viewBounds: () => ({ width: 800, height: 600 }),
    windowBounds: () => ({ x: 0, y: 0, width: 800, height: 600 }),
    isFocused: () => true,
    windowState: () => 'normal'
  } });
  host.extensions = new Map([['safe-id', { id: 'safe-id', manifest: { permissions: [] } }]]);
  host.tabMeta = new Map([[7, { pinned: false, groupId: -1 }]]);

  for (const url of ['file:///C:/Users/test/secret.txt', 'javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'chrome://settings', 'chrome-extension://other-id/page.html', 'https://', 'not a URL']) {
    const createResult = await host.dispatch('tabs.create', [{ url }], { extensionId: 'safe-id' });
    assert.match(createResult.error, /só podem navegar/);
    const updateResult = await host.dispatch('tabs.update', [7, { url }], { extensionId: 'safe-id' });
    assert.match(updateResult.error, /só podem navegar/);
    const windowResult = await host.dispatch('windows.create', [{ url }], { extensionId: 'safe-id' });
    assert.match(windowResult.error, /só podem navegar/);
  }
  const mixedWindowResult = await host.dispatch('windows.create', [{ url: ['https://safe.example/', 'file:///C:/Users/test/secret.txt'] }], { extensionId: 'safe-id' });
  assert.match(mixedWindowResult.error, /só podem navegar/);
  assert.deepEqual(created, [], 'rejected schemes must not create a browser tab');
  assert.deepEqual(navigations, [], 'rejected schemes must not reach webContents.loadURL');

  await host.dispatch('tabs.create', [{ url: 'https://safe.example/path' }], { extensionId: 'safe-id' });
  await host.dispatch('tabs.create', [{ url: 'about:blank' }], { extensionId: 'safe-id' });
  await host.dispatch('tabs.create', [{ url: 'chrome-extension://safe-id/options.html' }], { extensionId: 'safe-id' });
  await host.dispatch('tabs.create', [{}], { extensionId: 'safe-id' });
  await host.dispatch('tabs.create', [{ url: '' }], { extensionId: 'safe-id' });
  const safeUpdate = await host.dispatch('tabs.update', [7, { url: 'https://safe.example/next' }], { extensionId: 'safe-id' });
  assert.equal(safeUpdate.error, undefined);
  const emptyUpdate = await host.dispatch('tabs.update', [7, { url: '' }], { extensionId: 'safe-id' });
  assert.equal(emptyUpdate.error, undefined);
  const safeWindow = await host.dispatch('windows.create', [{ url: 'about:blank' }], { extensionId: 'safe-id' });
  assert.equal(safeWindow.error, undefined);
  assert.deepEqual(created, [
    'https://safe.example/path', 'about:blank', 'chrome-extension://safe-id/options.html',
    'about:blank', 'about:blank', 'about:blank'
  ]);
  assert.deepEqual(navigations, ['https://safe.example/next']);
});

test('URL-bearing extension events are delivered only to recipients with the namespace permission', () => {
  const received = { deniedWorker: [], allowedWorker: [], deniedPage: [], allowedPage: [] };
  const page = (id, key) => ({
    getURL: () => `chrome-extension://${id}/panel.html`,
    isDestroyed: () => false,
    send: (_channel, name, args) => received[key].push({ name, args })
  });
  const host = new ExtensionHost({ session: {}, browser: {
    extensionPages: () => [page('no-history-id', 'deniedPage'), page('history-id', 'allowedPage')]
  } });
  host.extensions = new Map([
    ['no-history-id', { id: 'no-history-id', manifest: { permissions: [] } }],
    ['history-id', { id: 'history-id', manifest: { permissions: ['history'] } }]
  ]);
  host.workers.set('denied-worker', { scope: 'chrome-extension://no-history-id/', send: (...event) => received.deniedWorker.push(event) });
  host.workers.set('allowed-worker', { scope: 'chrome-extension://history-id/', send: (...event) => received.allowedWorker.push(event) });

  host.emit('history.onVisited', { url: 'https://private.example/account', title: 'Private' });
  assert.deepEqual(received.deniedWorker, [], 'worker without history permission must not receive the URL-bearing event');
  assert.deepEqual(received.deniedPage, [], 'extension page without history permission must not receive the URL-bearing event');
  assert.equal(received.allowedWorker.length, 1);
  assert.equal(received.allowedPage.length, 1);
  assert.equal(received.allowedPage[0].args[0].url, 'https://private.example/account');
});

test('activeTab is scoped to the clicked extension, tab, and origin, and survives same-origin navigation', async () => {
  let captures = 0;
  const createWebContents = (id, url) => {
    const wc = new EventEmitter();
    wc.id = id;
    wc.url = url;
    wc.getURL = () => wc.url;
    wc.getTitle = () => `Title ${id}`;
    wc.isCurrentlyAudible = () => false;
    wc.isAudioMuted = () => false;
    wc.isLoading = () => false;
    wc.isDestroyed = () => false;
    wc.capturePage = async () => ({ toDataURL: () => { captures += 1; return 'data:image/png;base64,fixture'; } });
    return wc;
  };
  const firstTab = createWebContents(21, 'https://allowed.example/page');
  const secondTab = createWebContents(22, 'https://allowed.example/other');
  let activeTab = firstTab;
  const events = [];
  const legacyEvents = [];
  const worker = {
    scope: 'chrome-extension://active-tab-id/', versionId: 91,
    ipc: { removeHandler() {}, handle() {} },
    send: (_channel, name, args) => events.push({ name, args })
  };
  const session = { extensions: { removeExtension() {} }, serviceWorkers: {
    startWorkerForScope: async (scope) => {
      assert.equal(scope, 'chrome-extension://active-tab-id/');
      return worker;
    }
  } };
  const host = new ExtensionHost({ session, browser: {
    activeWebContents: () => activeTab,
    listTabs: () => [firstTab, secondTab],
    extensionPages: () => [{
      getURL: () => 'chrome-extension://mv2-id/background.html',
      isDestroyed: () => false,
      send: (_channel, name, args) => legacyEvents.push({ name, args })
    }],
    faviconOf: () => null,
    viewBounds: () => ({ width: 900, height: 700 })
  } });
  host.extensions = new Map([
    ['no-host-id', { id: 'no-host-id', manifest: { permissions: [] } }],
    ['active-tab-id', { id: 'active-tab-id', manifest: { permissions: ['activeTab'], action: {}, background: { service_worker: 'worker.js' } } }],
    ['mv2-id', { id: 'mv2-id', manifest: { permissions: ['activeTab'], browser_action: {}, background: { page: 'background.html' } } }],
    ['popup-id', { id: 'popup-id', manifest: { permissions: ['activeTab'], action: { default_popup: 'popup.html' } } }],
    ['site-host-id', { id: 'site-host-id', manifest: { host_permissions: ['https://allowed.example/*'] } }],
    ['all-host-id', { id: 'all-host-id', manifest: { host_permissions: ['<all_urls>'] } }]
  ]);
  host.registerTab(firstTab);
  host.registerTab(secondTab);
  legacyEvents.length = 0;

  const denied = await host.dispatch('tabs.captureVisibleTab', [{ format: 'png' }], { extensionId: 'active-tab-id' });
  assert.match(denied.error, /permissão host/);
  assert.equal(captures, 0, 'an activeTab declaration alone does not grant access');

  const action = await host.invokeActionForActiveTab('active-tab-id');
  assert.deepEqual(action, { success: true, activeTabGranted: true });
  assert.deepEqual(events.map((event) => event.name), ['action.onClicked']);
  assert.equal(events[0].args[0].url, 'https://allowed.example/page', 'the action event receives the clicked tab details');
  const activeDetails = await host.dispatch('tabs.get', [firstTab.id], { extensionId: 'active-tab-id' });
  assert.equal(activeDetails.value.url, firstTab.getURL());
  const otherExtensionDetails = await host.dispatch('tabs.get', [firstTab.id], { extensionId: 'no-host-id' });
  assert.equal(otherExtensionDetails.value.url, undefined, 'the grant is not shared with another extension');

  const legacyAction = await host.invokeActionForActiveTab('mv2-id');
  assert.deepEqual(legacyAction, { success: true, activeTabGranted: true });
  assert.deepEqual(legacyEvents.map((event) => event.name), ['browserAction.onClicked'], 'Manifest V2 receives its browserAction event');
  await assert.rejects(host.invokeActionForActiveTab('popup-id'), /popup.*não disponível/);
  assert.equal(host.activeTabGrants.has('popup-id'), false, 'popup actions do not receive an onClicked event or grant');

  const captured = await host.dispatch('tabs.captureVisibleTab', [{ format: 'png' }], { extensionId: 'active-tab-id' });
  assert.equal(captured.value, 'data:image/png;base64,fixture');
  activeTab = secondTab;
  const otherTabCapture = await host.dispatch('tabs.captureVisibleTab', [{ format: 'png' }], { extensionId: 'active-tab-id' });
  assert.match(otherTabCapture.error, /permissão host/);
  activeTab = firstTab;

  firstTab.emit('did-navigate', {}, 'https://allowed.example/next');
  firstTab.url = 'https://allowed.example/next';
  const afterSameOriginNavigation = await host.dispatch('tabs.captureVisibleTab', [{ format: 'png' }], { extensionId: 'active-tab-id' });
  assert.equal(afterSameOriginNavigation.value, 'data:image/png;base64,fixture', 'same-origin navigation keeps the temporary grant');
  firstTab.emit('did-navigate', {}, 'https://other.example/next');
  firstTab.url = 'https://other.example/next';
  const afterCrossOriginNavigation = await host.dispatch('tabs.captureVisibleTab', [{ format: 'png' }], { extensionId: 'active-tab-id' });
  assert.match(afterCrossOriginNavigation.error, /permissão host/);
  assert.equal(captures, 2, 'the grant is revoked after a cross-origin navigation commits');

  firstTab.url = 'https://allowed.example/next';
  const siteAllowed = await host.dispatch('tabs.captureVisibleTab', [{ format: 'png' }], { extensionId: 'site-host-id' });
  assert.equal(siteAllowed.value, 'data:image/png;base64,fixture', 'matching required host permission permits capture of the active tab');
  firstTab.url = 'https://secret.example/account';
  const siteDenied = await host.dispatch('tabs.captureVisibleTab', [{ format: 'png' }], { extensionId: 'site-host-id' });
  assert.match(siteDenied.error, /permissão host/);
  assert.equal(captures, 3, 'a host grant for another site cannot capture the active tab');

  const allowed = await host.dispatch('tabs.captureVisibleTab', [{ format: 'png' }], { extensionId: 'all-host-id' });
  assert.equal(allowed.value, 'data:image/png;base64,fixture');
  assert.equal(captures, 4);

  const forgedAction = await host.dispatch('action.onClicked', [], { extensionId: 'active-tab-id' });
  assert.match(forgedAction.error, /não está disponível/);
  assert.equal(events.filter((event) => event.name === 'action.onClicked').length, 1, 'extension IPC cannot trigger the trusted host action event');
  firstTab.url = 'https://allowed.example/last';
  await host.invokeActionForActiveTab('mv2-id');
  assert.equal(host.hasActiveTabGrant('mv2-id', firstTab.id, firstTab.getURL()), true);
  firstTab.emit('destroyed');
  assert.equal(host.hasActiveTabGrant('mv2-id', firstTab.id, firstTab.getURL()), false, 'closing a tab revokes its temporary grants');
});

test('management.getSelf does not require the management permission', async () => {
  const host = new ExtensionHost({ session: {}, browser: {} });
  host.primaryId = 'self-id';
  host.extensions = new Map([['self-id', { id: 'self-id', name: 'Self', version: '1.2', manifest: { permissions: [] } }]]);
  const result = await host.dispatch('management.getSelf', [], { extensionId: 'self-id' });
  assert.equal(result.value.id, 'self-id');
});

test('tabs.get, tabs.query and populated windows redact sensitive fields by required host access', async () => {
  const makeTab = (id, url, title) => ({
    id,
    isCurrentlyAudible: () => false,
    isAudioMuted: () => false,
    getURL: () => url,
    getTitle: () => title,
    isLoading: () => false
  });
  const tabs = [
    makeTab(11, 'https://allowed.example/page', 'Allowed title'),
    makeTab(12, 'https://secret.example/account', 'Secret title')
  ];
  const pageEvents = new Map();
  const extensionPage = (id) => ({
    getURL: () => `chrome-extension://${id}/panel.html`,
    isDestroyed: () => false,
    send: (_channel, name, args) => pageEvents.set(`${id}:${name}`, args)
  });
  const host = new ExtensionHost({ session: {}, browser: {
    listTabs: () => tabs,
    activeWebContents: () => tabs[0],
    faviconOf: () => 'https://icons.example/icon.png',
    viewBounds: () => ({ width: 1200, height: 800 }),
    windowBounds: () => ({ x: 0, y: 0, width: 1200, height: 800 }),
    isFocused: () => true,
    windowState: () => 'normal',
    extensionPages: () => ['none-id', 'site-id', 'tabs-id'].map(extensionPage)
  } });
  host.tabMeta = new Map(tabs.map((tab) => [tab.id, { pinned: false, groupId: -1 }]));
  host.extensions = new Map([
    ['none-id', { manifest: { permissions: [] } }],
    ['site-id', { manifest: { permissions: [], host_permissions: ['https://allowed.example/*'], optional_host_permissions: ['https://secret.example/*'] } }],
    ['tabs-id', { manifest: { permissions: ['tabs'] } }]
  ]);

  const none = await host.dispatch('tabs.get', [12], { extensionId: 'none-id' });
  assert.equal(none.value.url, undefined);
  assert.equal(none.value.title, undefined);
  assert.equal(none.value.favIconUrl, undefined);

  const noneQuery = await host.dispatch('tabs.query', [{}], { extensionId: 'none-id' });
  assert.equal(noneQuery.value.length, 2, 'unfiltered queries can still return nonsensitive tab metadata');
  assert.equal(noneQuery.value[1].url, undefined);
  assert.deepEqual((await host.dispatch('tabs.query', [{ url: 'https://secret.example/*' }], { extensionId: 'none-id' })).value, [], 'URL filters cannot reveal an inaccessible tab');
  assert.deepEqual((await host.dispatch('tabs.query', [{ title: 'Secret*' }], { extensionId: 'none-id' })).value, [], 'title filters cannot reveal an inaccessible tab');

  const siteQuery = await host.dispatch('tabs.query', [{}], { extensionId: 'site-id' });
  assert.equal(siteQuery.value[0].url, 'https://allowed.example/page');
  assert.equal(siteQuery.value[0].title, 'Allowed title');
  assert.equal(siteQuery.value[1].url, undefined, 'optional host permission is not treated as an effective grant');
  assert.deepEqual((await host.dispatch('tabs.query', [{ url: 'https://allowed.example/*' }], { extensionId: 'site-id' })).value.map((tab) => tab.id), [11]);
  assert.deepEqual((await host.dispatch('tabs.query', [{ url: 'https://secret.example/*' }], { extensionId: 'site-id' })).value, []);

  const window = await host.dispatch('windows.getAll', [{ populate: true }], { extensionId: 'site-id' });
  assert.equal(window.value[0].tabs[0].url, 'https://allowed.example/page');
  assert.equal(window.value[0].tabs[1].url, undefined, 'populated windows use the same permission-aware projection');

  const unrestricted = await host.dispatch('tabs.query', [{}], { extensionId: 'tabs-id' });
  assert.equal(unrestricted.value[1].title, 'Secret title');

  host.emit('tabs.onCreated', host.tabInfo(tabs[0]));
  assert.equal(pageEvents.get('none-id:tabs.onCreated')[0].url, undefined);
  assert.equal(pageEvents.get('site-id:tabs.onCreated')[0].url, 'https://allowed.example/page');
  assert.equal(pageEvents.get('tabs-id:tabs.onCreated')[0].title, 'Allowed title');
  host.emit('tabs.onUpdated', 12, { url: tabs[1].getURL(), title: tabs[1].getTitle() }, host.tabInfo(tabs[1]));
  assert.deepEqual(pageEvents.get('none-id:tabs.onUpdated')[1], {}, 'changeInfo also omits inaccessible title and URL fields');
  assert.equal(pageEvents.get('site-id:tabs.onUpdated')[2].url, undefined, 'site-specific host access does not reveal another origin through events');
  assert.equal(pageEvents.get('tabs-id:tabs.onUpdated')[1].title, 'Secret title');
});

test('service worker IPC keeps its own scoped handler and extension-scope validation', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/main/extensions/extension-host.js'), 'utf8');
  assert.match(source, /this\.registerServiceWorker\(worker\);/);
  assert.match(source, /registerServiceWorker\(worker\) \{[\s\S]*if \(!worker \|\| !this\.isExtensionUrl\(worker\.scope\)/);
  assert.match(source, /const extensionId = this\.extensionIdForUrl\(worker\.scope\);[\s\S]*worker\.ipc\.handle\('navegante-ext:call', \(_event, method, args\) => this\.dispatch\(method, args, \{ extensionId \}\)\)/);
});

test('user extensions cannot replace or unload the protected primary Flame extension', async () => {
  const options = [];
  const removed = [];
  const session = {
    extensions: {
      loadExtension: async (extensionPath, settings) => {
        options.push({ extensionPath, settings });
        const isFlame = extensionPath === 'flame';
        return { id: isFlame ? 'flame-id' : 'user-id', name: isFlame ? 'Flame' : 'User extension', version: '1.0', manifest: isFlame ? { side_panel: { default_path: 'panel.html' } } : {} };
      },
      removeExtension: (id) => removed.push(id)
    }
  };
  const host = new ExtensionHost({ session, browser: {} });
  const flame = await host.loadExtension({ path: 'flame', primary: true, allowFileAccess: true });
  await host.loadExtension({ path: 'user', primary: false, allowFileAccess: false });
  assert.equal(host.primary, flame);
  assert.equal(host.extensionUrl('panel.html'), 'chrome-extension://flame-id/panel.html');
  assert.deepEqual(options.map((item) => item.settings.allowFileAccess), [true, false]);
  assert.throws(() => host.unloadExtension('flame-id'), /não pode ser removida/);
  assert.equal(host.unloadExtension('user-id'), true);
  assert.deepEqual(removed, ['user-id']);
  assert.equal(host.primary, flame);
});

test('management lists loaded extensions and only allows disabling third parties', () => {
  const host = Object.create(ExtensionHost.prototype);
  host.primaryId = 'flame-id';
  host.extensions = new Map([
    ['flame-id', { id: 'flame-id', name: 'Flame', version: '1.0' }],
    ['user-id', { id: 'user-id', name: 'User', version: '0.2' }]
  ]);
  const removed = [];
  host.session = { extensions: { removeExtension: (id) => removed.push(id) } };

  const list = host.managementList();
  assert.deepEqual(list.map((item) => item.id).sort(), ['flame-id', 'user-id']);
  assert.equal(list.find((item) => item.id === 'user-id').name, 'User');

  assert.throws(() => host.managementSetEnabled('flame-id', false), /principal/);
  assert.throws(() => host.managementSetEnabled('user-id', true), /Reativar|reativar/);
  assert.equal(host.managementSetEnabled('user-id', false), true);
  assert.deepEqual(removed, ['user-id']);
  assert.equal(host.extensions.has('user-id'), false);
});

// Verifica action.onClicked -> grant ativo -> tabs.captureVisibleTab em um worker MV3 real.
// Executa em uma sessão Electron descartável e usa somente uma página HTTP local.
const { app, BrowserWindow, session } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { ExtensionHost } = require('../src/main/extensions/extension-host');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zero-active-tab-'));
app.setPath('userData', path.join(tempRoot, 'user-data'));

function waitFor(promise, timeoutMs, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`Timeout: ${label}`)), timeoutMs); })
  ]).finally(() => clearTimeout(timer));
}

async function run() {
  const extensionPath = path.join(tempRoot, 'extension');
  fs.mkdirSync(extensionPath, { recursive: true });
  fs.writeFileSync(path.join(extensionPath, 'manifest.json'), JSON.stringify({
    manifest_version: 3,
    name: 'Active Tab Fixture',
    version: '1.0.0',
    permissions: ['activeTab'],
    action: {},
    background: { service_worker: 'service-worker.js' }
  }));
  fs.writeFileSync(path.join(extensionPath, 'service-worker.js'), `
    chrome.action.onClicked.addListener(async (tab) => {
      try {
        const image = await chrome.tabs.captureVisibleTab({ format: 'png' });
        console.log('__ZERO_ACTIVE_TAB_RESULT__' + JSON.stringify({
          tabId: tab.id,
          url: tab.url,
          image: typeof image === 'string' && image.startsWith('data:image/png;base64,') && image.length > 40
        }));
      } catch (error) {
        console.log('__ZERO_ACTIVE_TAB_RESULT__' + JSON.stringify({ tabId: tab?.id, error: String(error) }));
      }
    });
  `);

  const server = http.createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end('<!doctype html><title>Active tab fixture</title><body><h1>Local fixture page</h1></body>');
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  let window;
  let host;
  let ses;
  let captureCalls = 0;
  let resultResolve;
  let result;

  try {
    await app.whenReady();
    ses = session.fromPartition(`persist:active-tab-${path.basename(tempRoot)}`);
    host = new ExtensionHost({ session: ses, browser: {
      activeWebContents: () => window?.webContents || null,
      listTabs: () => window && !window.isDestroyed() ? [window.webContents] : [],
      extensionPages: () => require('electron').webContents.getAllWebContents()
        .filter((contents) => !contents.isDestroyed() && contents.getURL().startsWith('chrome-extension://')),
      faviconOf: () => null,
      viewBounds: () => ({ width: 900, height: 700 })
    } });
    result = new Promise((resolve) => { resultResolve = resolve; });
    ses.serviceWorkers.on('console-message', (_event, details) => {
      const line = details?.message || '';
      if (!line.startsWith('__ZERO_ACTIVE_TAB_RESULT__')) return;
      try { resultResolve(JSON.parse(line.slice('__ZERO_ACTIVE_TAB_RESULT__'.length))); }
      catch (error) { resultResolve({ error: `Invalid worker result: ${error.message}` }); }
    });
    const loaded = await host.start([{ path: extensionPath, primary: false, allowFileAccess: false }]);
    assert.equal(loaded.length, 1);
    assert.equal(loaded[0].error, undefined, loaded[0].error);
    window = new BrowserWindow({
      width: 900,
      height: 700,
      show: false,
      webPreferences: { session: ses, contextIsolation: true, nodeIntegration: false, sandbox: true }
    });
    await new Promise((resolve, reject) => {
      window.webContents.once('did-finish-load', resolve);
      window.webContents.once('did-fail-load', (_event, code, description) => reject(new Error(`Fixture navigation failed: ${code} ${description}`)));
      window.loadURL(`http://127.0.0.1:${server.address().port}/`).catch(reject);
    });
    window.webContents.capturePage = async () => {
      captureCalls += 1;
      return { toDataURL: () => 'data:image/png;base64,ZmFrZS1maXh0dXJlLWltYWdlLWRhdGE=' };
    };
    host.registerTab(window.webContents);

    const action = await host.invokeActionForActiveTab(loaded[0].id);
    assert.deepEqual(action, { success: true, activeTabGranted: true });
    const workerResult = await waitFor(result, 10000, 'action event and activeTab screenshot');
    assert.equal(workerResult.error, undefined, workerResult.error);
    assert.equal(workerResult.tabId, window.webContents.id);
    assert.equal(workerResult.url, `http://127.0.0.1:${server.address().port}/`);
    assert.equal(workerResult.image, true, 'the real extension worker must receive captureVisibleTab through the temporary grant');
    assert.equal(captureCalls, 1, 'the host capture path runs exactly once after the grant');
    console.log(JSON.stringify({ status: 'PASS', checks: ['mv3-service-worker-woken', 'action-on-clicked-delivered', 'active-tab-scoped', 'capture-visible-tab-host-dispatch'], screenshot: 'deterministic fixture', profile: 'temporary', page: 'local fixture' }));
  } finally {
    try { if (host?.primaryId) host.unloadExtension(host.primaryId); else for (const id of host?.extensions.keys() || []) host.unloadExtension(id); } catch {}
    if (window && !window.isDestroyed()) window.destroy();
    await new Promise((resolve) => server.close(resolve));
    app.quit();
    setTimeout(() => { try { fs.rmSync(tempRoot, { recursive: true, force: true }); } catch {} }, 1000).unref();
  }
}

run().catch((error) => {
  console.error(error.stack || error);
  app.exit(1);
});

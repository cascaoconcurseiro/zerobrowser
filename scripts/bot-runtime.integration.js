const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const WebSocket = require('ws');

const root = path.resolve(__dirname, '..');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'zero-bot-runtime-'));
const appData = path.join(scratch, 'appdata');
const profileRoot = path.join(scratch, 'profiles');
const botData = path.join(profileRoot, 'bot-fixture');
const fixtureData = new Map();
let child;
let cdpPort;

const site = http.createServer((req, res) => {
  const html = fixtureData.get(new URL(req.url, 'http://127.0.0.1').pathname);
  res.writeHead(html ? 200 : 404, { 'content-type': 'text/html; charset=utf-8' });
  res.end(html || 'fixture not found');
});

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.json();
}

async function waitForTarget(endpoint, predicate, timeoutMs = 30000) {
  const until = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < until) {
    if (child?.exitCode !== null) throw new Error(`Zero Browser saiu durante o teste (${child?.exitCode})`);
    try {
      const target = (await getJson(`${endpoint}/json/list`)).find(predicate);
      if (target) return target;
    } catch (error) { lastError = error; }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Alvo CDP não apareceu: ${lastError?.message || 'timeout'}`);
}

async function waitForPageElement(target, selector) {
  const found = await evaluate(target, `new Promise(resolve=>{const until=Date.now()+15000;const poll=()=>{if(document.readyState==='complete'&&document.querySelector(${JSON.stringify(selector)})){resolve(true);return}if(Date.now()>=until){resolve(false);return}setTimeout(poll,100)};poll()})`);
  assert.equal(found, true, `fixture carregou o seletor ${selector}`);
}

function evaluate(target, expression, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    const id = Math.floor(Math.random() * 1e9);
    const timer = setTimeout(() => { socket.close(); reject(new Error('Timeout CDP')); }, timeoutMs);
    socket.on('open', () => socket.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } })));
    socket.on('message', (raw) => {
      const message = JSON.parse(raw.toString());
      if (message.id !== id) return;
      clearTimeout(timer);
      socket.close();
      if (message.error) return reject(new Error(message.error.message));
      if (message.result?.exceptionDetails) return reject(new Error(message.result.exceptionDetails.text));
      resolve(message.result?.result?.value);
    });
    socket.on('error', (error) => { clearTimeout(timer); reject(error); });
  });
}

async function allocatePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function stopApp() {
  if (!child || child.exitCode !== null) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  else child.kill('SIGTERM');
  await new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    const timer = setTimeout(resolve, 5000);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
  });
}

async function main() {
  fs.mkdirSync(botData, { recursive: true });
  fs.writeFileSync(path.join(profileRoot, 'perfis.json'), JSON.stringify([{ id: 'bot-fixture', name: 'Bot Fixture', type: 'bot' }]));
  fs.writeFileSync(path.join(botData, 'navegante-config.json'), JSON.stringify({
    'automation.approvalMode': 'allow-all',
    'bot.approvalInitialized': true
  }));
  const sitePort = await listen(site);
  cdpPort = await allocatePort();
  const siteUrl = `http://127.0.0.1:${sitePort}`;
  fixtureData.set('/password', '<!doctype html><title>Sign in</title><label>Senha <input id="password" type="password"></label>');
  fixtureData.set('/login-id', '<!doctype html><title>Sign in to workspace</title><h1>Sign in</h1><p>Continue to your account</p><input id="login-id" type="email" placeholder="Email"><button>Continue</button>');
  const electron = require('electron');
  child = spawn(electron, [root, `--remote-debugging-port=${cdpPort}`, '--no-first-run'], {
    cwd: root,
    windowsHide: false,
    env: {
      ...process.env,
      APPDATA: appData,
      ZERO_USER_DATA: botData,
      ZERO_TEST_PROFILES_ROOT: profileRoot,
    },
    stdio: 'ignore'
  });
  const endpoint = `http://127.0.0.1:${cdpPort}`;
  const mainTarget = await waitForTarget(endpoint, (target) => target.type === 'page' && target.url.endsWith('/index.html'));
  const ready = await evaluate(mainTarget, `new Promise(resolve=>{const poll=()=>{if(window.navegante?.automation&&window.zeroBrowser?.ai)resolve(true);else setTimeout(poll,100)};poll()})`);
  assert.equal(ready, true, 'bridge do app pronto');
  const appInfo = await evaluate(mainTarget, `window.navegante.browser.getAppInfo()`);
  assert.equal(appInfo.profile, 'Bot Fixture', 'Electron reconhece o perfil isolado como Bot');
  const approvalMode = await evaluate(mainTarget, `window.navegante.store.get('automation.approvalMode')`);
  assert.equal(approvalMode, 'allow-all', 'fixture simula nível amplo previamente aprovado, apenas para validar que bloqueios técnicos do Bot continuam ativos');
  const results = [];
  for (const current of ['password', 'login-id']) {
    const targetUrl = `${siteUrl}/${current}`;
    const tab = await evaluate(mainTarget, `window.navegante.browser.newTab(${JSON.stringify(targetUrl)})`);
    await evaluate(mainTarget, `window.navegante.browser.switchTab(${JSON.stringify(tab.tabId)})`);
    const pageTarget = await waitForTarget(endpoint, (target) => target.type === 'page' && target.url === targetUrl);
    await waitForPageElement(pageTarget, current === 'password' ? '#password' : '#login-id');
    const result = await evaluate(mainTarget, `window.navegante.automation.execute({tabId:${JSON.stringify(tab.tabId)},kind:'set_value',elementIndex:0,value:'fixture-secret'})`);
    const value = await evaluate(pageTarget, `document.querySelector(${JSON.stringify(current === 'password' ? '#password' : '#login-id')})?.value || ''`);
    assert.equal(value, '', `${current}: o valor de autenticação deve permanecer vazio`);
    assert.equal(result.success, false, `${current}: preenchimento de credencial recusado`);
    assert.match(result.error, /credencia|senha|autentica/i);
    results.push({ scenario: current, valueStayedEmpty: true, refusal: result.error });
    await evaluate(mainTarget, `window.navegante.browser.closeTab(${JSON.stringify(tab.tabId)})`);
  }

  console.log(JSON.stringify({ status: 'PASS', profile: appInfo.profile, approvalMode: 'allow-all seeded only in temporary fixture to exercise technical denial', site: 'loopback fixtures', credentialAttempts: results }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ status: 'FAIL', error: error.stack || String(error), scratch }, null, 2));
  process.exitCode = 1;
}).finally(async () => {
  await stopApp();
  if (site.listening) await new Promise((resolve) => site.close(resolve));
  const safeScratch = path.resolve(scratch);
  if (path.dirname(safeScratch) === path.resolve(os.tmpdir()) && path.basename(safeScratch).startsWith('zero-bot-runtime-')) fs.rmSync(safeScratch, { recursive: true, force: true });
});

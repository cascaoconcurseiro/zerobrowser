const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const WebSocket = require('ws');
const { AutomationService } = require('../src/automation/service');
const { automationPipePath, pipeTokenPath } = require('../src/automation/pipe-path');

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

async function requestMcp(method, params = {}) {
  const token = fs.readFileSync(pipeTokenPath(botData), 'utf8').trim();
  assert.match(token, /^[a-f0-9]{64}$/i, 'MCP token exists only inside the temporary Bot fixture');
  const request = { jsonrpc: '2.0', id: `${Date.now()}-${Math.random()}`, method, params };
  const socket = net.createConnection(automationPipePath(botData));
  socket.setEncoding('utf8');
  return await new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`MCP timeout for ${method}`));
    }, 5000);
    const finish = (error, result) => {
      clearTimeout(timer);
      socket.destroy();
      if (error) reject(error);
      else resolve(result);
    };
    socket.once('connect', () => socket.write(`${token}\n${JSON.stringify(request)}\n`));
    socket.on('data', (chunk) => {
      buffer += chunk;
      const newline = buffer.indexOf('\n');
      if (newline < 0) return;
      try {
        const response = JSON.parse(buffer.slice(0, newline));
        assert.equal(response.id, request.id, `MCP request ID for ${method}`);
        if (response.error) return finish(new Error(response.error.message));
        finish(null, response.result);
      } catch (error) { finish(error); }
    });
    socket.once('error', (error) => finish(error));
  });
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

async function waitForPageValue(target, expression, predicate, timeoutMs = 10000) {
  const until = Date.now() + timeoutMs;
  let value;
  while (Date.now() < until) {
    value = await evaluate(target, expression);
    if (predicate(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Valor da página não atingiu a condição esperada: ${JSON.stringify(value)}`);
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
    'developer.cdpEnabled': true
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
  const defaultApprovalMode = await evaluate(mainTarget, `window.navegante.store.get('automation.approvalMode')`);
  assert.equal(defaultApprovalMode, 'always-ask', 'Bot novo inicia com aprovação conservadora');
  await evaluate(mainTarget, `document.getElementById('btn-settings').click()`);
  await waitForPageValue(mainTarget, `!document.getElementById('settings-panel').classList.contains('hidden')`, Boolean);
  const panelApprovalToggle = await evaluate(mainTarget, `document.getElementById('setting-agent-approval-in-panel').checked`);
  assert.equal(panelApprovalToggle, false, 'A aprovação no chat começa desativada e pode ser ligada pelo usuário');
  await evaluate(mainTarget, `(()=>{const input=document.getElementById('setting-agent-approval-in-panel');input.checked=true;input.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
  await waitForPageValue(mainTarget, `window.navegante.store.get('automation.approvalInPanel')`, (enabled) => enabled === true);
  await evaluate(mainTarget, `(()=>{window.__approvalConfirmCalls=0;window.confirm=()=>{window.__approvalConfirmCalls++;return false};const select=document.getElementById('setting-agent-approval-mode');select.value='allow-all';select.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
  await waitForPageValue(mainTarget, `document.getElementById('setting-agent-approval-mode').value`, (mode) => mode === 'always-ask');
  assert.equal(await evaluate(mainTarget, `window.navegante.store.get('automation.approvalMode')`), 'always-ask', 'Recusar o aumento mantém a autonomia atual');
  assert.equal(await evaluate(mainTarget, `window.__approvalConfirmCalls`), 1, 'Elevar autonomia exige aceite humano');
  await evaluate(mainTarget, `(()=>{window.confirm=()=>{window.__approvalConfirmCalls++;return true};const select=document.getElementById('setting-agent-approval-mode');select.value='allow-all';select.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
  await waitForPageValue(mainTarget, `window.navegante.store.get('automation.approvalMode')`, (mode) => mode === 'allow-all');
  await evaluate(mainTarget, `(()=>{const select=document.getElementById('setting-agent-approval-mode');select.value='always-ask';select.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
  await waitForPageValue(mainTarget, `window.navegante.store.get('automation.approvalMode')`, (mode) => mode === 'always-ask');
  assert.equal(await evaluate(mainTarget, `window.__approvalConfirmCalls`), 2, 'Reduzir autonomia não exige confirmação adicional');
  await evaluate(mainTarget, `document.getElementById('btn-close-settings').click()`);
  await waitForPageValue(mainTarget, `document.getElementById('settings-panel').classList.contains('hidden')`, Boolean);
  await evaluate(mainTarget, `document.getElementById('btn-ai').click()`);
  await waitForPageValue(mainTarget, `!document.getElementById('ai-panel').classList.contains('hidden')`, Boolean);
  await evaluate(mainTarget, `window.navegante.store.set('automation.approvalMode','allow-all')`);
  const approvalMode = await evaluate(mainTarget, `window.navegante.store.get('automation.approvalMode')`);
  assert.equal(approvalMode, 'allow-all', 'O restante deste teste exercita bloqueios técnicos em perfil Bot sob allow-all');
  const mcpTools = await requestMcp('tools/list');
  const baselineService = new AutomationService();
  baselineService.registerTools();
  const expectedToolNames = baselineService.listTools().tools.map((tool) => tool.name).sort();
  const botToolNames = mcpTools.tools.map((tool) => tool.name).sort();
  assert.deepEqual(botToolNames, expectedToolNames, 'Bot anuncia o mesmo catálogo MCP geral; as restrições são aplicadas ao executar cada ferramenta');
  assert.ok(botToolNames.includes('browser_type'), 'o catálogo MCP inclui browser_type no perfil Bot');
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
    const mcpResult = await requestMcp('tools/call', {
      name: 'browser_type',
      arguments: { tabId: tab.tabId, elementIndex: 0, text: 'fixture-mcp-secret' }
    });
    assert.equal(mcpResult.isError, true, `${current}: chamada MCP deve retornar erro de execução`);
    assert.equal(mcpResult.structuredContent.success, false, `${current}: chamada MCP deve ser recusada pelo guard do Bot`);
    assert.match(mcpResult.structuredContent.error, /credencia|senha|autentica/i);
    const valueAfterMcp = await evaluate(pageTarget, `document.querySelector(${JSON.stringify(current === 'password' ? '#password' : '#login-id')})?.value || ''`);
    assert.equal(valueAfterMcp, '', `${current}: valor continua vazio após tentativa via MCP`);
    let highRiskMcp = null;
    if (current === 'password') {
      highRiskMcp = await requestMcp('tools/call', {
        name: 'browser_cdp_send',
        arguments: { tabId: tab.tabId, method: 'Runtime.evaluate', params: { expression: "document.body.dataset.botGuard='bypassed'" } }
      });
      assert.equal(highRiskMcp.isError, true, 'Bot: Runtime.evaluate via MCP deve retornar erro de execução');
      assert.equal(highRiskMcp.structuredContent.success, false, 'Bot: guard deve recusar CDP bruto mesmo com CDP habilitado e allow-all');
      assert.match(highRiskMcp.structuredContent.error, /CDP.*desativados.*bot/i);
      const bodyMarker = await evaluate(pageTarget, "document.body.dataset.botGuard || ''");
      assert.equal(bodyMarker, '', 'CDP recusado não altera o DOM fixture');
    }
    results.push({ scenario: current, valueStayedEmpty: true, ipcRefusal: result.error, mcpRefusal: mcpResult.structuredContent.error, ...(highRiskMcp ? { rawCdpMcpRefusal: highRiskMcp.structuredContent.error, domUnchangedAfterCdp: true } : {}) });
    await evaluate(mainTarget, `window.navegante.browser.closeTab(${JSON.stringify(tab.tabId)})`);
  }

  await assert.rejects(requestMcp('tools/call', {
    name: 'fixture_missing_tool', arguments: {}
  }), /Unknown tool: fixture_missing_tool/);
  const mcpAfterError = await requestMcp('ping');
  assert.deepEqual(mcpAfterError, {}, 'o pipe MCP continua atendendo depois de um erro de ferramenta');
  const toolsAfterRefusals = await requestMcp('tools/list');
  assert.equal(toolsAfterRefusals.tools.length, botToolNames.length, 'MCP continua atendendo após recusas de credencial/CDP e erro de ferramenta');

  console.log(JSON.stringify({ status: 'PASS', profile: appInfo.profile, autonomy: { default: defaultApprovalMode, increaseRequiresHumanAcceptance: true, decreaseDoesNotAsk: true }, approvalInChat: 'explicit opt-in confirmed through the UI', approvalModeForTechnicalGuards: approvalMode, mcpToolCount: botToolNames.length, mcpCatalogMatchesBaseline: true, site: 'loopback fixtures', credentialAttempts: results, mcpRecoveredAfterRefusalsAndToolError: true }, null, 2));
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

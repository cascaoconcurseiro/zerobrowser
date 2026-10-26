const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const WebSocket = require('ws');

const executable = process.argv[2] || path.join(process.env.LOCALAPPDATA || '', 'Programs', 'navegante-rea-validation', 'Navegante.exe');
const createdAt = Date.now();
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'navegante-installed-agent-'));
const userData = path.join(scratch, 'profile');
const mock = http.createServer();
const observedProviderRequests = [];
const observedSiteRequests = [];
const fixturePages = new Map();
const siteServer = http.createServer((req, res) => {
  observedSiteRequests.push({ url: req.url, dnt: req.headers.dnt, cookie: req.headers.cookie || '' });
  if (req.url.startsWith('/fixture/')) {
    const id = new URL(req.url, 'http://127.0.0.1').pathname.slice('/fixture/'.length);
    const html = fixturePages.get(id);
    res.writeHead(html ? 200 : 404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html || 'Fixture not found');
    return;
  }
  if (req.url.startsWith('/page')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<!doctype html><title>Settings fixture</title><a id="download" href="/download">Download fixture</a>');
    return;
  }
  if (req.url.startsWith('/echo')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ dnt: req.headers.dnt || null, cookie: req.headers.cookie || '' }));
    return;
  }
  if (req.url.startsWith('/download')) {
    res.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Disposition': 'attachment; filename="fixture.txt"' });
    res.end('download fixture verified');
    return;
  }
  res.writeHead(404);
  res.end('not found');
});
let requestCount = 0;
let currentScenario = 'safe-click';
let child = null;
let appOutput = '';
let uiAutomationOutput = '';
let cdpPort = null;
let currentStage = 'startup';
let cuaDiagnostic = null;

function allocatePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function toolCall(name, args, id) {
  return {
    role: 'assistant',
    tool_calls: [{ id, type: 'function', function: { name, arguments: JSON.stringify(args) } }]
  };
}

mock.on('request', (req, res) => {
  if (req.method === 'GET' && req.url === '/v1/models') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ data: [
      { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini fixture', supported_parameters: ['tools', 'tool_choice'], context_length: 128000, pricing: { prompt: '0.15' } },
      { id: 'fixture/no-tools', name: 'Fixture without tools', supported_parameters: ['temperature'] }
    ] }));
    return;
  }
  if (req.method === 'GET' && req.url === '/models') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ data: [{ id: 'deepseek-flash-fixture', name: 'DeepSeek Flash fixture', input_modalities: ['text'], context_window: 64000 }] }));
    return;
  }
  let body = '';
  req.setEncoding('utf8');
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    let requestBody;
    try { requestBody = JSON.parse(body); } catch { requestBody = {}; }
    observedProviderRequests.push({ path: req.url, authorization: req.headers.authorization, model: requestBody.model });
    requestCount++;
    let message;
    if (currentScenario === 'provider-check') message = toolCall('inspect_page', {}, `provider-check-${requestBody.model}`);
    else if (requestCount === 1) message = toolCall('inspect_page', {}, `inspect-${currentScenario}`);
    else if (currentScenario === 'cua-click' && requestCount === 2) message = toolCall('cua_action', { action: 'click', x: 100, y: 65 }, `cua-click-${currentScenario}`);
    else if (requestCount === 2) message = toolCall('click', { index: 0 }, `click-${currentScenario}`);
    else message = { role: 'assistant', content: `Ação confirmada pela fixture instalada (${currentScenario}).` };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message }] }));
  });
});

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} de ${url}`);
  return response.json();
}

async function waitForCdp(endpoint) {
  const deadline = Date.now() + 30000;
  let lastError;
  while (Date.now() < deadline) {
    if (child?.exitCode !== null) throw new Error(`Navegante fechou durante a inicialização (exit ${child?.exitCode})`);
    try { return await getJson(`${endpoint}/json/list`); }
    catch (error) { lastError = error; await new Promise((resolve) => setTimeout(resolve, 250)); }
  }
  throw new Error(`CDP não ficou pronto: ${lastError?.message || 'timeout'}`);
}

function evaluate(target, expression, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    const id = Math.floor(Math.random() * 1e9);
    const timer = setTimeout(() => { socket.terminate(); reject(new Error(`CDP Runtime.evaluate timeout (${timeoutMs} ms; stage=${currentStage}; target=${target.url})`)); }, timeoutMs);
    socket.once('error', (error) => { clearTimeout(timer); reject(error); });
    socket.on('message', (raw) => {
      const message = JSON.parse(raw.toString());
      if (message.id !== id) return;
      clearTimeout(timer);
      socket.close();
      if (message.error) return reject(new Error(message.error.message));
      if (message.result.exceptionDetails) return reject(new Error(message.result.exceptionDetails.text));
      resolve(message.result.result.value);
    });
    socket.once('open', () => socket.send(JSON.stringify({
      id,
      method: 'Runtime.evaluate',
      params: { expression, awaitPromise: true, returnByValue: true, userGesture: true }
    })));
  });
}

async function waitForTarget(endpoint, predicate) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const targets = await getJson(`${endpoint}/json/list`);
    const found = targets.find(predicate);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error('Aba fixture não apareceu no CDP');
}

async function waitForFile(filePath) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try { return await fs.promises.readFile(filePath, 'utf8'); } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Download não apareceu em ${filePath}`);
}

async function waitForCondition(predicate, label, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Tempo esgotado aguardando ${label}`);
}

async function waitForPageValue(target, expression, predicate, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  let value;
  while (Date.now() < deadline) {
    value = await evaluate(target, expression);
    if (predicate(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Valor da página não atingiu a condição esperada: ${JSON.stringify(value)}`);
}

function clickNativeApprovalButton(buttonName) {
  const script = `
    Add-Type -AssemblyName UIAutomationClient
    Add-Type -AssemblyName UIAutomationTypes
    Add-Type -AssemblyName System.Windows.Forms
    $ErrorActionPreference = 'Stop'
    $root = [System.Windows.Automation.AutomationElement]::RootElement
    $windowCondition = [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::NameProperty, 'Confirmação de ação do navegador')
    $buttonCondition = [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::NameProperty, '${buttonName}')
    $deadline = [DateTime]::UtcNow.AddSeconds(35)
    while ([DateTime]::UtcNow -lt $deadline) {
      $window = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $windowCondition)
      if ($window) {
        $button = $window.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $buttonCondition)
        if ($button) {
        Write-Output "WINDOW=$($window.Current.Name); BUTTON=$($button.Current.Name); PID=$($button.Current.ProcessId); RECT=$($button.Current.BoundingRectangle)"
        try {
          $button.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
        } catch {
          $button.SetFocus()
          [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
        }
        exit 0
        }
      }
      Start-Sleep -Milliseconds 150
    }
    $windows = $root.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)
    foreach ($window in $windows) { Write-Output "WINDOW=$($window.Current.Name)" }
    exit 2
  `;
  return new Promise((resolve, reject) => {
    const automation = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let diagnostic = '';
    automation.stdout.on('data', (chunk) => { diagnostic += chunk.toString(); });
    automation.stderr.on('data', (chunk) => { diagnostic += chunk.toString(); });
    const timer = setTimeout(() => {
      automation.kill();
      reject(new Error(`Diálogo nativo ou botão '${buttonName}' não encontrado`));
    }, 40000);
    automation.once('error', (error) => { clearTimeout(timer); reject(error); });
    automation.once('exit', (code) => {
      clearTimeout(timer);
      uiAutomationOutput += diagnostic;
      if (code === 0) resolve();
      else reject(new Error(`Automação UIA do botão '${buttonName}' encerrou com código ${code}. ${diagnostic.trim()}`));
    });
  });
}

async function closeApp() {
  if (!child || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  } else {
    child.kill('SIGTERM');
  }
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 5000);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
  });
}

async function main() {
  assert.equal(fs.existsSync(executable), true, `Executável instalado não encontrado: ${executable}`);
  siteServer.listen(0, '127.0.0.1');
  await new Promise((resolve) => siteServer.once('listening', resolve));
  const siteUrl = `http://127.0.0.1:${siteServer.address().port}`;
  const registerFixture = (html) => {
    const id = `fixture-${fixturePages.size + 1}`;
    fixturePages.set(id, html);
    return `${siteUrl}/fixture/${id}`;
  };
  mock.listen(0, '127.0.0.1');
  await new Promise((resolve) => mock.once('listening', resolve));
  const mockUrl = `http://127.0.0.1:${mock.address().port}/v1/chat/completions`;
  cdpPort = await allocatePort();
  const endpoint = `http://127.0.0.1:${cdpPort}`;
  const appArgs = [
    `--user-data-dir=${userData}`,
    `--remote-debugging-port=${cdpPort}`,
    '--no-first-run'
  ];
  const childEnv = {
    ...process.env,
    NAVEGANTE_USER_DATA: userData,
    NAVEGANTE_TEST_OPENROUTER_URL: mockUrl,
    NAVEGANTE_TEST_OPENROUTER_MODELS_URL: new URL('/v1/models', mockUrl).href,
    NAVEGANTE_TEST_DEEPSEEK_URL: mockUrl,
    NAVEGANTE_TEST_DEEPSEEK_MODELS_URL: new URL('/models', mockUrl).href
  };
  child = spawn(executable, appArgs, {
    windowsHide: false,
    env: childEnv
  });
  child.stdout?.on('data', (chunk) => { appOutput += chunk.toString(); });
  child.stderr?.on('data', (chunk) => { appOutput += chunk.toString(); });
  child.on('error', () => {});

  const targets = await waitForCdp(endpoint);
  const mainTarget = await waitForTarget(endpoint, (target) => target.type === 'page' && target.url.startsWith('file://') && target.url.endsWith('/index.html'));
  const second = spawn(executable, appArgs, { windowsHide: true, env: childEnv });
  const secondExit = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Segunda instância não encerrou no tempo esperado')), 10000);
    second.once('error', (error) => { clearTimeout(timer); reject(error); });
    second.once('exit', (code) => { clearTimeout(timer); resolve(code); });
  });
  assert.equal(secondExit, 0, 'A segunda instância encerrou após o single-instance lock');
  assert.equal(child.exitCode, null, 'A instância principal continuou ativa');
  assert.ok((await getJson(`${endpoint}/json/list`)).some((target) => target.id === mainTarget.id), 'A janela original continua disponível após o segundo lançamento');

  const providerValidation = {};
  await waitForPageValue(mainTarget, `({readyState: document.readyState, appType: typeof window.app, tabId: window.app?.activeTabId ?? null, apiType: typeof window.navegante, address: document.getElementById('address-bar')?.value || ''})`, (value) => value.appType === 'object' && Boolean(value.tabId) && value.apiType === 'object');
  currentStage = 'newtab-route';
  const internalNewTab = JSON.parse(await evaluate(mainTarget, `window.navegante.browser.newTab('zero://newtab').then(JSON.stringify)`));
  assert.ok(internalNewTab.tabId, 'A página interna de nova aba passa pela validação segura do IPC');
  const internalNewTabTarget = await waitForTarget(endpoint, (target) => target.type === 'page' && target.url.endsWith('/newtab.html'));
  await waitForPageValue(internalNewTabTarget, `document.readyState === 'complete' && document.title === 'Novo Separador · Zero Browser'`, Boolean);
  assert.equal(await evaluate(internalNewTabTarget, `document.title`), 'Novo Separador · Zero Browser');
  assert.equal(await evaluate(internalNewTabTarget, `Boolean(document.getElementById('search-form') && document.getElementById('search-input'))`), true);
  await evaluate(mainTarget, `window.navegante.browser.closeTab(${JSON.stringify(internalNewTab.tabId)})`);
  const extensionList = await evaluate(mainTarget, `window.navegante.extensions.list()`);
  assert.ok(Array.isArray(extensionList), 'O IPC do gerenciador de extensões responde no executável instalado');
  currentStage = 'openrouter-model-catalog-ui';
  await evaluate(mainTarget, `document.getElementById('btn-ai').click()`);
  await waitForPageValue(mainTarget, `({visible: !document.getElementById('ai-panel').classList.contains('hidden'), placeholder: document.getElementById('ai-api-key')?.placeholder || '', status: document.getElementById('ai-model-status')?.textContent || ''})`, (value) => value.visible && value.placeholder.includes('OpenRouter') && value.status.includes('Salvar chave'));
  const aiPanelBounds = await waitForPageValue(mainTarget, `window.navegante.browser.getSidePanelLayout()`, (value) => value.open && Boolean(value.bounds));
  assert.equal(aiPanelBounds.open, true, 'O processo principal reservou a lateral para o painel de IA');
  const rendererWidth = await evaluate(mainTarget, `window.innerWidth`);
  assert.ok(aiPanelBounds.bounds?.width < rendererWidth, 'A WebContentsView da página não cobre os controles laterais');
  await evaluate(mainTarget, `document.getElementById('btn-close-ai').click()`);
  await waitForPageValue(mainTarget, `document.getElementById('ai-panel').classList.contains('hidden')`, Boolean);
  const closedPanelBounds = await waitForPageValue(mainTarget, `window.navegante.browser.getSidePanelLayout()`, (value) => !value.open);
  assert.equal(closedPanelBounds.open, false, 'Fechar o painel restaura o layout do navegador');
  await evaluate(mainTarget, `document.getElementById('btn-settings').click()`);
  await waitForPageValue(mainTarget, `!document.getElementById('settings-panel').classList.contains('hidden')`, Boolean);
  const settingsPanelBounds = await waitForPageValue(mainTarget, `window.navegante.browser.getSidePanelLayout()`, (value) => value.open && Boolean(value.bounds));
  assert.ok(settingsPanelBounds.bounds?.width < rendererWidth, 'A WebContentsView também deixa os controles de configurações acessíveis');
  await evaluate(mainTarget, `document.getElementById('btn-close-settings').click()`);
  await waitForPageValue(mainTarget, `document.getElementById('settings-panel').classList.contains('hidden')`, Boolean);
  await waitForPageValue(mainTarget, `window.navegante.browser.getSidePanelLayout()`, (value) => !value.open);
  await evaluate(mainTarget, `document.getElementById('btn-ai').click()`);
  await waitForPageValue(mainTarget, `!document.getElementById('ai-panel').classList.contains('hidden')`, Boolean);
  await evaluate(mainTarget, `(()=>{document.getElementById('ai-api-key').value='mock-local-openrouter-key';document.getElementById('btn-ai-refresh-models').click();return true})()`);
  await waitForPageValue(mainTarget, `Boolean(document.querySelector('#ai-model option[value="openai/gpt-4o-mini"]'))`, Boolean);
  providerValidation.openrouterCatalogModels = await evaluate(mainTarget, `document.querySelectorAll('#ai-model option').length`);
  assert.equal(await evaluate(mainTarget, `document.querySelector('#ai-model option[value="fixture/no-tools"]')?.disabled`), true, 'Modelos conhecidos sem chamadas de ferramenta aparecem desabilitados');
  assert.equal(await evaluate(mainTarget, `document.querySelector('#ai-model option[value="openai/gpt-4o-mini"]')?.disabled`), false, 'Modelo compatível aparece selecionável');
  currentScenario = 'provider-check';
  requestCount = 0;
  await evaluate(mainTarget, `document.getElementById('btn-ai-connect').click()`);
  await waitForPageValue(mainTarget, `window.app?.aiConnected === true`, Boolean);
  assert.ok(observedProviderRequests.some((request) => request.path === '/v1/chat/completions' && request.authorization === 'Bearer mock-local-openrouter-key' && request.model === 'openai/gpt-4o-mini'), 'Configuração OpenRouter chegou ao endpoint mock com seu modelo');
  assert.ok((await evaluate(mainTarget, `document.getElementById('ai-api-key').placeholder`)).includes('key'), 'Interface mostra uma dica mascarada da chave OpenRouter salva');
  await evaluate(mainTarget, `document.getElementById('btn-ai-toggle-key').click()`);
  assert.equal(await evaluate(mainTarget, `document.getElementById('ai-api-key').value`), 'mock-local-openrouter-key', 'A ação explícita Mostrar revela a chave OpenRouter vinculada');
  await evaluate(mainTarget, `document.getElementById('btn-ai-toggle-key').click()`);
  assert.equal(await evaluate(mainTarget, `document.getElementById('ai-api-key').value`), '', 'Ocultar limpa a chave revelada OpenRouter do campo');
  assert.equal(await evaluate(mainTarget, `window.navegante.store.get('automation.openrouterApiKey').then(()=>false,()=>true)`), true, 'Renderer não consegue ler a chave cifrada pelo IPC genérico');

  currentStage = 'deepseek-provider-ui';
  await evaluate(mainTarget, `(()=>{const provider=document.getElementById('ai-provider');provider.value='deepseek';provider.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
  await waitForPageValue(mainTarget, `document.getElementById('ai-api-key')?.placeholder || ''`, (value) => value.includes('DeepSeek'));
  await evaluate(mainTarget, `(()=>{document.getElementById('ai-api-key').value='mock-local-deepseek-key';document.getElementById('btn-ai-save-key').click();return true})()`);
  await waitForPageValue(mainTarget, `document.getElementById('ai-model-status')?.textContent || ''`, (value) => value.includes('Chave salva com segurança'));
  assert.equal(await evaluate(mainTarget, `document.getElementById('ai-api-key').value`), '', 'Salvar a chave a limpa do campo visível');
  assert.equal(await evaluate(mainTarget, `window.navegante.ai.getConfig('deepseek').then(config=>config.hasApiKey)`), true, 'A chave DeepSeek fica salva mesmo sem conectar um modelo');
  assert.ok((await evaluate(mainTarget, `document.getElementById('ai-api-key').placeholder`)).includes('Salva: ••••••••-key'), 'Interface mostra os últimos quatro caracteres da chave DeepSeek salva');
  await evaluate(mainTarget, `document.getElementById('btn-ai-toggle-key').click()`);
  assert.equal(await evaluate(mainTarget, `document.getElementById('ai-api-key').value`), 'mock-local-deepseek-key', 'A ação explícita Mostrar revela a chave DeepSeek vinculada');
  await evaluate(mainTarget, `document.getElementById('btn-ai-toggle-key').click()`);
  assert.equal(await evaluate(mainTarget, `document.getElementById('ai-api-key').value`), '', 'Ocultar limpa a chave revelada DeepSeek do campo');
  await evaluate(mainTarget, `document.getElementById('btn-ai-refresh-models').click()`);
  await waitForPageValue(mainTarget, `Boolean(document.querySelector('#ai-model option[value="deepseek-flash-fixture"]'))`, Boolean);
  providerValidation.deepseekCatalogModels = await evaluate(mainTarget, `document.querySelectorAll('#ai-model option').length`);
  currentScenario = 'provider-check';
  requestCount = 0;
  await evaluate(mainTarget, `document.getElementById('btn-ai-connect').click()`);
  await waitForPageValue(mainTarget, `window.app?.aiConnected === true`, Boolean);
  assert.ok(observedProviderRequests.some((request) => request.path === '/v1/chat/completions' && request.authorization === 'Bearer mock-local-deepseek-key' && request.model === 'deepseek-flash-fixture'), 'Configuração DeepSeek direta chegou ao endpoint mock com sua chave própria');

  await evaluate(mainTarget, `(()=>{const provider=document.getElementById('ai-provider');provider.value='openrouter';provider.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
  await waitForPageValue(mainTarget, `document.getElementById('ai-api-key')?.placeholder || ''`, (value) => value.includes('Salva:') || value.includes('OpenRouter'));
  await waitForPageValue(mainTarget, `Boolean(document.querySelector('#ai-model option[value="openai/gpt-4o-mini"]'))`, Boolean);
  currentScenario = 'safe-click';
  requestCount = 0;

  const fixtureHtml = `<!doctype html><html><head><title>AX fixture</title></head><body><button id="target" onclick="document.body.dataset.clicked='yes'">Continuar</button></body></html>`;
  const fixtureUrl = registerFixture(fixtureHtml);
  const created = JSON.parse(await evaluate(mainTarget, `(async()=>{const tab=await window.navegante.browser.newTab(${JSON.stringify(fixtureUrl)});await window.navegante.browser.switchTab(tab.tabId);return JSON.stringify(tab)})()`));
  assert.ok(created.tabId, 'A aba fixture foi criada pelo processo principal');

  const pageTarget = await waitForTarget(endpoint, (target) => target.type === 'page' && target.url === fixtureUrl);
  const pageBridges = await evaluate(pageTarget, `({browser: typeof window.naveganteBrowser, accessibility: typeof window.naveganteAccessibility})`);
  assert.deepEqual(pageBridges, { browser: 'undefined', accessibility: 'undefined' }, 'a site page must not receive the privileged automation preload');
  const deniedInternalPopup = await evaluate(pageTarget, `window.open('zero://unrecognized-internal-page') === null`);
  assert.equal(deniedInternalPopup, true, 'site pages cannot open arbitrary Zero Browser internal schemes');
  const unsafeUrlError = await evaluate(mainTarget, `window.navegante.browser.newTab('javascript:document.body.dataset.injected="yes"').then(()=>null,error=>error.message)`);
  assert.match(unsafeUrlError, /HTTP ou HTTPS/, 'renderer IPC must reject executable URL schemes');
  const result = JSON.parse(await evaluate(mainTarget, `window.navegante.automation.runAgent(${JSON.stringify(created.tabId)},'Clique em Continuar na fixture.',false).then(JSON.stringify)`));
  assert.equal(result.success, true, result.error || result.message);
  assert.match(result.message, /confirmada pela fixture instalada/);
  assert.equal(requestCount, 3, 'O agente fez inspeção, ação e confirmação final via provedor local');
  const clicked = await evaluate(pageTarget, `document.body.dataset.clicked || ''`);
  assert.equal(clicked, 'yes', 'O clique AX alterou de fato a página instalada');
  await evaluate(mainTarget, `window.navegante.browser.closeTab(${JSON.stringify(created.tabId)})`);

  currentStage = 'verify-cua-input';
  currentScenario = 'cua-click';
  requestCount = 0;
  const cuaHtml = `<!doctype html><html><head><title>CUA fixture</title><style>body{margin:0}button{position:absolute;left:40px;top:40px;width:120px;height:50px}</style></head><body><button id="visual" onclick="document.body.dataset.cuaClicked='trusted'">Visual fallback</button></body></html>`;
  const cuaUrl = registerFixture(cuaHtml);
  const cuaTab = JSON.parse(await evaluate(mainTarget, `(async()=>{const tab=await window.navegante.browser.newTab(${JSON.stringify(cuaUrl)});await window.navegante.browser.switchTab(tab.tabId);return JSON.stringify(tab)})()`));
  await evaluate(mainTarget, `(()=>{if(document.getElementById('ai-panel').classList.contains('hidden'))document.getElementById('btn-ai-toggle').click();return true})()`);
  const cuaPage = await waitForTarget(endpoint, (target) => target.type === 'page' && target.url === cuaUrl);
  await waitForPageValue(cuaPage, `document.readyState === 'complete' && Boolean(document.getElementById('visual'))`, Boolean);
  const freezeRaceState = await evaluate(mainTarget, `(()=>{const freezing=window.navegante.browser.freezePage(true,'panel');const releasing=window.navegante.browser.freezePage(false,'panel');return Promise.all([freezing,releasing]).then(()=>window.navegante.browser.getSidePanelLayout())})()`);
  assert.equal(freezeRaceState.frozen, false, `Fechar o painel durante a captura não pode deixar a aba congelada: ${JSON.stringify(freezeRaceState)}`);
  assert.ok(freezeRaceState.bounds?.height > 0, `A view continua dimensionada depois da corrida de congelamento: ${JSON.stringify(freezeRaceState)}`);
  await waitForPageValue(cuaPage, `innerWidth > 0 && innerHeight > 0 && document.elementFromPoint(100,65)?.id === 'visual'`, Boolean, 15000);
  cuaDiagnostic = await evaluate(cuaPage, `(()=>{const e=document.getElementById('visual'),r=e.getBoundingClientRect(),h=document.elementFromPoint(100,65);return {readyState:document.readyState,innerWidth,innerHeight,rect:{x:r.x,y:r.y,width:r.width,height:r.height},hitId:h?.id||'',focused:document.hasFocus(),buttonText:e.innerText}})()`);
  assert.ok(cuaDiagnostic.innerWidth > 0 && cuaDiagnostic.innerHeight > 0, `A página CUA precisa permanecer visível com o painel da IA aberto: ${JSON.stringify(cuaDiagnostic)}`);
  assert.equal(cuaDiagnostic.hitId, 'visual', `As coordenadas CUA precisam atingir o botão da fixture: ${JSON.stringify(cuaDiagnostic)}`);
  let cuaAgentResult;
  await evaluate(mainTarget, `(()=>{window.__cuaRunResult=null;window.navegante.automation.runAgent(${JSON.stringify(cuaTab.tabId)},'Use CUA para clicar no botão Visual fallback na fixture.',false).then(result=>{window.__cuaRunResult=result});return true})()`);
  await waitForCondition(() => requestCount >= 3, 'a resposta final do provedor depois do CUA');
  await waitForPageValue(mainTarget, 'Boolean(window.__cuaRunResult)', Boolean);
  cuaAgentResult = JSON.parse(await evaluate(mainTarget, 'JSON.stringify(window.__cuaRunResult)'));
  assert.equal(cuaAgentResult.success, true, cuaAgentResult.error || cuaAgentResult.message);
  const cuaInput = await evaluate(cuaPage, `document.body.dataset.cuaClicked || ''`);
  assert.equal(cuaInput, 'trusted', 'O CDP Input dispatch executou o clique visual na página instalada');
  assert.equal(requestCount, 3, 'O agente inspecionou a página, usou CUA e recebeu confirmação final');
  await evaluate(mainTarget, `window.navegante.browser.closeTab(${JSON.stringify(cuaTab.tabId)})`);
  currentScenario = 'safe-click';

  currentStage = 'create-settings-tab';
  const settingsTab = JSON.parse(await evaluate(mainTarget, `(async()=>{const tab=await window.navegante.browser.newTab(${JSON.stringify(`${siteUrl}/page?settings=1`)});await window.navegante.browser.switchTab(tab.tabId);return JSON.stringify(tab)})()`));
  currentStage = 'wait-settings-target';
  const settingsTarget = await waitForTarget(endpoint, (target) => target.type === 'page' && target.url.startsWith(`${siteUrl}/page?settings=1`));
  const settingsTabVisible = await evaluate(mainTarget, `Boolean(document.querySelector('[data-tab-id="${settingsTab.tabId}"]'))`);
  assert.equal(settingsTabVisible, true, 'A aba criada pela API do browser aparece na barra de abas');
  const expectedShortUrl = `${siteUrl.slice('http://'.length)}/page?settings=1`;
  currentStage = 'verify-short-url';
  let shortUrl = '';
  const addressDeadline = Date.now() + 10000;
  while (Date.now() < addressDeadline) {
    shortUrl = await evaluate(mainTarget, `document.getElementById('address-bar').value`);
    if (shortUrl === expectedShortUrl) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(shortUrl, expectedShortUrl, 'A barra oculta scheme HTTP por padrão');
  currentStage = 'set-full-url';
  await evaluate(mainTarget, `(()=>{const input=document.getElementById('setting-show-full-url');input.checked=true;input.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
  const fullUrl = await evaluate(mainTarget, `new Promise((resolve)=>{const check=async()=>{const v=await window.navegante.store.get('browser.showFullUrl');if(v===true)return resolve(document.getElementById('address-bar').value);setTimeout(check,50)};check()})`);
  assert.equal(fullUrl, `${siteUrl}/page?settings=1`, 'A preferência mostra a URL completa depois da alteração');
  await evaluate(mainTarget, `(()=>{const select=document.getElementById('setting-theme');select.value='light';select.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
  const lightTheme = await evaluate(mainTarget, `new Promise((resolve)=>{const check=async()=>{const v=await window.navegante.store.get('theme');if(v==='light')return resolve({dark:document.body.classList.contains('dark'),background:getComputedStyle(document.body).backgroundColor});setTimeout(check,50)};check()})`);
  assert.deepEqual(lightTheme, { dark: false, background: 'rgb(243, 244, 242)' });
  await evaluate(mainTarget, `(()=>{const toggle=document.getElementById('setting-do-not-track');toggle.checked=false;toggle.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
  const noDnt = await evaluate(settingsTarget, `fetch('/echo?dnt-off=1').then(r=>r.json())`);
  assert.equal(noDnt.dnt, null, 'Desativar Não rastrear remove o cabeçalho de requests subsequentes');
  await evaluate(mainTarget, `(()=>{const toggle=document.getElementById('setting-do-not-track');toggle.checked=true;toggle.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
  const withDnt = await evaluate(settingsTarget, `fetch('/echo?dnt-on=1').then(r=>r.json())`);
  assert.equal(withDnt.dnt, '1', 'Ativar Não rastrear adiciona DNT=1 nas requests subsequentes');

  const downloadDirectory = path.join(scratch, 'downloads');
  fs.mkdirSync(downloadDirectory, { recursive: true });
  await evaluate(mainTarget, `Promise.all([window.navegante.store.set('downloads.path',${JSON.stringify(downloadDirectory)}),window.navegante.store.set('downloads.prompt',false)])`);
  await evaluate(settingsTarget, `document.getElementById('download').click(); true`);
  const downloadedText = await waitForFile(path.join(downloadDirectory, 'fixture.txt'));
  assert.equal(downloadedText, 'download fixture verified', 'Download usa a pasta configurada e preserva o conteúdo');
  await evaluate(mainTarget, `window.navegante.browser.closeTab(${JSON.stringify(settingsTab.tabId)})`);

  async function verifySensitiveDecision(scenario, approvalButton, expectSubmitted) {
    currentScenario = scenario;
    requestCount = 0;
    const formHtml = `<!doctype html><html><head><title>Approval fixture ${scenario}</title></head><body><form onsubmit="event.preventDefault();document.body.dataset.submitted='yes'"><button type="submit">Place order</button></form></body></html>`;
    const formUrl = registerFixture(formHtml);
    const formTab = JSON.parse(await evaluate(mainTarget, `(async()=>{const tab=await window.navegante.browser.newTab(${JSON.stringify(formUrl)});await window.navegante.browser.switchTab(tab.tabId);return JSON.stringify(tab)})()`));
    const formTarget = await waitForTarget(endpoint, (target) => target.type === 'page' && target.url === formUrl);
    const resultPromise = evaluate(mainTarget, `window.navegante.automation.runAgent(${JSON.stringify(formTab.tabId)},'Clique em Place order na fixture.',false).then(JSON.stringify)`, 45000);
    await clickNativeApprovalButton(approvalButton);
    const result = JSON.parse(await resultPromise);
    const submitted = await evaluate(formTarget, `document.body.dataset.submitted || ''`);
    assert.equal(submitted === 'yes', expectSubmitted, `${scenario}: resultado do formulário deve corresponder à decisão; submitted=${submitted}, result=${JSON.stringify(result)}, providerCalls=${requestCount}, appOutput=${appOutput}, UIA=${uiAutomationOutput}`);
    if (expectSubmitted) {
      assert.equal(result.success, true, result.error || result.message);
      assert.equal(requestCount, 3, 'O modelo só recebe resultado depois da aprovação e conclui o fluxo');
    } else {
      assert.equal(result.success, false, 'A tarefa deve parar após o cancelamento');
      assert.equal(result.cancelled, true, 'O resultado deve indicar cancelamento explícito');
      assert.equal(requestCount, 2, 'O modelo não deve receber nova chamada para contornar o cancelamento');
    }
    await evaluate(mainTarget, `window.navegante.browser.closeTab(${JSON.stringify(formTab.tabId)})`);
    return { scenario, submitted, providerCalls: requestCount };
  }

  const approval = await verifySensitiveDecision('allow-sensitive', 'Permitir uma vez', true);
  const cancellation = await verifySensitiveDecision('cancel-sensitive', 'Cancelar', false);
  console.log(JSON.stringify({ status: 'PASS', app: executable, renderer: mainTarget.url, secondInstance: 'second process exited; primary renderer remained live', tab: created.tabId, provider: 'loopback mock', providerValidation, agentSteps: 3, axMutation: clicked, cuaInput, settings: { shortUrl, fullUrl, lightTheme, dntOff: noDnt.dnt, dntOn: withDnt.dnt, download: downloadedText }, approval, cancellation, elapsedMs: Date.now() - createdAt }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ status: 'FAIL', stage: currentStage, error: error.stack || error, providerCalls: requestCount, cuaDiagnostic, appOutput, retainedScratch: scratch }, null, 2));
  process.exitCode = 1;
}).finally(async () => {
  await closeApp();
  if (mock.listening) await new Promise((resolve) => mock.close(resolve));
  if (siteServer.listening) await new Promise((resolve) => siteServer.close(resolve));
  if (process.exitCode === 0) fs.rmSync(scratch, { recursive: true, force: true });
});

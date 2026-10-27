const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const WebSocket = require('ws');
const net = require('node:net');
const { shouldAutoGrantGooglePermission } = require('../src/main/permissions');
const { isSameSite, rewriteRequestHeaders, rewriteResponseHeaders, makeUniqueDownloadPath } = require('../src/main/browser-policy');
const { endpointFor, listModels } = require('../src/automation/model-catalog');
const { isSecretKey } = require('../src/store');
const { saveProviderKey, maskApiKey } = require('../src/ipc');

const projectRoot = path.join(__dirname, '..');

function javascriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? javascriptFiles(target) : entry.name.endsWith('.js') ? [target] : [];
  });
}

test('all application JavaScript files parse', () => {
  for (const file of javascriptFiles(path.join(projectRoot, 'src'))) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    assert.equal(result.status, 0, `${path.relative(projectRoot, file)} failed syntax check:\n${result.stderr}`);
  }
});

test('the package entry point and Level runtime dependencies are present', () => {
  const manifest = require(path.join(projectRoot, 'package.json'));
  assert.equal(manifest.main, 'src/main/main.js');
  assert.equal(fs.existsSync(path.join(projectRoot, manifest.main)), true);
  assert.equal(typeof require('level').Level, 'function');
  assert.equal(require.resolve('level-supports'), path.join(projectRoot, 'node_modules', 'level-supports', 'index.js'));
});

test('API keys with provider-specific capitalization are classified as secrets', () => {
  assert.equal(isSecretKey('automation.apiKey'), true);
  assert.equal(isSecretKey('automation.openrouterApiKey'), true);
  assert.equal(isSecretKey('automation.deepseekApiKey'), true);
  assert.equal(isSecretKey('browser.defaultHomepage'), false);
});

test('DeepSeek API key saves independently of model selection and never returns the secret', async () => {
  const values = new Map();
  const storage = { set: async (key, value) => values.set(key, value) };
  const result = await saveProviderKey('deepseek', '  deepseek-fixture-secret  ', storage);
  assert.deepEqual(result, { provider: 'deepseek', hasApiKey: true, keyHint: '••••••••cret' });
  assert.deepEqual([...values.entries()], [['automation.deepseekApiKey', 'deepseek-fixture-secret']]);
  await assert.rejects(saveProviderKey('deepseek', '', storage), /chave de API válida/);
});

test('saved key hints reveal only the final four characters', () => {
  assert.equal(maskApiKey('deepseek-fixture-secret'), '••••••••cret');
  assert.equal(maskApiKey(''), '');
});

test('Google geolocation is automatic and other permissions or origins are not', () => {
  assert.equal(shouldAutoGrantGooglePermission('geolocation', 'https://www.google.com/search?q=weather'), true);
  assert.equal(shouldAutoGrantGooglePermission('geolocation', 'https://maps.google.com/'), true);
  assert.equal(shouldAutoGrantGooglePermission('geolocation', 'https://www.google.com.br/'), true);
  assert.equal(shouldAutoGrantGooglePermission('geolocation', 'https://www.google.co.uk/'), true);
  assert.equal(shouldAutoGrantGooglePermission('media', 'https://www.google.com/'), false);
  assert.equal(shouldAutoGrantGooglePermission('geolocation', 'https://google.com.example.org/'), false);
  assert.equal(shouldAutoGrantGooglePermission('geolocation', 'https://googleusercontent.com/'), false);
  assert.equal(shouldAutoGrantGooglePermission('geolocation', 'http://www.google.com/'), false);
  assert.equal(shouldAutoGrantGooglePermission('geolocation', 'not a URL'), false);
});

test('browser privacy policy adds DNT and strips third-party cookies schemefully', () => {
  assert.equal(isSameSite('https://shop.example.co.uk/', 'https://cdn.example.co.uk/script.js'), true);
  assert.equal(isSameSite('https://shop.example.co.uk/', 'https://tracker.co.uk/pixel'), false);
  assert.equal(isSameSite('https://shop.example.com/', 'http://shop.example.com/pixel'), false);
  const thirdParty = rewriteRequestHeaders({
    url: 'https://tracker.example.net/pixel',
    pageUrl: 'https://shop.example.com/',
    resourceType: 'image',
    requestHeaders: { Cookie: 'tracking=id', Accept: 'image/*' }
  }, { doNotTrack: true, blockThirdPartyCookies: true });
  assert.deepEqual(thirdParty, { Accept: 'image/*', DNT: '1' });
  const sameSite = rewriteRequestHeaders({
    url: 'https://static.example.com/app.js',
    pageUrl: 'https://shop.example.com/',
    resourceType: 'script',
    requestHeaders: { Cookie: 'session=id' }
  }, { doNotTrack: false, blockThirdPartyCookies: true });
  assert.deepEqual(sameSite, { Cookie: 'session=id' });
  const responseHeaders = rewriteResponseHeaders({
    url: 'https://tracker.example.net/pixel',
    pageUrl: 'https://shop.example.com/',
    resourceType: 'image',
    responseHeaders: { 'Set-Cookie': ['track=id'], 'Cache-Control': ['no-store'] }
  }, { blockThirdPartyCookies: true });
  assert.deepEqual(responseHeaders, { 'Cache-Control': ['no-store'] });
  assert.deepEqual(rewriteResponseHeaders({
    url: 'https://shop.example.com/', pageUrl: 'https://other.example.net/', resourceType: 'mainFrame',
    responseHeaders: { 'Set-Cookie': ['session=id'] }
  }, { blockThirdPartyCookies: true }), { 'Set-Cookie': ['session=id'] });
});

test('automatic download names stay inside the chosen directory and avoid overwrites', () => {
  const { join } = require('node:path');
  const existing = new Set([join('C:\\downloads', 'report.pdf'), join('C:\\downloads', 'report (1).pdf')]);
  assert.equal(makeUniqueDownloadPath('C:\\downloads', '..\\report.pdf', (file) => existing.has(file)), join('C:\\downloads', 'report (2).pdf'));
});

test('provider catalogs normalize OpenRouter and DeepSeek metadata without exposing arbitrary endpoints', async () => {
  const calls = [];
  const fetchFixture = async (url, options) => {
    calls.push({ url, options });
    const openrouter = String(url).includes('openrouter');
    return {
      ok: true,
      json: async () => ({ data: openrouter
        ? [
          { id: 'z/without-tools', name: 'No tools', supported_parameters: ['temperature'] },
          { id: 'a/with-tools', name: 'Agent model', supported_parameters: ['tools', 'tool_choice'], context_length: 64000, pricing: { prompt: '0.1' } }
        ]
        : [{ id: 'deepseek-flash', name: 'DeepSeek Flash', input_modalities: ['text'], context_window: 1048576 }]
      })
    };
  };
  const openrouterModels = await listModels('openrouter', 'openrouter-fixture-key', fetchFixture, {});
  assert.equal(calls[0].url, 'https://openrouter.ai/api/v1/models?output_modalities=all');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer openrouter-fixture-key');
  assert.deepEqual(openrouterModels.map((model) => [model.id, model.supportsTools]), [['a/with-tools', true], ['z/without-tools', false]]);
  assert.equal(openrouterModels[0].contextLength, 64000);
  const deepseekModels = await listModels('deepseek', 'deepseek-fixture-key', fetchFixture, {});
  assert.equal(calls[1].url, 'https://api.deepseek.com/models');
  assert.equal(calls[1].options.headers.Authorization, 'Bearer deepseek-fixture-key');
  assert.equal(deepseekModels[0].id, 'deepseek-flash');
  assert.equal(deepseekModels[0].supportsTools, null, 'compatibilidade individual não publicada não é presumida');
  assert.throws(() => endpointFor('openrouter', 'models', { NAVEGANTE_TEST_OPENROUTER_MODELS_URL: 'http://example.com/models' }), /loopback/);
  assert.throws(() => endpointFor('unknown', 'models', {}), /inválido/);
});

test('provider network failures report the host and cause without exposing API keys', async () => {
  const { AutomationService } = require('../src/automation/service');
  const service = new AutomationService();
  service.tabs.set('tab-network-error', { webContents: { isDestroyed: () => false } });
  const originalFetch = global.fetch;
  global.fetch = async () => {
    throw new TypeError('fetch failed', { cause: Object.assign(new Error('connect ECONNRESET 104.18.0.1:443'), { code: 'ECONNRESET' }) });
  };
  try {
    const result = await service.runAgent('tab-network-error', 'Inspecione a página', 'secret-fixture-key', 'deepseek-chat', true, 'deepseek');
    assert.equal(result.success, false);
    assert.match(result.error, /DeepSeek \(api\.deepseek\.com\) \[ECONNRESET\]/);
    assert.match(result.error, /internet, DNS, firewall ou proxy/);
    assert.doesNotMatch(result.error, /secret-fixture-key/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('cancelAgentRun aborts the provider request and prevents a later agent step', async () => {
  let started;
  const requestStarted = new Promise((resolve) => { started = resolve; });
  let requestSignal;
  const { AutomationService } = require('../src/automation/service');
  const service = new AutomationService({ fetchImpl: async (_url, options) => {
    requestSignal = options.signal;
    started();
    return new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(options.signal.reason || new DOMException('Aborted', 'AbortError')), { once: true });
    });
  } });
  service.tabs.set('tab-cancel', { webContents: { isDestroyed: () => false, executeJavaScript: async () => ({ title: 'Fixture', text: 'Read only page' }) } });
  const trace = { modelCalls: 0, inputTokens: 0, outputTokens: 0, usageAvailable: true, toolCalls: [], stopReason: null };
  const run = service.runAgent('tab-cancel', 'Faça algo', 'test-key', 'test-model', true, 'openrouter', false, { trace });
  await requestStarted;
  assert.deepEqual(service.cancelAgentRun('tab-cancel'), { success: true });
  const result = await run;
  assert.equal(requestSignal.aborted, true);
  assert.equal(result.cancelled, true);
  assert.equal(trace.stopReason, 'user_cancelled');
  assert.equal(service.activeAgentRuns.size, 0);
});

test('untrusted provider TLS certificates produce safe Windows trust-store guidance', () => {
  const { providerNetworkError } = require('../src/automation/model-catalog');
  const error = providerNetworkError(Object.assign(new Error('self signed certificate in certificate chain'), { code: 'SELF_SIGNED_CERT_IN_CHAIN' }), 'deepseek', 'https://api.deepseek.com/chat/completions');
  assert.match(error.message, /DeepSeek \(api\.deepseek\.com\)/);
  assert.match(error.message, /certificado.*não é confiável.*Windows/i);
  assert.match(error.message, /validação TLS continua ativa/);
});

test('the browser agent calls the provider and returns its final response', async () => {
  const { AutomationService } = require('../src/automation/service');
  const service = new AutomationService();
  service.tabs.set('tab-test', {
    webContents: { isDestroyed: () => false, executeJavaScript: async () => ({ title: 'Example', text: 'Page content' }) }
  });
  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return { ok: true, json: async () => ({ choices: [{ message: { role: 'assistant', content: 'Tarefa concluída.' } }] }) };
  };
  try {
    const result = await service.runAgent('tab-test', 'Resuma esta página', 'test-key', 'openai/gpt-4o-mini');
    assert.deepEqual(result, { success: true, message: 'Tarefa concluída.' });
    assert.equal(requests.length, 1);
    assert.equal(requests[0].messages.at(-1).content, 'Resuma esta página');
  } finally {
    global.fetch = originalFetch;
  }
});

test('provider request metrics retain latency and a generic error class when the response body is invalid', async () => {
  const { AutomationService } = require('../src/automation/service');
  const service = new AutomationService();
  service.tabs.set('tab-invalid-body', { webContents: { isDestroyed: () => false, executeJavaScript: async () => 'fixture' } });
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('secret provider response body'); } });
  const trace = { modelCalls: 0, inputTokens: 0, outputTokens: 0, usageAvailable: true, toolCalls: [], requestMetrics: [] };
  try {
    const result = await service.runAgent('tab-invalid-body', 'test', 'fixture-key', 'test-model', true, 'openrouter', false, { trace });
    assert.equal(result.success, false);
    assert.equal(trace.requestMetrics.length, 1);
    assert.equal(trace.requestMetrics[0].success, false);
    assert.equal(trace.requestMetrics[0].statusCode, 200);
    assert.equal(trace.requestMetrics[0].errorClass, 'body_parse');
    assert.ok(Number.isFinite(trace.requestMetrics[0].durationMs));
    assert.doesNotMatch(JSON.stringify(trace.requestMetrics), /secret provider response body/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('the agent inspects the AX snapshot and executes a selected AX element', async () => {
  const { AutomationService } = require('../src/automation/service');
  const service = new AutomationService();
  service.tabs.set('tab-agent-ax', {
    webContents: {
      isDestroyed: () => false,
      executeJavaScript: async () => 'Fixture page text'
    }
  });
  service.getAccessibilityTree = async () => ({ success: true, tree: { url: 'https://example.test', title: 'Fixture', nodes: [{ index: 0, role: 'button', name: 'Continue', disabled: false }] } });
  const actions = [];
  service.executeAXAction = async (_tabId, action) => { actions.push(action); return { success: true, kind: action.kind }; };
  const originalFetch = global.fetch;
  let call = 0;
  global.fetch = async () => {
    call++;
    const message = call === 1
      ? { role: 'assistant', tool_calls: [{ id: 'inspect-1', type: 'function', function: { name: 'inspect_page', arguments: '{}' } }] }
      : call === 2
        ? { role: 'assistant', tool_calls: [{ id: 'click-1', type: 'function', function: { name: 'click', arguments: '{"index":0}' } }] }
        : { role: 'assistant', content: 'Botão acionado.' };
    return { ok: true, json: async () => ({ choices: [{ message }] }) };
  };
  try {
    const result = await service.runAgent('tab-agent-ax', 'Clique em Continuar', 'test-key', 'test-model');
    assert.deepEqual(result, { success: true, message: 'Botão acionado.' });
    assert.equal(call, 3);
    assert.deepEqual(actions, [{ kind: 'click', elementIndex: 0 }]);
  } finally {
    global.fetch = originalFetch;
  }
});

test('consequential AX actions stop before dispatch when the main-process confirmation is denied', async () => {
  const { AutomationService } = require('../src/automation/service');
  const service = new AutomationService();
  let dispatched = 0;
  let approvalRequest;
  service.tabs.set('tab-risk', {
    state: { url: 'https://shop.test/checkout' },
    webContents: { isDestroyed: () => false, getURL: () => 'https://shop.test/checkout', executeJavaScript: async () => { dispatched++; return { success: true }; } }
  });
  service.getAccessibilityTree = async () => ({ success: true, tree: { url: 'https://shop.test/checkout', nodes: [{ index: 0, name: 'Place order', role: 'button', tag: 'button', isSubmitControl: true }] } });
  service.setApprovalHandler(async (request) => { approvalRequest = request; return false; });

  const result = await service.executeAXAction('tab-risk', { kind: 'click', elementIndex: 0 });
  assert.equal(result.success, false);
  assert.equal(result.cancelled, true);
  assert.equal(dispatched, 0, 'O processo principal bloqueou o despacho antes do clique');
  assert.equal(approvalRequest.origin, 'https://shop.test');
  assert.equal(approvalRequest.reason, 'Ação de compromisso: place order');
  assert.equal(approvalRequest.targetName, 'Place order');
});

test('agent approval levels separately control always-ask, read-only, low-risk and automatic modes', async () => {
  const { AutomationService } = require('../src/automation/service');
  const service = new AutomationService();
  let mode = 'always-ask';
  let asks = 0;
  let dispatched = 0;
  service.setSettingsProvider(() => ({ automationApprovalMode: mode }));
  service.setApprovalHandler(async () => { asks++; return true; });
  service.tabs.set('tab-policy', {
    state: { url: 'https://shop.test/' },
    webContents: { isDestroyed: () => false, getURL: () => 'https://shop.test/', executeJavaScript: async () => { dispatched++; return { success: true }; } }
  });
  service.getAccessibilityTree = async () => ({ success: true, tree: { url: 'https://shop.test/', nodes: [{ index: 0, name: 'Continue', role: 'button', tag: 'button' }] } });

  const readApproval = await service.confirmConsequentialAction('tab-policy', { kind: 'inspect_page', readOnly: true });
  assert.equal(readApproval.approved, true);
  assert.equal(asks, 1, 'Sempre perguntar também confirma leitura');

  mode = 'allow-read';
  const allowedRead = await service.confirmConsequentialAction('tab-policy', { kind: 'inspect_page', readOnly: true });
  assert.equal(allowedRead.required, false);
  const changedPage = await service.executeAXAction('tab-policy', { kind: 'click', elementIndex: 0 });
  assert.equal(changedPage.success, true);
  assert.equal(asks, 2, 'Permitir leitura ainda confirma alterações');

  mode = 'allow-all';
  service.setApprovalHandler(async () => { asks++; return false; });
  const automatic = await service.executeAXAction('tab-policy', { kind: 'click', elementIndex: 0 });
  assert.equal(automatic.success, true);
  assert.equal(asks, 2, 'Autorizar todas não abre confirmação');
  assert.equal(dispatched, 2);
});

test('sensitive hidden controls are never approved by a local task policy', async () => {
  const { AutomationService } = require('../src/automation/service');
  const service = new AutomationService();
  service.setSettingsProvider(() => ({ automationApprovalMode: 'low-risk' }));
  service.taskApprovalPolicies.set('tab-hidden-sensitive', 'local-fixture');
  service.tabs.set('tab-hidden-sensitive', {
    state: { url: 'http://127.0.0.1:5000/form' },
    webContents: { isDestroyed: () => false, getURL: () => 'http://127.0.0.1:5000/form' }
  });
  const approval = await service.confirmConsequentialAction('tab-hidden-sensitive', {
    kind: 'hidden_action', readOnly: false, sensitiveInput: true, targetName: 'Número do cartão'
  });
  assert.equal(approval.approved, false);
  assert.equal(approval.cancelled, true);
  assert.match(approval.error, /senha, código ou pagamento/);
});

test('the agent halts after a denied action instead of asking the model for a workaround', async () => {
  const { AutomationService } = require('../src/automation/service');
  const service = new AutomationService();
  service.tabs.set('tab-risk-agent', {
    state: { url: 'https://shop.test/account' },
    webContents: { isDestroyed: () => false, getURL: () => 'https://shop.test/account', executeJavaScript: async () => 'Account page' }
  });
  const sensitiveTree = { url: 'https://shop.test/account', title: 'Account', nodes: [{ index: 0, role: 'button', tag: 'button', name: 'Delete account', isSubmitControl: true }] };
  service.getAccessibilityTree = async () => ({ success: true, tree: sensitiveTree });
  service.setApprovalHandler(async () => false);
  const originalFetch = global.fetch;
  let providerCalls = 0;
  global.fetch = async () => {
    providerCalls++;
    const message = providerCalls === 1
      ? { role: 'assistant', tool_calls: [{ id: 'inspect-risk', type: 'function', function: { name: 'inspect_page', arguments: '{}' } }] }
      : { role: 'assistant', tool_calls: [{ id: 'delete-risk', type: 'function', function: { name: 'click', arguments: '{"index":0}' } }] };
    return { ok: true, json: async () => ({ choices: [{ message }] }) };
  };
  try {
    const result = await service.runAgent('tab-risk-agent', 'Delete this account', 'test-key', 'test-model');
    assert.equal(result.success, false);
    assert.equal(result.cancelled, true);
    assert.equal(providerCalls, 2, 'Não houve terceira rodada para tentar contornar a recusa');
  } finally {
    global.fetch = originalFetch;
  }
});

test('browser_evaluate requires approval and navigation tools reject non-http schemes', async () => {
  const { AutomationService } = require('../src/automation/service');
  const service = new AutomationService();
  service.registerTools();
  let evaluated = false;
  service.tabs.set('tab-evaluate-risk', {
    state: { url: 'https://example.test/' },
    webContents: { isDestroyed: () => false, getURL: () => 'https://example.test/', executeJavaScript: async () => { evaluated = true; return 1; } }
  });
  service.setApprovalHandler(async () => false);
  const result = await service.callTool('browser_evaluate', { tabId: 'tab-evaluate-risk', script: 'document.body.remove()' });
  assert.equal(result.cancelled, true);
  assert.equal(evaluated, false);
  await assert.rejects(service.callTool('browser_navigate', { tabId: 'tab-evaluate-risk', url: 'javascript:alert(1)' }));
});

test('accessibility snapshot and action use the live tab instead of waiting for missing preload events', async () => {
  const { AutomationService } = require('../src/automation/service');
  const service = new AutomationService();
  service.setApprovalHandler(async () => true);
  const scripts = [];
  service.tabs.set('tab-ax', {
    webContents: {
      isDestroyed: () => false,
      executeJavaScript: async (script) => {
        scripts.push(script);
        return scripts.length < 3
          ? { url: 'https://example.test/', title: 'Fixture', nodes: [{ index: 0, role: 'button', name: 'Continue' }] }
          : { success: true, kind: 'click', url: 'https://example.test/' };
      },
      capturePage: async () => ({ toDataURL: () => 'data:image/png;base64,fixture' })
    }
  });

  const snapshot = await service.getAccessibilityTree('tab-ax');
  const action = await service.executeAXAction('tab-ax', { kind: 'click', elementIndex: 0 });
  assert.equal(snapshot.success, true);
  assert.equal(snapshot.tree.nodes[0].name, 'Continue');
  assert.equal(action.success, true);
  assert.equal(action.kind, 'click');
  assert.equal(scripts.length, 3);
  assert.match(scripts[0], /querySelectorAll/);
  assert.match(scripts[2], /node\.click\(\)/);
});

test('automation service opens its Level database and accepts a WebSocket client', async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'navegante-startup-'));
  process.env.NAVEGANTE_DATA_DIR = dataDir;
  const { AutomationService } = require('../src/automation/service');
  const service = new AutomationService();
  let client;

  t.after(async () => {
    if (client && client.readyState !== WebSocket.CLOSED) {
      client.close();
      await new Promise((resolve) => client.once('close', resolve));
    }
    await service.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
    delete process.env.NAVEGANTE_DATA_DIR;
  });

  await service.start();
  assert.equal(service.running, true);
  const unauthorized = new WebSocket(`ws://127.0.0.1:${service.wss.address().port}`);
  await new Promise((resolve) => unauthorized.once('error', resolve));
  assert.equal(service.clients.size, 0, 'unauthenticated local WebSocket clients are rejected');
  const browserOrigin = new WebSocket(`ws://127.0.0.1:${service.wss.address().port}`, {
    headers: { Authorization: `Bearer ${service.wsToken}`, Origin: 'https://attacker.example' }
  });
  await new Promise((resolve) => browserOrigin.once('error', resolve));
  assert.equal(service.clients.size, 0, 'browser-originated connections are rejected even with a token');
  client = new WebSocket(`ws://127.0.0.1:${service.wss.address().port}`, { headers: { Authorization: `Bearer ${service.wsToken}` } });
  const connected = await new Promise((resolve, reject) => {
    client.once('message', (raw) => resolve(JSON.parse(raw.toString())));
    client.once('error', reject);
  });
  assert.equal(connected.type, 'connected');
  client.send(JSON.stringify({ type: 'listTools', requestId: 'tools-test', data: {} }));
  const response = await new Promise((resolve, reject) => {
    client.once('message', (raw) => resolve(JSON.parse(raw.toString())));
    client.once('error', reject);
  });
  assert.equal(response.requestId, 'tools-test');
  assert.equal(response.type, 'result');
  const result = response.data;
  assert.equal(result.success, true);
  assert.ok(Array.isArray(result.tools));

  if (process.platform === 'win32') {
    const requestMcp = (request) => new Promise((resolve, reject) => {
      const socket = net.createConnection(service.pipePath);
      let response = '';
      socket.once('error', reject);
      socket.on('data', (chunk) => {
        response += chunk.toString();
        const lineEnd = response.indexOf('\n');
        if (lineEnd !== -1) {
          socket.end();
          resolve(JSON.parse(response.slice(0, lineEnd)));
        }
      });
      socket.once('connect', () => socket.write(`${JSON.stringify(request)}\n`));
    });
    const initialized = await requestMcp({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } } });
    assert.equal(initialized.result.serverInfo.name, 'zero-browser');
    const mcpTools = await requestMcp({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    assert.ok(mcpTools.result.tools.some((tool) => tool.name === 'browser_cdp_send'));
  }
});

test('automation tools expose JSON schemas and perform real tab create/close callbacks', async () => {
  const { AutomationService } = require('../src/automation/service');
  const service = new AutomationService();
  service.registerTools();
  let closed = false;
  service.setBrowserControls({
    createTab: async (url) => ({ tabId: 'tab-created', url: url || 'about:blank' }),
    closeTab: async (tabId) => { closed = tabId === 'tab-created'; service.unregisterTab(tabId); }
  });
  service.registerTab('tab-created', { debugger: { on() {}, removeListener() {} } }, 'browser-created');

  const listed = service.listTools();
  const createSchema = listed.tools.find((tool) => tool.name === 'browser_new_tab').inputSchema;
  assert.equal(createSchema.type, 'object');
  assert.deepEqual(createSchema.properties.url, { type: 'string' });
  const cuaSchema = listed.tools.find((tool) => tool.name === 'browser_cua_action').inputSchema;
  assert.equal(cuaSchema.type, 'object');
  assert.equal(cuaSchema.properties.action.type, 'string');
  assert.ok(cuaSchema.properties.action.enum.includes('drag'));
  let cuaRequest;
  service.performCuaAction = async (tabId, action) => { cuaRequest = { tabId, action }; return { success: true }; };
  assert.deepEqual(await service.callTool('browser_cua_action', { tabId: 'tab-created', action: 'click', x: 12, y: 34 }), { success: true });
  assert.deepEqual(cuaRequest, { tabId: 'tab-created', action: { x: 12, y: 34, kind: 'cua_click' } });

  assert.deepEqual(await service.callTool('browser_new_tab', { url: 'https://example.test' }), {
    success: true, tabId: 'tab-created', url: 'https://example.test'
  });
  assert.deepEqual(await service.callTool('browser_close_tab', { tabId: 'tab-created' }), { success: true });
  assert.equal(closed, true);
  assert.deepEqual(await service.callTool('browser_close_tab', { tabId: 'missing' }), { success: false, error: 'Tab not found' });
});

test('CDP event tool returns buffered events with sequence and method filters', async () => {
  const { EventEmitter } = require('node:events');
  const { AutomationService } = require('../src/automation/service');
  const service = new AutomationService();
  service.registerTools();
  const debuggerEmitter = new EventEmitter();
  debuggerEmitter.isAttached = () => true;
  const wc = { debugger: debuggerEmitter, isDestroyed: () => false };
  service.registerTab('tab-cdp', wc, 'browser-cdp');
  debuggerEmitter.emit('message', {}, 'Page.loadEventFired', { timestamp: 1 });
  debuggerEmitter.emit('message', {}, 'Network.loadingFinished', { requestId: 'r1' });

  const result = await service.callTool('browser_cdp_events', { tabId: 'tab-cdp', afterSequence: 1, methods: ['Network.loadingFinished'] });
  assert.equal(result.success, true);
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].sequence, 2);
  assert.equal(result.events[0].method, 'Network.loadingFinished');
  assert.equal(result.nextSequence, 2);
  service.unregisterTab('tab-cdp');
});

test('advanced CDP commands and event reads require the developer setting', async () => {
  const { AutomationService } = require('../src/automation/service');
  const service = new AutomationService();
  service.registerTools();
  service.setSettingsProvider(() => ({ developerCdpEnabled: false }));
  let attached = false;
  const debuggerApi = { isAttached: () => false, attach: async () => { attached = true; }, sendCommand: async () => ({ ok: true }) };
  service.tabs.set('tab-cdp-gated', {
    cdpEvents: [], cdpSequence: 0,
    webContents: { isDestroyed: () => false, debugger: debuggerApi }
  });
  const command = await service.sendCdpCommand('tab-cdp-gated', 'Page.navigate', { url: 'https://example.test' });
  const events = await service.callTool('browser_cdp_events', { tabId: 'tab-cdp-gated' });
  assert.equal(command.success, false);
  assert.match(command.error, /Ative “CDP completo”/);
  assert.equal(events.success, false);
  assert.match(events.error, /Ative “CDP completo”/);
  assert.equal(attached, false, 'O debugger continua desligado enquanto a preferência está desativada');
});

test('browser_wait resolves load, networkidle and timeout with listener cleanup', async () => {
  const { EventEmitter } = require('node:events');
  const { AutomationService } = require('../src/automation/service');
  const service = new AutomationService();
  service.registerTools();
  let loading = true;
  const wc = new EventEmitter();
  wc.isDestroyed = () => false;
  wc.isLoading = () => loading;
  wc.executeJavaScript = async () => 'complete';
  const debuggerEmitter = new EventEmitter();
  let attached = false;
  debuggerEmitter.isAttached = () => attached;
  debuggerEmitter.attach = () => { attached = true; };
  debuggerEmitter.detach = () => { attached = false; };
  debuggerEmitter.sendCommand = async () => ({});
  wc.debugger = debuggerEmitter;
  service.registerTab('tab-wait', wc, 'browser-wait');
  const baselineCdpListeners = debuggerEmitter.listenerCount('message');

  const loadPromise = service.callTool('browser_wait', { tabId: 'tab-wait', condition: 'load', timeout: 1000 });
  setTimeout(() => { loading = false; wc.emit('did-stop-loading'); }, 20);
  assert.deepEqual(await loadPromise, { success: true });
  assert.equal(wc.listenerCount('did-stop-loading'), 0);

  const idlePromise = service.callTool('browser_wait', { tabId: 'tab-wait', condition: 'networkidle', timeout: 1000 });
  assert.deepEqual(await idlePromise, { success: true });
  assert.equal(attached, false);
  assert.equal(debuggerEmitter.listenerCount('message'), baselineCdpListeners);

  loading = true;
  await assert.rejects(service.callTool('browser_wait', { tabId: 'tab-wait', condition: 'load', timeout: 15 }), /Wait timeout/);
  assert.equal(wc.listenerCount('did-stop-loading'), 0);
});

test('browser_screenshot fullPage uses CDP page metrics and returns actual screenshot bytes', async () => {
  const { AutomationService } = require('../src/automation/service');
  const service = new AutomationService();
  service.registerTools();
  let attached = false;
  const commands = [];
  const debuggerApi = Object.assign(new (require('node:events').EventEmitter)(), {
    isAttached: () => attached,
    attach: () => { attached = true; },
    detach: () => { attached = false; },
    sendCommand: async (method) => {
      commands.push(method);
      if (method === 'Page.getLayoutMetrics') return { contentSize: { width: 1280, height: 2400 } };
      if (method === 'Page.captureScreenshot') return { data: 'cG5nLWJ5dGVz' };
      throw new Error(method);
    }
  });
  service.registerTab('tab-shot', { isDestroyed: () => false, debugger: debuggerApi }, 'browser-shot');
  const result = await service.callTool('browser_screenshot', { tabId: 'tab-shot', fullPage: true });
  assert.deepEqual(result, { success: true, dataUrl: 'data:image/png;base64,cG5nLWJ5dGVz', fullPage: true, width: 1280, height: 2400 });
  assert.deepEqual(commands, ['Page.getLayoutMetrics', 'Page.captureScreenshot']);
  assert.equal(attached, false);
});

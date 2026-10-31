const test = require('node:test');
const assert = require('node:assert/strict');
const { AutomationService } = require('../src/automation/service');
const { isAuthenticationIdentifier } = require('../src/automation/risk');

function montar(pageUrl, formAction, { isBotProfile = false, approvalMode = 'low-risk' } = {}) {
  const service = new AutomationService();
  let dispatches = 0;
  service.setSettingsProvider(() => ({ isBotProfile, automationApprovalMode: approvalMode }));
  service.tabs.set('tab-cred', {
    state: { url: pageUrl },
    webContents: {
      isDestroyed: () => false,
      getURL: () => pageUrl,
      executeJavaScript: async () => { dispatches += 1; return { success: true }; }
    }
  });
  service.getAccessibilityTree = async () => ({ success: true, tree: {
    url: pageUrl,
    nodes: [{ index: 0, name: 'Senha', tag: 'input', type: 'password', sensitiveInput: true, formAction }]
  } });
  service.setApprovalHandler(async () => true);
  return { service, dispatches: () => dispatches };
}

async function tentarSequenciaDeBot(steps) {
  let round = 0;
  let keyDispatches = 0;
  const service = new AutomationService({ fetchImpl: async () => {
    const message = round++ === 0
      ? { role: 'assistant', tool_calls: [{ id: 'keys', type: 'function', function: { name: 'key_sequence', arguments: JSON.stringify({ steps }) } }] }
      : { role: 'assistant', content: 'A sequência foi recusada.' };
    return { ok: true, json: async () => ({ choices: [{ message }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) };
  } });
  const url = 'https://app.test/login';
  service.setSettingsProvider(() => ({ isBotProfile: true, automationApprovalMode: 'allow-all' }));
  service.tabs.set('tab-keys', {
    state: { url },
    webContents: {
      isDestroyed: () => false, isLoading: () => false, getURL: () => url,
      setBackgroundThrottling: () => {}, executeJavaScript: async () => ({}),
      debugger: { isAttached: () => false, attach: () => {}, detach: () => {}, sendCommand: async () => { keyDispatches++; return {}; } }
    }
  });
  const result = await service.runAgent('tab-keys', 'Continue a tarefa', 'test-key', 'test-model', true, 'openrouter', false, { advancedInput: true });
  return { result, keyDispatches };
}

test('typing a credential into a cross-origin form is refused before dispatch', async () => {
  const { service, dispatches } = montar('https://app.test/login', 'https://evil.test/collect');
  const result = await service.executeAXAction('tab-cred', { kind: 'type_text', elementIndex: 0, text: 'segredo' });
  assert.equal(result.success, false);
  assert.equal(result.cancelled, true);
  assert.match(result.error, /fora da origem/);
  assert.equal(dispatches(), 0, 'nada é digitado');
});

test('the same-origin form and a declared authentication origin are allowed', async () => {
  const same = montar('https://app.test/login', 'https://app.test/session');
  const ok = await same.service.executeAXAction('tab-cred', { kind: 'type_text', elementIndex: 0, text: 'segredo' });
  assert.equal(ok.success, true);

  const declared = montar('https://app.test/login', 'https://login.app.test/session');
  declared.service.taskAuthOrigins.set('tab-cred', ['https://login.app.test']);
  const allowed = await declared.service.executeAXAction('tab-cred', { kind: 'type_text', elementIndex: 0, text: 'segredo' });
  assert.equal(allowed.success, true);
});

test('a bot profile refuses credential typing even with allow-all', async () => {
  const { service, dispatches } = montar('https://app.test/login', 'https://app.test/session', {
    isBotProfile: true,
    approvalMode: 'allow-all'
  });
  const result = await service.executeAXAction('tab-cred', { kind: 'type_text', elementIndex: 0, text: 'segredo' });
  assert.equal(result.success, false);
  assert.equal(result.cancelled, true);
  assert.match(result.error, /bot não pode digitar credenciais/i);
  const keyResult = await service.executeAXAction('tab-cred', { kind: 'press_key', elementIndex: 0, key: 'a' });
  assert.equal(keyResult.success, false);
  assert.match(keyResult.error, /bot não pode digitar credenciais/i);
  assert.equal(dispatches(), 0, 'credencial não é digitada');
});

test('a login identifier in the same credential form is also refused', async () => {
  const { service, dispatches } = montar('https://app.test/login', 'https://app.test/session', {
    isBotProfile: true,
    approvalMode: 'allow-all'
  });
  service.getAccessibilityTree = async () => ({ success: true, tree: {
    url: 'https://app.test/login',
    nodes: [{ index: 0, name: 'E-mail', tag: 'input', type: 'email', sensitiveInput: true, formAction: 'https://app.test/session' }]
  } });
  const result = await service.executeAXAction('tab-cred', { kind: 'type_text', elementIndex: 0, text: 'conta@app.test' });
  assert.equal(result.success, false);
  assert.match(result.error, /bot não pode digitar credenciais/i);
  assert.equal(dispatches(), 0, 'identificador de login não é digitado pelo bot');
});

test('a stage-one email login is redacted, cannot be typed by a bot, and blocks screenshots', async () => {
  const service = new AutomationService();
  const url = 'https://app.test/auth/identifier';
  service.setSettingsProvider(() => ({ isBotProfile: true, automationApprovalMode: 'allow-all' }));
  const loginNode = {
    index: 0, tag: 'input', type: 'email', name: 'E-mail', fieldName: 'email', fieldLabel: 'E-mail',
    formAction: url, formName: 'login', formText: 'Sign in to your account', submitLabels: 'Continue',
    value: 'wesley@example.test', sensitiveInput: false
  };
  service.tabs.set('tab-login-stage-one', {
    webContents: { isDestroyed: () => false, getURL: () => url, executeJavaScript: async () => ({
      url, title: 'Sign in', needsPierce: false, nodes: [{ ...loginNode }]
    }) }
  });

  const inspected = await service.getAccessibilityTree('tab-login-stage-one');
  assert.equal(inspected.success, true);
  assert.equal(inspected.tree.nodes[0].sensitiveInput, true);
  assert.equal(inspected.tree.nodes[0].value, undefined, 'o valor preenchido não sai no snapshot');

  const typed = await service.executeAXAction('tab-login-stage-one', { kind: 'type_text', elementIndex: 0, text: 'conta@app.test' });
  assert.equal(typed.success, false);
  assert.match(typed.error, /bot não pode digitar credenciais/i);

  const screenshot = await service.confirmConsequentialAction('tab-login-stage-one', { kind: 'browser_screenshot', readOnly: true });
  assert.equal(screenshot.approved, false);
  assert.match(screenshot.error, /Captura bloqueada/);
});

test('a common contact email remains an ordinary field', async () => {
  assert.equal(isAuthenticationIdentifier({
    type: 'email', name: 'email', label: 'E-mail', formAction: 'https://app.test/contact',
    formName: 'contact', formText: 'Contact us for updates', submitLabels: 'Send message'
  }), false);
  const { service, dispatches } = montar('https://app.test/contact', 'https://app.test/contact', {
    isBotProfile: true, approvalMode: 'allow-all'
  });
  service.getAccessibilityTree = async () => ({ success: true, tree: { url: 'https://app.test/contact', nodes: [{
    index: 0, name: 'E-mail', tag: 'input', type: 'email', sensitiveInput: false, fieldName: 'email',
    fieldLabel: 'E-mail', formAction: 'https://app.test/contact', formName: 'contact',
    formText: 'Contact us for updates', submitLabels: 'Send message'
  }] } });
  const typed = await service.executeAXAction('tab-cred', { kind: 'type_text', elementIndex: 0, text: 'contato@app.test' });
  assert.equal(typed.success, true);
  assert.equal(dispatches(), 1);
});

test('a bot cannot read an authentication email HTML value through locator attribute', async () => {
  const service = new AutomationService();
  let evaluations = 0;
  service.setSettingsProvider(() => ({ isBotProfile: true, automationApprovalMode: 'allow-all' }));
  service.tabs.set('tab-locator-secret', {
    webContents: {
      isDestroyed: () => false,
      executeJavaScript: async () => {
        evaluations++;
        return { success: true, count: 1, matches: [{
          index: 0, type: 'email', name: 'E-mail', fieldName: 'email', fieldLabel: 'E-mail',
          formAction: 'https://app.test/auth/identifier', formText: 'Sign in', submitLabels: 'Continue',
          value: 'initial@example.test', sensitiveInput: false
        }] };
      }
    }
  });
  const result = await service.executeLocatorAction('tab-locator-secret', {
    strategy: 'css', query: 'input[type=email]', action: 'attribute', attribute: 'value'
  });
  assert.equal(result.success, false);
  assert.match(result.error, /indisponível em perfis de bot/i);
  assert.equal(evaluations, 0, 'a leitura e a segunda resolução do seletor não ocorrem');
});

test('a bot blocks locator attribute=value before resolving any target', async () => {
  const service = new AutomationService();
  let pageReads = 0;
  service.setSettingsProvider(() => ({ isBotProfile: true, automationApprovalMode: 'allow-all' }));
  service.tabs.set('tab-locator-value', { webContents: {
    isDestroyed: () => false,
    executeJavaScript: async () => { pageReads++; return { success: true, count: 1, matches: [{ value: 'rotated-target' }] }; }
  } });
  const result = await service.executeLocatorAction('tab-locator-value', {
    strategy: 'css', query: 'input', action: 'attribute', attribute: 'value'
  });
  assert.equal(result.success, false);
  assert.match(result.error, /indisponível em perfis de bot/i);
  assert.equal(pageReads, 0, 'recusa ocorre antes de resolver ou reler o seletor');
});

test('a bot blocks no-form login identifiers from nearby login context and username autocomplete', async () => {
  const { service, dispatches } = montar('https://app.test/login', '', { isBotProfile: true, approvalMode: 'allow-all' });
  const loginNode = {
    index: 0, name: 'E-mail', tag: 'input', type: 'email', fieldName: 'email', fieldLabel: 'E-mail',
    pageUrl: 'https://app.test/login', pageTitle: 'Sign in', nearbyText: 'Welcome back to your account',
    ctaLabels: 'Continue', sensitiveInput: false
  };
  service.getAccessibilityTree = async () => ({ success: true, tree: { url: 'https://app.test/login', nodes: [{ ...loginNode }] } });
  const typed = await service.executeAXAction('tab-cred', { kind: 'type_text', elementIndex: 0, text: 'person@app.test' });
  assert.equal(typed.success, false);
  assert.match(typed.error, /bot não pode digitar credenciais/i);
  assert.equal(dispatches(), 0);
  const screenshot = await service.confirmConsequentialAction('tab-cred', { kind: 'browser_screenshot', readOnly: true });
  assert.equal(screenshot.approved, false);
  assert.match(screenshot.error, /Captura bloqueada/);
  assert.equal(isAuthenticationIdentifier({ autocomplete: 'username' }), true);
});

test('bot CUA refuses typing when focus resolves to a host or unknown target', async () => {
  const { service } = montar('https://app.test/home', '', { isBotProfile: true, approvalMode: 'allow-all' });
  service.tabs.get('tab-cred').webContents.executeJavaScript = async () => ({
    name: 'custom-widget', role: 'div', inputTarget: false, sensitiveInput: false
  });
  const result = await service.confirmConsequentialAction('tab-cred', { kind: 'cua_type', text: 'secret' });
  assert.equal(result.approved, false);
  assert.match(result.error, /não foi possível verificar o campo/i);
});

test('bot screenshot always pierces a standard shadow host before allowing capture', async () => {
  const service = new AutomationService();
  service.setSettingsProvider(() => ({ isBotProfile: true, automationApprovalMode: 'allow-all' }));
  const root = { nodeName: '#document', children: [{
    nodeName: 'DIV', attributes: ['id', 'widget-host'], children: [], shadowRoots: [{ nodeName: '#document-fragment', children: [
      { nodeName: 'INPUT', attributes: ['type', 'password', 'name', 'password'], children: [], backendNodeId: 901 }
    ] }]
  }] };
  const commands = [];
  let snapshotScript = '';
  service.tabs.set('tab-shadow', { webContents: {
    isDestroyed: () => false, getURL: () => 'https://app.test/login',
    executeJavaScript: async (script) => { if (script === 'document.title') return 'Login'; snapshotScript = script; return { url: 'https://app.test/login', title: 'Login', needsPierce: true, nodes: [] }; },
    debugger: { isAttached: () => false, attach: () => {}, detach: () => {}, sendCommand: async (method) => {
      commands.push(method);
      return method === 'DOM.getDocument' ? { root } : { quads: [[0,0,20,0,20,10,0,10]] };
    } }
  } });
  const reason = await service.botScreenshotBlockReason('tab-shadow');
  assert.match(snapshotScript, /const needsPierce=true\|\|/);
  assert.ok(commands.includes('DOM.getDocument'), 'varredura atravessa o shadow root do host HTML padrão');
  assert.match(reason, /contém campo de credencial/);
});

test('bot screenshot fails closed when either accessibility scan is truncated', async () => {
  const { service } = montar('https://app.test/home', '', { isBotProfile: true, approvalMode: 'allow-all' });
  for (const tree of [
    { nodes: [], nodesTruncated: true, hiddenControls: [] },
    { nodes: [], hiddenControls: [], hiddenControlsTruncated: true }
  ]) {
    service.getAccessibilityTree = async () => ({ success: true, tree });
    const result = await service.confirmConsequentialAction('tab-cred', { kind: 'browser_screenshot', readOnly: true });
    assert.equal(result.approved, false);
    assert.match(result.error, /não foi possível verificar/i);
  }
});

test('a username field in a shadow-root login form is marked as sensitive', async () => {
  const service = new AutomationService();
  const input = (type, name, backendNodeId) => ({
    nodeName: 'INPUT', attributes: ['type', type, 'name', name, 'placeholder', name], children: [], backendNodeId
  });
  const root = { nodeName: '#document', children: [{
    nodeName: 'DIV', children: [], shadowRoots: [{ nodeName: '#document-fragment', children: [{
      nodeName: 'FORM', attributes: ['id', 'login'], children: [input('email', 'email', 1), input('password', 'password', 2)]
    }] }]
  }] };
  const tab = {
    hiddenNodes: new Map(),
    webContents: { executeJavaScript: async () => 'Login', debugger: {
      isAttached: () => false,
      attach: () => {},
      detach: () => {},
      sendCommand: async (method) => method === 'DOM.getDocument' ? { root } : { quads: [[0, 0, 10, 0, 10, 10, 0, 10]] }
    } }
  };
  const controls = await service.getPiercedControls(tab);
  const username = controls.find((control) => control.name === 'email');
  assert.equal(username.sensitiveInput, true);
});

test('pierced control cap is reported instead of appearing to be a complete scan', async () => {
  const service = new AutomationService();
  const children = Array.from({ length: 61 }, (_, index) => ({
    nodeName: 'INPUT', attributes: ['type', 'text', 'name', `field-${index}`], children: [], backendNodeId: index + 1
  }));
  const root = { nodeName: '#document', children: [{ nodeName: 'DIV', children: [], shadowRoots: [{ nodeName: '#document-fragment', children }] }] };
  const tab = { hiddenNodes: new Map(), webContents: { executeJavaScript: async () => 'Example', debugger: {
    isAttached: () => false, attach: () => {}, detach: () => {},
    sendCommand: async (method) => method === 'DOM.getDocument' ? { root } : { quads: [[0,0,10,0,10,10,0,10]] }
  } } };
  const controls = await service.getPiercedControls(tab);
  assert.equal(controls.length, 60);
  assert.equal(controls.truncated, true);
});

test('pierce detector marks a no-form email login from its nearby Continue button', async () => {
  const service = new AutomationService();
  const email = { nodeName: 'INPUT', attributes: ['type','email','name','email'], children: [], backendNodeId: 801 };
  const button = { nodeName: 'BUTTON', attributes: [], children: [{ nodeType: 3, nodeName: '#text', nodeValue: 'Continue', children: [] }], backendNodeId: 802 };
  const root = { nodeName: '#document', children: [{ nodeName: 'DIV', attributes: ['id','auth-step'], children: [], shadowRoots: [{
    nodeName: '#document-fragment', children: [{ nodeName: 'DIV', attributes: ['class','login-panel'], children: [email, button] }]
  }] }] };
  const tab = { hiddenNodes: new Map(), webContents: {
    getURL: () => 'https://app.test/auth/identifier', executeJavaScript: async () => 'Sign in',
    debugger: { isAttached: () => false, attach: () => {}, detach: () => {},
      sendCommand: async (method) => method === 'DOM.getDocument' ? { root } : { quads: [[0,0,20,0,20,10,0,10]] } }
  } };
  const controls = await service.getPiercedControls(tab);
  assert.equal(controls.find((control) => control.type === 'email')?.sensitiveInput, true);
});

test('a bot profile also refuses credential keystrokes and paste shortcuts', async () => {
  const { service } = montar('https://app.test/login', 'https://app.test/session', {
    isBotProfile: true,
    approvalMode: 'allow-all'
  });
  service.tabs.get('tab-cred').webContents.executeJavaScript = async () => ({
    name: 'Senha', type: 'password', sensitiveInput: true, formAction: 'https://app.test/session'
  });
  const keystroke = await service.confirmConsequentialAction('tab-cred', {
    kind: 'cua_keypress', keys: [['a']], readOnly: true
  });
  const paste = await service.confirmConsequentialAction('tab-cred', {
    kind: 'cua_keypress', keys: [['Control', 'v']], readOnly: true
  });
  assert.equal(keystroke.approved, false);
  assert.equal(paste.approved, false);
  assert.match(keystroke.error, /bot não pode digitar credenciais/i);
});

test('a bot refuses the whole key sequence before Tab can reach a credential field', async () => {
  const { result, keyDispatches } = await tentarSequenciaDeBot([{ keys: ['Tab'] }, { keys: ['a'] }]);
  assert.equal(result.success, true, result.error);
  assert.equal(keyDispatches, 0, 'nem Tab nem caracteres são enviados');
});

test('a bot refuses a Ctrl+V key sequence before it can paste into a credential field', async () => {
  const { result, keyDispatches } = await tentarSequenciaDeBot([{ keys: ['Control', 'v'] }]);
  assert.equal(result.success, true, result.error);
  assert.equal(keyDispatches, 0, 'nenhum atalho de colagem é enviado');
});

test('a bot profile blocks page JavaScript and raw CDP routes even with allow-all', async () => {
  const { service } = montar('https://app.test/login', 'https://app.test/session', {
    isBotProfile: true,
    approvalMode: 'allow-all'
  });
  const evaluate = await service.confirmConsequentialAction('tab-cred', { kind: 'browser_evaluate' });
  const cdp = await service.confirmConsequentialAction('tab-cred', { kind: 'browser_cdp_send', method: 'Runtime.evaluate' });
  const events = await service.confirmConsequentialAction('tab-cred', { kind: 'browser_cdp_events', readOnly: true });
  assert.equal(evaluate.approved, false);
  assert.equal(cdp.approved, false);
  assert.equal(events.approved, false);
});

test('bot screenshots are blocked on credential forms but remain available on clean pages', async () => {
  const { service } = montar('https://app.test/account', 'https://app.test/session', {
    isBotProfile: true,
    approvalMode: 'allow-all'
  });
  service.getAccessibilityTree = async () => ({ success: true, tree: { nodes: [{ name: 'E-mail', type: 'email', sensitiveInput: true }], hiddenControls: [] } });
  const sensitive = await service.confirmConsequentialAction('tab-cred', { kind: 'browser_screenshot', readOnly: true });
  assert.equal(sensitive.approved, false);
  assert.match(sensitive.error, /Captura bloqueada/);

  service.getAccessibilityTree = async () => ({ success: true, tree: { nodes: [], hiddenControls: [] } });
  const clean = await service.confirmConsequentialAction('tab-cred', { kind: 'browser_screenshot', readOnly: true });
  assert.equal(clean.approved, true);
});

test('a bot cannot bypass screenshot checks with direct capture CDP', async () => {
  const { service } = montar('https://app.test/account', 'https://app.test/session', {
    isBotProfile: true,
    approvalMode: 'allow-all'
  });
  const capture = await service.confirmConsequentialAction('tab-cred', {
    kind: 'browser_cdp_send', method: 'Page.captureScreenshot', readOnly: true
  });
  assert.equal(capture.approved, false);
});

test('a bot profile refuses the Flame engine until it has equivalent credential guards', async () => {
  const service = new AutomationService();
  let flameRuns = 0;
  service.setSettingsProvider(() => ({ isBotProfile: true }));
  service.browserControls = { runFlameTask: async () => { flameRuns++; return { success: true }; } };
  const result = await service.runTask({ startUrl: 'https://app.test/login', prompt: 'Continue', engine: 'flame' });
  assert.equal(result.success, false);
  assert.match(result.error, /Flame fica indisponível/);
  assert.equal(flameRuns, 0, 'o motor sem proteção equivalente não recebe a tarefa');
});

test('allow-all remains unchanged for non-bot profiles', async () => {
  const { service, dispatches } = montar('https://app.test/login', 'https://app.test/session', {
    approvalMode: 'allow-all'
  });
  const result = await service.executeAXAction('tab-cred', { kind: 'type_text', elementIndex: 0, text: 'segredo' });
  assert.equal(result.success, true);
  assert.equal(dispatches(), 1, 'o perfil humano mantém o comportamento anterior');
});

test('a bot can type into ordinary fields after the user logs in', async () => {
  const { service, dispatches } = montar('https://app.test/home', 'https://evil.test/collect', {
    isBotProfile: true,
    approvalMode: 'allow-all'
  });
  service.getAccessibilityTree = async () => ({ success: true, tree: {
    url: 'https://app.test/home',
    nodes: [{ index: 0, name: 'Search', tag: 'input', type: 'search', sensitiveInput: false, formAction: 'https://evil.test/collect' }]
  } });
  const result = await service.executeAXAction('tab-cred', { kind: 'type_text', elementIndex: 0, text: 'relatório' });
  assert.equal(result.success, true);
  assert.equal(dispatches(), 1, 'ações normais continuam disponíveis após o login manual');
  const navigation = await service.confirmConsequentialAction('tab-cred', { kind: 'navigate', url: 'https://app.test/relatorios' });
  assert.equal(navigation.approved, true, 'navegação autenticada normal não é bloqueada');
});

test('a bot cannot read a clipboard that may contain credentials', async () => {
  const url = 'https://app.test/home';
  let clipboardReads = 0;
  let clipboardWrites = 0;
  let clipboardContent = '';
  let round = 0;
  const service = new AutomationService({ fetchImpl: async () => {
    const message = round++ === 0
      ? { role: 'assistant', tool_calls: [{ id: 'write-clip', type: 'function', function: { name: 'clipboard', arguments: JSON.stringify({ action: 'write', text: 'Produto\tEstoque\nCadeira\t20' }) } }] }
      : round === 2
        ? { role: 'assistant', tool_calls: [{ id: 'read-clip', type: 'function', function: { name: 'clipboard', arguments: '{"action":"read"}' } }] }
        : { role: 'assistant', content: 'Leitura recusada.' };
    return { ok: true, json: async () => ({ choices: [{ message }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) };
  } });
  service.setSettingsProvider(() => ({ isBotProfile: true, automationApprovalMode: 'allow-all' }));
  service.setClipboard({ readText: () => { clipboardReads++; return 'possível senha'; }, writeText: (text) => { clipboardWrites++; clipboardContent = text; } });
  service.tabs.set('tab-clip', {
    state: { url },
    webContents: { isDestroyed: () => false, isLoading: () => false, getURL: () => url, setBackgroundThrottling: () => {}, executeJavaScript: async () => ({}) }
  });
  const result = await service.runAgent('tab-clip', 'Leia a área de transferência', 'test-key', 'test-model', true, 'openrouter', false, { advancedInput: true });
  assert.equal(result.success, true, result.error);
  assert.equal(clipboardWrites, 1, 'escrita de TSV para planilha continua disponível');
  assert.equal(clipboardContent, 'Produto\tEstoque\nCadeira\t20');
  assert.equal(clipboardReads, 0, 'o texto da área de transferência nunca chega ao bot');
});

test('a non-sensitive field is unaffected by the credential rule', async () => {
  const { service } = montar('https://app.test/login', 'https://evil.test/collect');
  service.getAccessibilityTree = async () => ({ success: true, tree: {
    url: 'https://app.test/login',
    nodes: [{ index: 0, name: 'Busca', tag: 'input', type: 'search', sensitiveInput: false, formAction: 'https://evil.test/collect' }]
  } });
  const result = await service.executeAXAction('tab-cred', { kind: 'type_text', elementIndex: 0, text: 'cadeira' });
  assert.equal(result.success, true);
});

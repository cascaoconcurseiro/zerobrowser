const test = require('node:test');
const assert = require('node:assert/strict');
const { AutomationService } = require('../src/automation/service');

function serviceWithTab(url = 'https://exemplo.test/painel') {
  const service = new AutomationService();
  service.tabs.set('tab-b', {
    state: { url },
    webContents: {
      isDestroyed: () => false, isLoading: () => false, getURL: () => url,
      setBackgroundThrottling: () => {},
      executeJavaScript: async () => ({ title: 'Exemplo', text: 'conteúdo', nodes: [] })
    }
  });
  service.setApprovalHandler(async () => true);
  service.setAgentConfigProvider(async () => ({ provider: 'openrouter', model: 'm', apiKey: 'k' }));
  service.setBrowserControls({ createTab: async () => ({ tabId: 'tab-b' }), closeTab: async () => {} });
  return service;
}

function fakeProvider(script) {
  const requests = [];
  let round = 0;
  const original = global.fetch;
  global.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    requests.push(body);
    const message = script(round, body);
    round += 1;
    return { ok: true, json: async () => ({ choices: [{ message }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) };
  };
  return { requests, restore: () => { global.fetch = original; } };
}

test('Bot para antes de exceder o limite de chamadas ao modelo', async () => {
  const service = serviceWithTab();
  const provider = fakeProvider(() => call('inspect_page', {}));
  const trace = { modelCalls: 0, inputTokens: 0, outputTokens: 0, usageAvailable: true, toolCalls: [] };
  try {
    const result = await service.runAgent('tab-b', 'Leia a página', 'k', 'm', true, 'openrouter', false, {
      maxModelCalls: 1, trace
    });
    assert.equal(provider.requests.length, 1, 'a segunda requisição não chega ao provedor');
    assert.equal(result.success, false);
    assert.equal(result.usageLimit, true);
    assert.match(result.error, /Limite de chamadas ao modelo atingido \(1\)/);
    assert.equal(trace.modelRequests, 1);
  } finally {
    provider.restore();
  }
});

const call = (name, args, id = `c${Math.random().toString(36).slice(2, 8)}`) => ({
  role: 'assistant',
  tool_calls: [{ id, type: 'function', function: { name, arguments: JSON.stringify(args) } }]
});

test('pre-inspection saves the first round by delivering the snapshot ready', async () => {
  const service = serviceWithTab();
  const provider = fakeProvider((round) => (round === 0 ? { role: 'assistant', content: 'Feito.' } : { role: 'assistant', content: 'Feito.' }));
  try {
    const result = await service.runAgent('tab-b', 'Leia a página', 'k', 'm', true, 'openrouter', false, { preInspect: true });
    assert.equal(result.success, true, result.error);
    const first = provider.requests[0].messages;
    assert.ok(
      first.some((message) => message.role === 'assistant' && message.tool_calls?.[0]?.id?.startsWith('preinspect-')),
      'o snapshot precisa chegar antes do primeiro turno do modelo'
    );
    assert.ok(first.some((message) => message.role === 'tool' && String(message.tool_call_id).startsWith('preinspect-')));
  } finally {
    provider.restore();
  }
});

test('deduplicated snapshot can reuse a guarded pre-inspection anchor', async () => {
  const service = serviceWithTab();
  service.getAccessibilityTree = async () => ({ success: true, tree: {
    url: 'https://exemplo.test/painel', title: 'Exemplo', nodes: []
  } });
  const provider = fakeProvider((round) => round === 0
    ? call('inspect_page', {}, 'inspect-after-preinspect')
    : { role: 'assistant', content: 'Feito.' });
  const trace = { requestMetrics: [], toolCalls: [], modelCalls: 0, inputTokens: 0, outputTokens: 0, usageAvailable: true };
  try {
    const result = await service.runAgent('tab-b', 'Leia a página', 'k', 'm', true, 'openrouter', false, {
      preInspect: true, deduplicateSnapshots: true, trace
    });
    assert.equal(result.success, true, result.error);
    assert.equal(trace.deduplicatedSnapshots, 1);
    const messages = provider.requests[1].messages;
    const reused = JSON.parse(messages.find((message) => message.tool_call_id === 'inspect-after-preinspect').content);
    assert.ok(reused.snapshotReused?.startsWith('preinspect-'));
    const anchor = JSON.parse(messages.find((message) => message.tool_call_id === reused.snapshotReused).content);
    assert.ok(Array.isArray(anchor.nodes), 'a âncora completa é preservada');
  } finally {
    provider.restore();
  }
});

test('repeated read-only rounds earn a host nudge instead of silence', async () => {
  const service = serviceWithTab();
  const provider = fakeProvider((round) => (round < 3 ? call('inspect_page', {}) : { role: 'assistant', content: 'Parei de inspecionar.' }));
  try {
    const result = await service.runAgent('tab-b', 'Faça algo', 'k', 'm', true, 'openrouter', false, { maxSteps: 6 });
    assert.equal(result.success, true, result.error);
    const nudges = provider.requests
      .flatMap((request) => request.messages)
      .filter((message) => message.role === 'user' && /\[Zero Browser\]/.test(String(message.content)) && /só leu/.test(String(message.content)));
    assert.ok(nudges.length >= 1, 'o host precisa avisar que só houve leitura');
  } finally {
    provider.restore();
  }
});

test('pausing at the limit reports which tools spent the rounds and the last error', async () => {
  const service = serviceWithTab();
  const provider = fakeProvider((round) => (round < 5 ? call('inspect_page', {}) : call('inspect_page', {})));
  try {
    const result = await service.runAgent('tab-b', 'Faça algo', 'k', 'm', true, 'openrouter', false, {
      maxSteps: 2, resumable: true
    });
    assert.equal(result.success, true);
    assert.equal(result.paused, true);
    assert.ok(result.resumeId, 'a pausa precisa devolver um id para Continuar');
    assert.match(result.message, /Ferramentas usadas: inspect_page×2/);
    assert.equal(result.toolUse.inspect_page, 2);
  } finally {
    provider.restore();
  }
});

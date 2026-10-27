const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { AutomationService } = require('../src/automation/service');

test('read_batch can continue through task tabs and text after 12k without reading another user tab', async () => {
  const service = new AutomationService();
  const startUrl = 'http://127.0.0.1:5000/t/page-1';
  const matchingLines = Array.from({ length: 20 }, (_, i) => `produto ${String(i + 1).padStart(2, '0')} ${'d'.repeat(i === 0 ? 700 : 70)}`);
  const longText = `${'f'.repeat(12010)}\n${matchingLines.join('\n')}`;
  const texts = new Map();
  let serial = 0;
  let foreignRead = false;
  const addTab = (id, initialUrl, text) => {
    let currentUrl = initialUrl;
    texts.set(id, text);
    service.tabs.set(id, { state: {}, webContents: {
      isDestroyed: () => false,
      isLoading: () => false,
      getURL: () => currentUrl,
      setBackgroundThrottling: () => {},
      loadURL: async (url) => { currentUrl = url; },
      executeJavaScript: async (script) => vm.runInNewContext(script, { document: { title: id, body: { innerText: texts.get(id) } } })
    } });
  };
  service.tabs.set('user-private', { state: {}, webContents: {
    isDestroyed: () => false, getURL: () => 'http://127.0.0.1:5000/private',
    executeJavaScript: async () => { foreignRead = true; return 'private'; }
  } });
  service.setApprovalHandler(async () => { throw new Error('fixture não deve abrir diálogo'); });
  service.setBrowserControls({
    createTab: async () => {
      serial++;
      const id = `task-${serial}`;
      addTab(id, serial === 1 ? startUrl : 'about:blank', serial === 7 ? longText : `produto filial ${serial}`);
      return { tabId: id };
    },
    closeTab: async (id) => { service.tabs.delete(id); }
  });
  service.setAgentConfigProvider(async () => ({ provider: 'openrouter', model: 'fixture', apiKey: 'fixture' }));
  const makeCall = (id, args) => ({ id, type: 'function', function: { name: 'tabs', arguments: JSON.stringify(args) } });
  const originalFetch = global.fetch;
  let round = 0;
  let firstBatch;
  let secondBatch;
  const chunks = [];
  let changedPage;
  let staleTabs;
  let outside;
  global.fetch = async (_url, options) => {
    const messages = JSON.parse(options.body).messages;
    const output = (id) => JSON.parse(messages.find((m) => m.tool_call_id === id).content);
    round++;
    let toolCalls;
    if (messages.some((m) => m.tool_call_id === 'outside')) {
      outside = output('outside');
      return { ok: true, json: async () => ({ choices: [{ message: { role: 'assistant', content: 'Leitura concluída.' } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) };
    } else if (messages.some((m) => m.tool_call_id === 'stale-tabs')) {
      staleTabs = output('stale-tabs');
      toolCalls = [makeCall('outside', { action: 'read_batch', query: 'produto', tabId: 'user-private' })];
    } else if (messages.some((m) => m.tool_call_id === 'new-extra')) {
      toolCalls = [makeCall('stale-tabs', { action: 'read_batch', query: 'produto', tabOffset: firstBatch.nextTabOffset, tabVersion: firstBatch.tabVersion })];
    } else if (messages.some((m) => m.tool_call_id === 'changed')) {
      changedPage = output('changed');
      toolCalls = [makeCall('new-extra', { action: 'new', url: 'http://127.0.0.1:5000/t/page-8' })];
    } else if (round === 1) {
      toolCalls = Array.from({ length: 6 }, (_, i) => makeCall(`new-${i}`, { action: 'new', url: `http://127.0.0.1:5000/t/page-${i + 2}` }));
      toolCalls.push(makeCall('batch-first', { action: 'read_batch', query: 'produto' }));
    } else if (round === 2) {
      firstBatch = output('batch-first');
      toolCalls = [makeCall('batch-next', { action: 'read_batch', query: 'produto', tabOffset: firstBatch.nextTabOffset, tabVersion: firstBatch.tabVersion })];
    } else if (round === 3) {
      secondBatch = output('batch-next');
      toolCalls = [makeCall('content-0', { action: 'read_batch', query: 'produto', tabId: 'task-7' })];
    } else if (round >= 4 && round < 12) {
      const previous = output(`content-${round - 4}`);
      const page = previous.pages[0];
      chunks.push(page);
      if (page.nextContentOffset !== undefined && page.nextContentOffset !== null) {
        toolCalls = [makeCall(`content-${round - 3}`, { action: 'read_batch', query: 'produto', tabId: 'task-7', contentOffset: page.nextContentOffset, contentVersion: page.contentVersion })];
      } else {
        texts.set('task-7', `${longText}\nproduto mudou`);
        toolCalls = [makeCall('changed', { action: 'read_batch', query: 'produto', tabId: 'task-7', contentOffset: 600, contentVersion: page.contentVersion })];
      }
    }
    if (!toolCalls) throw new Error('continuação de leitura excedeu o limite esperado');
    return { ok: true, json: async () => ({ choices: [{ message: { role: 'assistant', tool_calls: toolCalls } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) };
  };
  try {
    const result = await service.runTask({ startUrl, prompt: 'Leia todas as filiais.', approvalPolicy: 'local-fixture', maxSteps: 15 });
    assert.equal(result.success, true);
    assert.equal(firstBatch.pages.length, 6);
    assert.equal(firstBatch.coverage.complete, false);
    assert.equal(firstBatch.nextTabOffset, 6);
    assert.deepEqual(secondBatch.pages.map((p) => p.tabId), ['task-7']);
    assert.ok(chunks.length > 1, 'resultado longo exige continuação');
    assert.ok(chunks.every((p) => p.text.length <= 600));
    assert.equal(chunks.map((p) => p.text).join(''), matchingLines.join('\n'));
    assert.equal(changedPage.coverage.complete, false);
    assert.match(changedPage.pages[0].error, /mudou|versão/i);
    assert.equal(staleTabs.success, false);
    assert.match(staleTabs.error, /mudou|versão/i);
    assert.equal(foreignRead, false, 'uma aba alheia jamais é lida');
    assert.equal(outside.success, false);
  } finally {
    global.fetch = originalFetch;
  }
});

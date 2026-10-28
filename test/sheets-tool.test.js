const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {
  validateSheetsRequest, valuesToTsv, parseTsv, readRangeSummary, focusNameBoxScript
} = require('../src/automation/sheets-tool');

test('sheet requests validate range and values', () => {
  assert.equal(validateSheetsRequest({ action: 'read', range: 'A1:C20' }), null);
  assert.equal(validateSheetsRequest({ action: 'goto', range: 'b2' }), null);
  assert.match(validateSheetsRequest({ action: 'read', range: 'A' }), /intervalo A1/);
  assert.match(validateSheetsRequest({ action: 'read', range: 'A1:' }), /intervalo A1/);
  assert.match(validateSheetsRequest({ action: 'write', range: 'A1' }), /values/);
  assert.match(validateSheetsRequest({ action: 'write', range: 'A1', values: [[]] }), /vazia/);
  assert.match(validateSheetsRequest({ action: 'write', range: 'A1', values: new Array(501).fill(['x']) }), /500/);
  assert.equal(validateSheetsRequest({ action: 'write', range: 'A1', values: [['a', 'b'], [1, true]] }), null);
});

test('TSV round-trip and range summary', () => {
  const values = [['Produto', 'Estoque'], ['Cadeira', 20]];
  assert.equal(valuesToTsv(values), 'Produto\tEstoque\nCadeira\t20');
  assert.deepEqual(parseTsv('a\tb\n1\t2'), [['a', 'b'], ['1', '2']]);
  const summary = readRangeSummary('a\tb\tc\n1\t2\t3', { maxRows: 1, maxColumns: 2 });
  assert.deepEqual(summary.values, [['a', 'b']]);
  assert.equal(summary.rows, 1);
  assert.equal(summary.columns, 2);
  assert.equal(summary.truncated, true);
  assert.equal(readRangeSummary('').rows, 0);
});

test('the name box script focuses and clears the real input', () => {
  class HTMLInputElement {}
  Object.defineProperty(HTMLInputElement.prototype, 'value', {
    configurable: true,
    get() { return this._value; },
    set(next) { this._value = next; }
  });
  const box = new HTMLInputElement();
  box._value = 'A1';
  box.offsetParent = {};
  box.focus = () => { box.focused = true; };
  box.dispatchEvent = () => {};
  const document = {
    querySelector: (selector) => (selector === 'input.waffle-name-box' ? box : null)
  };
  const result = vm.runInNewContext(focusNameBoxScript(), { document, HTMLInputElement, Event });
  assert.equal(result.found, true);
  assert.equal(box.focused, true);
  assert.equal(box._value, '', 'o valor é limpo para o host digitar o intervalo');
});

async function rodar(service, url, toolCalls, { policy = 'ask' } = {}) {
  const originalFetch = global.fetch;
  let round = 0;
  const outputs = {};
  global.fetch = async (_url, options) => {
    const messages = JSON.parse(options.body).messages;
    for (const message of messages) {
      if (message.role === 'tool' && /^(write|read)$/.test(message.tool_call_id)) outputs[message.tool_call_id] = JSON.parse(message.content);
    }
    const call = toolCalls[round];
    round += 1;
    const message = call
      ? { role: 'assistant', tool_calls: [{ id: call.id, type: 'function', function: { name: call.name, arguments: JSON.stringify(call.args) } }] }
      : { role: 'assistant', content: 'Pronto.' };
    return { ok: true, json: async () => ({ choices: [{ message }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) };
  };
  try {
    const result = await service.runTask({ startUrl: url, prompt: 'Planilha', approvalPolicy: policy });
    return { result, outputs };
  } finally {
    global.fetch = originalFetch;
  }
}

test('sheets writes TSV and reads the range back without clicking cells', async () => {
  const { AutomationService } = require('../src/automation/service');
  const service = new AutomationService();
  const url = 'https://docs.google.com/spreadsheets/d/abc/edit';
  const board = { value: '' };
  const calls = [];
  service.setClipboard({ readText: () => board.value, writeText: (text) => { board.value = text; } });
  service.setApprovalHandler(async () => true);
  service.tabs.set('tab-sheet', {
    state: { url },
    webContents: {
      isDestroyed: () => false, isLoading: () => false, getURL: () => url,
      setBackgroundThrottling: () => {},
      executeJavaScript: async (script) => (String(script).includes('t-name-box') ? { found: true } : null),
      insertText: async (text) => { calls.push(['insertText', text]); },
      debugger: { isAttached: () => false, attach: () => {}, detach: () => {}, sendCommand: async (method, params) => { calls.push([method, params]); return {}; } }
    }
  });
  service.setBrowserControls({ createTab: async () => ({ tabId: 'tab-sheet' }), closeTab: async () => {} });
  service.setAgentConfigProvider(async () => ({ provider: 'openrouter', model: 'test-model', apiKey: 'test-key' }));

  const { result, outputs } = await rodar(service, url, [
    { id: 'write', name: 'sheets', args: { action: 'write', range: 'A1', values: [['Produto', 'Estoque'], ['Cadeira', '20']] } },
    { id: 'read', name: 'sheets', args: { action: 'read', range: 'A1:B2' } }
  ]);
  assert.equal(result.success, true);
  assert.equal(outputs.write.success, true);
  assert.equal(board.value, 'Produto\tEstoque\nCadeira\t20');
  assert.deepEqual(outputs.read.values, [['Produto', 'Estoque'], ['Cadeira', '20']]);
  assert.equal(outputs.read.rows, 2);
  assert.equal(outputs.read.cells, 4);
  assert.ok(calls.some(([kind, value]) => kind === 'insertText' && value === 'A1'));
  assert.ok(calls.some(([method, params]) => method === 'Input.dispatchKeyEvent' && params.key === 'v' && params.modifiers === 2), 'Ctrl+V real');
  assert.ok(calls.some(([method, params]) => method === 'Input.dispatchKeyEvent' && params.key === 'c' && params.modifiers === 2), 'Ctrl+C real');
  assert.equal(result.trace.sheetsWrites, 1);
  assert.equal(result.trace.sheetsReads, 1);
  assert.equal(result.trace.sheetsCells, 4);
});

test('sheets refuses a page that is not a spreadsheet', async () => {
  const { AutomationService } = require('../src/automation/service');
  const service = new AutomationService();
  const url = 'http://127.0.0.1:5000/t/outra';
  service.setClipboard({ readText: () => '', writeText: () => {} });
  service.tabs.set('tab-other', {
    state: { url },
    webContents: {
      isDestroyed: () => false, isLoading: () => false, getURL: () => url,
      setBackgroundThrottling: () => {}, executeJavaScript: async () => null,
      debugger: { isAttached: () => false, attach: () => {}, detach: () => {}, sendCommand: async () => ({}) }
    }
  });
  service.setBrowserControls({ createTab: async () => ({ tabId: 'tab-other' }), closeTab: async () => {} });
  service.setAgentConfigProvider(async () => ({ provider: 'openrouter', model: 'test-model', apiKey: 'test-key' }));
  const { outputs } = await rodar(service, url, [{ id: 'read', name: 'sheets', args: { action: 'read', range: 'A1' } }], { policy: 'local-fixture' });
  assert.equal(outputs.read.success, false);
  assert.match(outputs.read.error, /docs\.google\.com\/spreadsheets/);
});

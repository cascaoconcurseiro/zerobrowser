const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {
  validateRequest, mapColumns, shapeRows, buildTableScript, MAX_ROWS
} = require('../src/automation/table-extractor');

test('table requests are validated before touching the page', () => {
  assert.equal(validateRequest({}), null);
  assert.match(validateRequest({ selector: '   ' }), /selector/);
  assert.match(validateRequest({ tableIndex: -1 }), /tableIndex/);
  assert.match(validateRequest({ maxRows: MAX_ROWS + 1 }), /maxRows/);
  assert.match(validateRequest({ columns: [] }), /columns/);
  assert.match(validateRequest({ columns: ['ok', '  '] }), /Coluna 2/);
});

test('columns are matched by normalized header and missing ones are reported empty', () => {
  const mapped = mapColumns(['Nome', 'Preço (R$)', 'Ação'], ['preco (r$)', 'Nome', 'Inexistente']);
  assert.deepEqual(mapped.indexes, [1, 0, -1]);
  assert.deepEqual(mapped.missing, ['Inexistente']);
});

test('rows are named, trimmed, deduplicated and limited', () => {
  const shaped = shapeRows([
    ['  Ana  ', ' 10 '],
    ['Ana', '10'],
    ['', ''],
    ['Bia', ' 20'],
    ['Caio', '30']
  ], { headers: ['nome', 'valor'], columns: ['nome', 'valor'], maxRows: 2 });
  assert.deepEqual(shaped.rows, [{ nome: 'Ana', valor: '10' }, { nome: 'Bia', valor: '20' }]);
  assert.equal(shaped.duplicatesSkipped, 1);
  assert.equal(shaped.returned, 2);
  assert.equal(shaped.truncated, true);
  assert.deepEqual(shaped.missingColumns, []);
});

test('a missing requested column becomes an empty field instead of shifting others', () => {
  const shaped = shapeRows([['Ana', '10']], { headers: ['nome', 'valor'], columns: ['valor', 'total'] });
  assert.deepEqual(shaped.rows, [{ valor: '10', total: '' }]);
  assert.deepEqual(shaped.missingColumns, ['total']);
});

test('the page script returns a raw grid from a real-shaped table', () => {
  const table = {
    rows: [
      { cells: [{ innerText: 'Nome' }, { innerText: 'Valor' }] },
      { cells: [{ innerText: ' Ana ' }, { innerText: '10' }] },
      { cells: [{ innerText: 'Bia' }, { textContent: '20' }] }
    ]
  };
  const document = { querySelectorAll: (selector) => (selector === 'table' ? [table] : []) };
  const script = buildTableScript({});
  const raw = JSON.parse(JSON.stringify(vm.runInNewContext(script, { document })));
  assert.equal(raw.found, true);
  assert.deepEqual(raw.headers, ['Nome', 'Valor']);
  assert.deepEqual(raw.rows, [['Ana', '10'], ['Bia', '20']]);
  assert.equal(raw.totalRows, 2);
});

test('the page script reports when no table with rows exists', () => {
  const raw = JSON.parse(JSON.stringify(vm.runInNewContext(buildTableScript({ selector: '.x' }), { document: { querySelectorAll: () => [] } })));
  assert.equal(raw.found, false);
  assert.equal(raw.tableCount, 0);
});

test('run_task exposes extract_table only when enabled and returns host-shaped rows', async () => {
  const { AutomationService } = require('../src/automation/service');
  const service = new AutomationService();
  const url = 'http://127.0.0.1:5000/t/tabela';
  const table = {
    rows: [
      { cells: [{ innerText: 'Produto' }, { innerText: 'Estoque' }] },
      { cells: [{ innerText: 'Cadeira' }, { innerText: '20' }] },
      { cells: [{ innerText: 'Mesa' }, { innerText: '4' }] }
    ]
  };
  service.tabs.set('tab-table', {
    state: { url },
    webContents: {
      isDestroyed: () => false, isLoading: () => false, getURL: () => url,
      executeJavaScript: async (script) => (String(script).includes('querySelectorAll') ? vm.runInNewContext(script, { document: { querySelectorAll: () => [table] } }) : ''),
      setBackgroundThrottling: () => {}
    }
  });
  service.setBrowserControls({ createTab: async () => ({ tabId: 'tab-table' }), closeTab: async () => {} });
  service.setAgentConfigProvider(async () => ({ provider: 'openrouter', model: 'test-model', apiKey: 'test-key' }));
  const originalFetch = global.fetch;
  let round = 0;
  let output;
  global.fetch = async (_url, options) => {
    const messages = JSON.parse(options.body).messages;
    const message = messages.find((item) => item.tool_call_id === 'table');
    if (message) output = JSON.parse(message.content);
    round += 1;
    const response = round === 1
      ? { role: 'assistant', tool_calls: [{ id: 'table', type: 'function', function: { name: 'extract_table', arguments: '{"columns":["produto","estoque"]}' } }] }
      : { role: 'assistant', content: 'Cadeira 20; Mesa 4.' };
    return { ok: true, json: async () => ({ choices: [{ message: response }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) };
  };
  try {
    const result = await service.runTask({
      startUrl: url, prompt: 'Extraia a tabela', approvalPolicy: 'local-fixture', structuredExtraction: true
    });
    assert.equal(result.success, true);
    assert.equal(output.success, true);
    assert.deepEqual(output.columns, ['produto', 'estoque']);
    assert.deepEqual(output.rows, [{ produto: 'Cadeira', estoque: '20' }, { produto: 'Mesa', estoque: '4' }]);
    assert.equal(output.totalRows, 2);
    assert.equal(result.trace.tableRows, 2);

    round = 0;
    const disabled = await service.runTask({ startUrl: url, prompt: 'Extraia', approvalPolicy: 'local-fixture' });
    assert.equal(disabled.success, true, 'a resposta final do modelo não muda');
    assert.equal(output.success, false, 'sem a flag a ferramenta recusa');
  } finally {
    global.fetch = originalFetch;
  }
});

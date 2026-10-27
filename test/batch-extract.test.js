const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { AutomationService } = require('../src/automation/service');

function table(rows) {
  return { rows: [{ cells: [{ innerText: 'Produto' }, { innerText: 'Estoque' }] }, ...rows.map(([name, qty]) => ({ cells: [{ innerText: name }, { innerText: qty }] }))] };
}

function montar() {
  const service = new AutomationService();
  const origin = 'http://127.0.0.1:5000';
  const addTab = (id, path, grid) => {
    let currentUrl = `${origin}${path}`;
    service.tabs.set(id, { state: {}, webContents: {
      isDestroyed: () => false,
      isLoading: () => false,
      getURL: () => currentUrl,
      setBackgroundThrottling: () => {},
      loadURL: async (url) => { currentUrl = url; },
      executeJavaScript: async (script) => (String(script).includes('querySelectorAll')
        ? vm.runInNewContext(script, { document: { querySelectorAll: () => [grid] } })
        : '')
    } });
  };
  let criadas = 0;
  service.setApprovalHandler(async () => { throw new Error('tarefa não deve abrir diálogo'); });
  service.setAgentConfigProvider(async () => ({ provider: 'openrouter', model: 'test-model', apiKey: 'test-key' }));
  service.setBrowserControls({
    createTab: async () => {
      criadas += 1;
      if (criadas === 1) {
        addTab('tab-a', '/t/estoque?f=norte', table([['Cadeira', '20'], ['Mesa', '4']]));
        return { tabId: 'tab-a' };
      }
      addTab('tab-b', '/t/estoque?f=sul', table([['Cadeira', '20'], ['Sofá', '7']]));
      return { tabId: 'tab-b' };
    },
    closeTab: async () => {}
  });
  return { service, origin };
}

async function executar(service, origin, extractArgs) {
  const originalFetch = global.fetch;
  let round = 0;
  let output;
  global.fetch = async (_url, options) => {
    const messages = JSON.parse(options.body).messages;
    const toolMessage = messages.find((message) => message.tool_call_id === 'batch');
    if (toolMessage) output = JSON.parse(toolMessage.content);
    round += 1;
    const call = (id, name, args) => ({ id, type: 'function', function: { name, arguments: JSON.stringify(args) } });
    const message = round === 1 ? { role: 'assistant', tool_calls: [call('open', 'tabs', { action: 'new', url: `${origin}/t/estoque?f=sul` })] }
      : round === 2 ? { role: 'assistant', tool_calls: [call('batch', 'tabs', { action: 'read_batch', extract: extractArgs })] }
        : { role: 'assistant', content: 'Lido.' };
    return { ok: true, json: async () => ({ choices: [{ message }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) };
  };
  try {
    const result = await service.runTask({ startUrl: `${origin}/t/estoque?f=norte`, prompt: 'Leia os estoques', approvalPolicy: 'local-fixture' });
    return { result, output };
  } finally {
    global.fetch = originalFetch;
  }
}

test('read_batch extracts structured rows from every task tab on the same origin', async () => {
  const { service, origin } = montar();
  const { result, output } = await executar(service, origin, { columns: ['produto', 'estoque'] });
  assert.equal(result.success, true);
  assert.equal(output.success, true);
  assert.equal(output.pages.length, 2, 'as duas abas da tarefa entram');
  assert.deepEqual(output.pages[0].rows, [{ produto: 'Cadeira', estoque: '20' }, { produto: 'Mesa', estoque: '4' }]);
  assert.deepEqual(output.pages[1].rows, [{ produto: 'Cadeira', estoque: '20' }, { produto: 'Sofá', estoque: '7' }]);
  assert.equal(output.rowsReturned, 4);
  assert.equal(output.rowsTotal, 4);
  assert.equal(output.coverage.complete, true);
  assert.equal(result.trace.batchRows, 4);
  assert.equal(result.trace.batchTables, 2);
});

test('a missing requested column marks the tab truncated instead of shifting values', async () => {
  const { service, origin } = montar();
  const { output } = await executar(service, origin, { columns: ['produto', 'inexistente'] });
  assert.deepEqual(output.pages[0].missingColumns, ['inexistente']);
  assert.equal(output.pages[0].truncated, true);
  assert.deepEqual(output.pages[0].truncationReasons, ['missing_columns']);
  assert.deepEqual(output.pages[0].rows, [{ produto: 'Cadeira', inexistente: '' }, { produto: 'Mesa', inexistente: '' }]);
  assert.equal(output.coverage.complete, false);
});

test('structured reads reject text pagination arguments', async () => {
  const { service, origin } = montar();
  const originalFetch = global.fetch;
  let round = 0;
  let output;
  global.fetch = async (_url, options) => {
    const messages = JSON.parse(options.body).messages;
    const toolMessage = messages.find((message) => message.tool_call_id === 'batch');
    if (toolMessage) output = JSON.parse(toolMessage.content);
    round += 1;
    const message = round === 1
      ? { role: 'assistant', tool_calls: [{ id: 'batch', type: 'function', function: { name: 'tabs', arguments: JSON.stringify({ action: 'read_batch', extract: { columns: ['produto'] }, contentOffset: 10 }) } }] }
      : { role: 'assistant', content: 'ok' };
    return { ok: true, json: async () => ({ choices: [{ message }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) };
  };
  try {
    await service.runTask({ startUrl: `${origin}/t/a`, prompt: 'p', approvalPolicy: 'local-fixture' });
    assert.equal(output.success, false);
    assert.match(output.error, /não pagina texto/);
  } finally {
    global.fetch = originalFetch;
  }
});

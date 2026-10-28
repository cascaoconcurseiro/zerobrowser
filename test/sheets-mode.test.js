const test = require('node:test');
const assert = require('node:assert/strict');
const { validateSheetsRequest, SHEETS_TOOL } = require('../src/automation/sheets-tool');
const { AutomationService } = require('../src/automation/service');

const URL_SHEET = 'https://docs.google.com/spreadsheets/d/abc/edit';

// Aba falsa: caixa de nome funcional, clipboard em memória e snapshot compacto com abas.
function fakeSheetTab({ url = URL_SHEET, tabs = ['Resumo', 'Dados'] } = {}) {
  const board = { value: '' };
  const typed = [];
  const approvals = [];
  const service = new AutomationService();
  service.setClipboard({ readText: () => board.value, writeText: (text) => { board.value = text; } });
  service.setApprovalHandler(async (request) => { approvals.push(request); return true; });
  service.tabs.set('tab-sheet', {
    state: { url },
    webContents: {
      isDestroyed: () => false, isLoading: () => false, getURL: () => url,
      setBackgroundThrottling: () => {},
      insertText: async (text) => { typed.push(text); },
      executeJavaScript: async (script) => {
        const source = String(script);
        if (source.includes('role="tab"')) return { title: 'Vendas', selection: 'A1:B3', tabs };
        if (source.includes('value: String(box.value')) return { found: true, selector: '#t-name-box', value: 'A1:B3' };
        if (source.includes("setter.call(box, '')")) return { found: true, selector: '#t-name-box' };
        return null;
      },
      // Simula o Google Planilhas: Ctrl+C de uma seleção coloca o TSV da grade no clipboard.
      debugger: {
        isAttached: () => false, attach: () => {}, detach: () => {},
        sendCommand: async (_method, params) => {
          if (params?.key === 'c') board.value = ['Produto\tEstoque', 'Cadeira\t20'].join('\n');
          return {};
        }
      }
    }
  });
  service.setBrowserControls({ createTab: async () => ({ tabId: 'tab-sheet' }), closeTab: async () => {} });
  service.setAgentConfigProvider(async () => ({ provider: 'openrouter', model: 'test-model', apiKey: 'test-key' }));
  return { service, board, typed, approvals };
}

function runOnce(service, toolCall, { maxSteps = 3 } = {}) {
  const originalFetch = global.fetch;
  const outputs = [];
  let round = 0;
  global.fetch = async (_url, options) => {
    const messages = JSON.parse(options.body).messages;
    for (const message of messages) if (message.role === 'tool') outputs.push(JSON.parse(message.content));
    const call = round === 0 ? toolCall : null;
    round += 1;
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: call
          ? { role: 'assistant', tool_calls: [{ id: 'call-1', type: 'function', function: { name: call.name, arguments: JSON.stringify(call.args) } }] }
          : { role: 'assistant', content: 'Pronto.' } }],
        usage: { prompt_tokens: 1, completion_tokens: 1 }
      })
    };
  };
  return (async () => {
    try {
      return await service.runTask({ startUrl: URL_SHEET, prompt: 'Planilha', approvalPolicy: 'ask', maxSteps });
    } finally {
      global.fetch = originalFetch;
    }
  })().then((result) => ({ result, outputs }));
}

test('batch is validated and accepts up to twelve operations', () => {
  assert.equal(SHEETS_TOOL.function.parameters.properties.action.enum.includes('batch'), true);
  assert.equal(validateSheetsRequest({ action: 'batch', operations: [{ action: 'read', range: 'A1' }] }), null);
  assert.match(validateSheetsRequest({ action: 'batch' }), /operations/);
  assert.match(validateSheetsRequest({ action: 'batch', operations: [] }), /operations/);
  assert.match(validateSheetsRequest({ action: 'batch', operations: [{ action: 'batch', range: 'A1' }] }), /read, write ou goto/);
  assert.match(validateSheetsRequest({ action: 'batch', operations: [{ action: 'read', range: 'nada' }] }), /Operação 1/);
  assert.match(validateSheetsRequest({ action: 'batch', operations: Array.from({ length: 13 }, () => ({ action: 'read', range: 'A1' })) }), /12/);
});

test('batch runs read, write and read in one call with a single write approval', async () => {
  const { service, board, typed, approvals } = fakeSheetTab();
  board.value = 'Produto\tEstoque\nCadeira\t20';
  const result = await service.sheetsAction('tab-sheet', service.tabs.get('tab-sheet'), {
    action: 'batch',
    operations: [
      { action: 'goto', range: 'A1' },
      { action: 'write', range: 'A1', values: [['Produto', 'Estoque']] },
      { action: 'read', range: 'A1:B2' }
    ]
  });
  assert.equal(result.success, true, result.error);
  assert.equal(result.total, 3);
  assert.equal(result.results.length, 3);
  assert.deepEqual(result.results[2].values, [['Produto', 'Estoque'], ['Cadeira', '20']]);
  assert.equal(approvals.filter((request) => request.kind === 'sheets_write').length, 1, 'uma aprovação para todas as escritas');
  assert.ok(typed.includes('A1'), 'a caixa de nome recebeu o intervalo');
  assert.deepEqual(result.results[1].range, 'A1', 'a escrita devolve o intervalo aplicado');
});

test('batch stops at the first failing operation and says where', async () => {
  const { service } = fakeSheetTab();
  service.tabs.get('tab-sheet').webContents.executeJavaScript = async (script) => {
    const source = String(script);
    if (source.includes('role="tab"')) return { title: 'Vendas', selection: '', tabs: [] };
    if (source.includes('value: String(box.value')) return { found: true, selector: '#t-name-box', value: '' };
    if (source.includes("setter.call(box, '')")) return { found: false };
    return null;
  };
  const result = await service.sheetsAction('tab-sheet', service.tabs.get('tab-sheet'), {
    action: 'batch',
    operations: [{ action: 'read', range: 'A1' }, { action: 'goto', range: 'B2' }]
  });
  assert.equal(result.success, false);
  assert.equal(result.code, 'BATCH_FAILED');
  assert.equal(result.failedAt, 1);
  assert.match(result.error, /Operação 1/);
});

test('inspect_page on a spreadsheet returns a compact snapshot instead of an AX tree', async () => {
  const { service } = fakeSheetTab();
  let axCalls = 0;
  service.getAccessibilityTree = async () => { axCalls += 1; return { success: true, tree: { url: URL_SHEET, nodes: [{ index: 1, role: 'button', name: 'Salvar' }] } }; };
  const { outputs } = await runOnce(service, { name: 'inspect_page', args: {} }, { maxSteps: 2 });
  const snapshot = outputs.find((output) => output && output.sheet);
  assert.ok(snapshot, 'o retorno precisa trazer o bloco sheet');
  assert.deepEqual(snapshot.sheet.tabs, ['Resumo', 'Dados']);
  assert.equal(snapshot.sheet.selection, 'A1:B3');
  assert.deepEqual(snapshot.nodes, []);
  assert.match(snapshot.note, /batch/);
  assert.equal(axCalls, 0, 'nenhum AX na planilha');
});

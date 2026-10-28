const test = require('node:test');
const assert = require('node:assert/strict');
const { AutomationService } = require('../src/automation/service');
const { JobStore } = require('../src/automation/job-store');
const { MemoryStore } = require('../src/automation/memory-store');
const { reviewAction } = require('../src/automation/guardian');

// Regressões encontradas na auditoria de 28/10.

test('a pausa da sessão atual volta com id e pode ser retomada pela interface', async () => {
  const service = new AutomationService();
  service.jobStore = new JobStore({ now: () => Date.now() });
  service.memoryStore = new MemoryStore({ now: () => Date.now() });
  service.rememberPausedRun('job-sessao', {
    messages: [{ role: 'user', content: 'tarefa' }],
    tabId: 'tab-1', rootTabId: 'tab-1', model: 'm', provider: 'openrouter',
    taskStartedAt: Date.now(), expiresAt: Date.now() + 60_000, lastUrl: 'https://a.test'
  });
  const jobs = await service.listJobs();
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].id, 'job-sessao', 'sem id o botão Continuar chamava sendAiMessage("") e não fazia nada');
});

test('module run sem code usa o módulo salvo e não é recusado pelo Guardian', () => {
  assert.equal(reviewAction({ name: 'module', args: { action: 'run', name: 'somar' } }).decision, 'allow');
  assert.equal(reviewAction({ name: 'module', args: { action: 'save' } }).decision, 'deny');
  assert.equal(reviewAction({ name: 'module', args: { action: 'save', name: 'x', code: 'return 1' } }).decision, 'allow');
  const unsafe = reviewAction({ name: 'module', args: { action: 'run', name: 'x', code: 'return process.env' } });
  assert.equal(unsafe.decision, 'deny');
});

test('a receita valida o contrato de saída quando a leitura vem dentro de um batch', async () => {
  const service = new AutomationService();
  const tab = {
    state: {},
    webContents: {
      isDestroyed: () => false, isLoading: () => false,
      getURL: () => 'https://docs.google.com/spreadsheets/d/abc/edit',
      executeJavaScript: async () => ''
    }
  };
  service.tabs.set('tab-b', tab);
  service.sheetsAction = async () => ({
    success: true,
    total: 2,
    results: [
      { step: 1, action: 'write', range: 'D1', success: true },
      { step: 2, action: 'read', range: 'A1:C2', success: true, values: [['Produto', 'Qtd', 'Preço'], ['Cabo', '2', 'R$ 10,00']] }
    ]
  });
  const result = await service.runRecipe('tab-b', tab, [
    { tool: 'sheets', args: { action: 'batch', operations: [{ action: 'write', range: 'D1' }, { action: 'read', range: 'A1:C2' }] } }
  ], {}, { properties: { total: { type: 'number', cell: 'C2' } }, required: ['total'] });
  assert.equal(result.success, true, result.error);
  assert.equal(result.output.total, 10);
});

test('o snapshot de planilha não reaproveita nós de outra página', async () => {
  const service = new AutomationService();
  const url = 'https://docs.google.com/spreadsheets/d/abc/edit';
  service.setClipboard({ readText: () => '', writeText: () => {} });
  service.tabs.set('tab-s', {
    state: {},
    webContents: {
      isDestroyed: () => false, isLoading: () => false, getURL: () => url,
      executeJavaScript: async (script) => (String(script).includes('role="tab"')
        ? { title: 'Planilha', selection: 'A1', tabs: ['Dados'] }
        : null)
    }
  });
  service.setAgentConfigProvider(async () => ({ provider: 'openrouter', model: 'm', apiKey: 'k' }));
  service.setBrowserControls({ createTab: async () => ({ tabId: 'tab-s' }), closeTab: async () => {} });
  const originalFetch = global.fetch;
  let snapshotOutput = null;
  let round = 0;
  global.fetch = async (_u, options) => {
    const messages = JSON.parse(options.body).messages;
    for (const message of messages) {
      if (message.role === 'tool') snapshotOutput = JSON.parse(message.content);
    }
    const call = round === 0
      ? { role: 'assistant', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'inspect_page', arguments: '{}' } }] }
      : { role: 'assistant', content: 'Pronto.' };
    round += 1;
    return { ok: true, json: async () => ({ choices: [{ message: call }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) };
  };
  try {
    await service.runTask({ startUrl: url, prompt: 'Planilha', approvalPolicy: 'ask', maxSteps: 2 });
  } finally {
    global.fetch = originalFetch;
  }
  assert.ok(snapshotOutput?.sheet, 'snapshot compacto esperado');
  assert.deepEqual(snapshotOutput.nodes, [], 'nenhum nó de outra página');
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { AutomationService } = require('../src/automation/service');
const { RecipeStore } = require('../src/automation/recipe-store');

function serviceWithTab(url) {
  const service = new AutomationService();
  service.recipeStore = new RecipeStore({});
  service.registerTools();
  const tab = {
    state: {},
    webContents: { isDestroyed: () => false, isLoading: () => false, getURL: () => url, executeJavaScript: async () => '' }
  };
  service.tabs.set('tab-1', tab);
  return { service, tab };
}

test('the MCP surface exposes recipes as callable integrations', async () => {
  const { service } = serviceWithTab('https://docs.google.com/spreadsheets/d/x/edit');
  const names = service.listTools().tools.map((tool) => tool.name);
  assert.ok(names.includes('recipe_list'));
  assert.ok(names.includes('recipe_run'));
});

test('recipe_list and recipe_run work end to end with an output contract', async () => {
  const { service } = serviceWithTab('https://docs.google.com/spreadsheets/d/x/edit');
  const origin = 'https://docs.google.com';
  await service.recipeStore.save(origin, 'ler-vendas', [
    { tool: 'sheets', args: { action: 'read', range: 'A1:B3' } }
  ], null, 'read', { properties: { total: { type: 'number', cell: 'B3' } }, required: ['total'] });
  service.sheetsAction = async () => ({ success: true, range: 'A1:B3', values: [['Produto', 'Valor'], ['Cabo', '10'], ['Total', 'R$ 1.234,50']] });

  const list = service.tools.get('recipe_list');
  const listed = await list.handler({ origin });
  assert.equal(listed.success, true);
  assert.equal(listed.recipes.length, 1);
  assert.deepEqual(listed.recipes[0].outputs, ['total']);

  const run = service.tools.get('recipe_run');
  const result = await run.handler({ origin, name: 'ler-vendas' });
  assert.equal(result.success, true, result.error);
  assert.equal(result.outputValid, true);
  assert.equal(result.output.total, 1234.5);

  const missingTab = await run.handler({ origin: 'https://outro.test', name: 'ler-vendas' });
  assert.equal(missingTab.success, false);
  assert.match(missingTab.error, /não existe/);
});

test('recipe_run refuses a tab on another origin instead of acting on the wrong page', async () => {
  const { service } = serviceWithTab('https://loja.test/');
  await service.recipeStore.save('https://docs.google.com', 'ler', [{ tool: 'sheets', args: { action: 'read', range: 'A1' } }], null, 'read');
  const result = await service.tools.get('recipe_run').handler({ origin: 'https://docs.google.com', name: 'ler' });
  assert.equal(result.success, false);
  assert.match(result.error, /Abra uma aba/);
});

test('recipe_run requires the declared inputs', async () => {
  const { service } = serviceWithTab('https://a.test/');
  await service.recipeStore.save('https://a.test', 'buscar', [
    { tool: 'wait_for', args: { text: '{{termo}}' }, expect: { text: '{{termo}}' } }
  ], { properties: { termo: { type: 'string' } }, required: ['termo'] });
  const result = await service.tools.get('recipe_run').handler({ origin: 'https://a.test', name: 'buscar' });
  assert.equal(result.success, false);
  assert.match(result.error, /Faltam entradas/);
});

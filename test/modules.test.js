const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ModuleStore, MODULE_TOOL, validateModule } = require('../src/automation/module-store');
const { AutomationService } = require('../src/automation/service');
const { reviewAction } = require('../src/automation/guardian');

function tempFile() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'zero-mod-'));
  return { directory, file: path.join(directory, 'modulos.json') };
}

test('modules accept only safe code and a valid name', () => {
  assert.equal(validateModule({ name: 'somar-coluna', code: 'return input.rows.length' }), null);
  assert.match(validateModule({ name: 'x', code: 'return require("fs")' }), /recusado/);
  assert.match(validateModule({ name: 'nome inválido!', code: 'return 1' }), /name/);
  assert.match(validateModule({ name: 'x', code: '' }), /obrigatório/);
  assert.equal(MODULE_TOOL.function.name, 'module');
});

test('a module is stored by origin, listed and executed later without a model', async () => {
  const { directory, file } = tempFile();
  try {
    const store = new ModuleStore({ filePath: file, now: () => 1000 });
    await store.save('https://planilha.test/a', {
      name: 'somar-coluna',
      code: 'return input.rows.reduce((total, row) => total + Number(String(row[1]).replace(",", ".")), 0)',
      description: 'Soma a coluna B'
    });
    assert.equal((await store.list('https://planilha.test/outra'))[0].description, 'Soma a coluna B');

    const restored = new ModuleStore({ filePath: file, now: () => 2000 });
    const module = await restored.get('https://planilha.test', 'somar-coluna');
    assert.ok(module);
    const { runTransform } = require('../src/automation/sandbox');
    const outcome = await runTransform(module.code, { rows: [['Cabo', '10'], ['Fita', '2,5']] });
    assert.equal(outcome.ok, true, outcome.error);
    assert.equal(outcome.result, 12.5);

    assert.equal(await restored.forget('https://planilha.test', 'somar-coluna'), true);
    assert.deepEqual(await restored.list('https://planilha.test'), []);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('the guard refuses a module with unsafe code before saving', () => {
  assert.equal(reviewAction({ name: 'module', args: { action: 'save', code: 'return 1' } }).decision, 'allow');
  const denied = reviewAction({ name: 'module', args: { action: 'save', code: 'return process.env' } });
  assert.equal(denied.decision, 'deny');
  assert.match(denied.reasons[0], /process/);
});

test('modules are exposed over MCP by origin', async () => {
  const service = new AutomationService();
  service.moduleStore = new ModuleStore({ now: () => 1000 });
  service.registerTools();
  await service.moduleStore.save('https://planilha.test', { name: 'contar', code: 'return input.items.length' });

  const list = await service.tools.get('module_list').handler({ origin: 'https://planilha.test' });
  assert.equal(list.success, true);
  assert.equal(list.modules[0].name, 'contar');

  const run = await service.tools.get('module_run').handler({ origin: 'https://planilha.test', name: 'contar', input: { items: [1, 2, 3] } });
  assert.equal(run.success, true, run.error);
  assert.equal(run.result, 3);

  const missing = await service.tools.get('module_run').handler({ origin: 'https://planilha.test', name: 'nao-existe' });
  assert.equal(missing.success, false);
});

test('a recipe can be exported and imported as a local artifact', async () => {
  const service = new AutomationService();
  const { RecipeStore } = require('../src/automation/recipe-store');
  service.recipeStore = new RecipeStore({});
  await service.recipeStore.save('https://a.test', 'abrir', [
    { tool: 'navigate', args: { url: 'https://a.test/painel' }, expect: { url: 'https://a.test/painel' } }
  ], null, 'read');

  const exported = await service.exportRecipe('https://a.test/qualquer', 'abrir');
  assert.equal(exported.success, true);
  assert.equal(exported.artifact.kind, 'zero-recipe');
  assert.equal(exported.artifact.origin, 'https://a.test');

  const other = new AutomationService();
  other.recipeStore = new RecipeStore({});
  const imported = await other.importRecipe(exported.artifact);
  assert.equal(imported.success, true, imported.error);
  assert.equal(imported.steps, 1);

  const invalid = await other.importRecipe({ ...exported.artifact, steps: [{ tool: 'click', args: {}, expect: {} }] });
  assert.equal(invalid.success, false);
  const wrongKind = await other.importRecipe({ kind: 'outra-coisa', version: 1 });
  assert.equal(wrongKind.success, false);
});

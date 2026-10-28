const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { RecipeStore, RECIPE_TOOL, validateRecipe, normalizeOrigin, applyRecipeInputs, missingRequiredInputs } = require('../src/automation/recipe-store');

const passo = (tool, args, expect) => ({ tool, args, expect });

test('recipes accept only stable steps with a mandatory expectation', () => {
  assert.equal(validateRecipe({ name: 'login', steps: [passo('navigate', { url: 'https://a.test/in' }, { url: 'https://a.test/painel' })] }), null);
  assert.equal(validateRecipe({ name: 'x', steps: [passo('wait_for', { text: 'Pronto' }, { text: 'Pronto' })] }), null);
  assert.match(validateRecipe({ name: 'x', steps: [passo('click', { index: 1 }, { text: 'a' })] }), /apenas/);
  assert.match(validateRecipe({ name: 'x', steps: [passo('click_text', { text: 'Enviar' }, {})] }), /expect/);
  assert.match(validateRecipe({ name: 'x', steps: [passo('navigate', { url: 'javascript:alert(1)' }, { text: 'a' })] }), /HTTP/);
  assert.match(validateRecipe({ name: 'x', steps: [passo('click_text', { text: '' }, { text: 'a' })] }), /args.text/);
  assert.match(validateRecipe({ name: 'nome inválido!', steps: [passo('wait_for', { text: 'a' }, { text: 'a' })] }), /name/);
  assert.match(validateRecipe({ name: 'x', steps: new Array(16).fill(passo('wait_for', { text: 'a' }, { text: 'a' })) }), /No máximo/);
  assert.equal(RECIPE_TOOL.function.name, 'recipe');
});

test('recipes are stored by origin and survive a new store instance', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'zero-recipe-'));
  const file = path.join(directory, 'receitas.json');
  try {
    const first = new RecipeStore({ filePath: file });
    await first.save('https://loja.test/pedido?x=1', 'finalizar', [passo('click_text', { text: 'Finalizar' }, { text: 'Pedido confirmado' })]);
    const listed = await first.list('https://loja.test/outra');
    assert.equal(listed.length, 1);
    assert.equal(listed[0].name, 'finalizar');
    assert.equal(listed[0].steps, 1);
    assert.equal(typeof listed[0].savedAt, 'number');
    assert.equal((await first.get('https://loja.test/', 'finalizar')).steps.length, 1);

    const second = new RecipeStore({ filePath: file });
    assert.equal((await second.get('https://loja.test', 'finalizar')).name, 'finalizar');
    assert.deepEqual(await second.list('https://outro.test'), []);

    fs.writeFileSync(file, '{ quebrado');
    const third = new RecipeStore({ filePath: file });
    assert.deepEqual(await third.list('https://loja.test'), [], 'arquivo corrompido vira loja vazia');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('origin normalization ignores path, query and trailing slash', () => {
  assert.equal(normalizeOrigin('https://loja.test/a/b?x=1#h'), 'https://loja.test');
  assert.equal(normalizeOrigin('http://127.0.0.1:5000/t/x'), 'http://127.0.0.1:5000');
  assert.equal(normalizeOrigin('file:///c:/x'), '');
  assert.equal(normalizeOrigin('nada'), '');
});

test('runRecipe executes stable steps and stops on the first unmet expectation', async () => {
  const { AutomationService } = require('../src/automation/service');
  const service = new AutomationService();
  const origin = 'http://127.0.0.1:5000';
  let currentUrl = `${origin}/inicio`;
  let text = 'Aguardando';
  service.tabs.set('tab-recipe', {
    state: {},
    webContents: {
      isDestroyed: () => false, isLoading: () => false, getURL: () => currentUrl,
      setBackgroundThrottling: () => {},
      loadURL: async (url) => { currentUrl = url; text = 'Bem-vindo'; },
      executeJavaScript: async (script) => (String(script).includes('.includes(') ? true : text)
    }
  });
  service.setApprovalHandler(async () => true);
  const steps = [
    passo('navigate', { url: `${origin}/painel` }, { url: `${origin}/painel` }),
    passo('wait_for', { text: 'Bem-vindo' }, { text: 'Bem-vindo' })
  ];
  const trace = {};
  const ok = await service.runRecipe('tab-recipe', service.tabs.get('tab-recipe'), steps, trace);
  assert.equal(ok.success, true);
  assert.equal(ok.completed, 2);
  assert.equal(trace.recipeSteps, 2);

  const badTrace = {};
  const bad = await service.runRecipe('tab-recipe', service.tabs.get('tab-recipe'), [
    passo('navigate', { url: `${origin}/erro` }, { url: `${origin}/outro` })
  ], badTrace);
  assert.equal(bad.success, false);
  assert.equal(bad.failedAt, 1);
  assert.match(bad.error, /pós-condição/);
  assert.equal(badTrace.recipeFailures, 1);
  assert.equal(bad.possibleCommit, true, 'navegação despachada pode ter tido efeito');
  assert.match(bad.readBeforeRetry, /leia a página/);
  const waitFail = await service.runRecipe('tab-recipe', service.tabs.get('tab-recipe'), [
    passo('wait_for', { text: 'Nunca aparece' }, { text: 'Nunca aparece' })
  ]);
  assert.equal(waitFail.success, false);
  assert.equal(waitFail.possibleCommit, false, 'esperar não altera a página');
});

test('recipes accept an input schema and substitute placeholders without touching the stored recipe', async () => {
  const schema = { type: 'object', properties: { nome: { type: 'string' }, qtd: { type: 'number' } }, required: ['nome'] };
  const steps = [passo('wait_for', { text: 'Olá {{nome}}' }, { text: 'Olá {{nome}}' })];
  assert.equal(validateRecipe({ name: 'saudar', steps, input: schema }), null);
  assert.match(validateRecipe({ name: 'x', steps, input: { properties: { a: { type: 'date' } } } }), /type/);
  assert.match(validateRecipe({ name: 'x', steps, input: { properties: { a: { type: 'string' } }, required: ['b'] } }), /required/);
  assert.deepEqual(missingRequiredInputs(schema, { nome: 'Ana' }), []);
  assert.deepEqual(missingRequiredInputs(schema, {}), ['nome']);

  const applied = applyRecipeInputs([passo('navigate', { url: 'https://x/{{nome}}' }, { url: 'https://x/{{nome}}' })], { nome: 'ana' });
  assert.equal(applied[0].args.url, 'https://x/ana');
  assert.equal(applied[0].expect.url, 'https://x/ana');
  assert.equal(steps[0].args.text, 'Olá {{nome}}', 'a receita guardada continua genérica');
  assert.throws(() => applyRecipeInputs([passo('wait_for', { text: '{{outro}}' }, { text: 'x' })], {}), /ausente/);

  const store = new RecipeStore();
  await store.save('https://x.test', 'saudar', steps, schema);
  assert.deepEqual(Object.keys((await store.get('https://x.test', 'saudar')).input.properties), ['nome', 'qtd']);
  const listed = await store.list('https://x.test');
  assert.deepEqual(listed[0].inputs, ['nome', 'qtd']);
});

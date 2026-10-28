const test = require('node:test');
const assert = require('node:assert/strict');
const { RecipeStore } = require('../src/automation/recipe-store');
const { AutomationService } = require('../src/automation/service');

function montar() {
  const service = new AutomationService();
  const url = 'http://127.0.0.1:5000/t/fluxo';
  service.recipeStore = new RecipeStore();
  service.tabs.set('tab-mint', {
    state: { url },
    webContents: {
      isDestroyed: () => false, isLoading: () => false, getURL: () => url,
      setBackgroundThrottling: () => {},
      executeJavaScript: async (script) => {
        const source = String(script);
        if (source.includes('.includes(')) return true;
        if (source.includes('innerText')) return 'Pronto';
        return null;
      },
      debugger: { isAttached: () => false, attach: () => {}, detach: () => {}, sendCommand: async () => ({}) }
    }
  });
  service.setBrowserControls({ createTab: async () => ({ tabId: 'tab-mint' }), closeTab: async () => {} });
  service.setAgentConfigProvider(async () => ({ provider: 'openrouter', model: 'test-model', apiKey: 'test-key' }));
  return { service, url };
}

async function rodar(service, url, { verify = null, saveRecipe = null } = {}) {
  const originalFetch = global.fetch;
  let round = 0;
  global.fetch = async () => {
    round += 1;
    const message = round === 1
      ? { role: 'assistant', tool_calls: [{ id: 'passos', type: 'function', function: {
        name: 'run_steps',
        arguments: JSON.stringify({ steps: [{ tool: 'wait_for', args: { text: 'Pronto' }, expect: { text: 'Pronto' } }] })
      } }] }
      : { role: 'assistant', content: 'Fluxo concluído.' };
    return { ok: true, json: async () => ({ choices: [{ message }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) };
  };
  try {
    return await service.runTask({
      startUrl: url, prompt: 'Espere o fluxo', approvalPolicy: 'local-fixture', actionScripts: true,
      ...(verify ? { verify, requireVerification: true } : {}), ...(saveRecipe ? { saveRecipe } : {})
    });
  } finally {
    global.fetch = originalFetch;
  }
}

test('a verified task with stable run_steps mints a recipe automatically', async () => {
  const { service, url } = montar();
  const result = await rodar(service, url, { verify: [{ kind: 'text', value: 'Pronto' }], saveRecipe: 'fluxo-pronto' });
  assert.equal(result.success, true);
  assert.deepEqual(result.minted, { name: 'fluxo-pronto', steps: 1, origin: 'http://127.0.0.1:5000' });
  assert.equal(result.trace.minted, 'fluxo-pronto');
  const recipe = await service.recipeStore.get('http://127.0.0.1:5000', 'fluxo-pronto');
  assert.equal(recipe.steps[0].tool, 'wait_for');
  assert.deepEqual(recipe.steps[0].expect, { text: 'Pronto' });
});

test('without an approved contract the mint is skipped with a reason', async () => {
  const { service, url } = montar();
  const result = await rodar(service, url, { saveRecipe: 'sem-contrato' });
  assert.equal(result.success, true);
  assert.equal(result.minted, undefined);
  assert.match(result.mintSkipped, /contrato de verificação/);
  assert.deepEqual(await service.recipeStore.list('http://127.0.0.1:5000'), []);
});

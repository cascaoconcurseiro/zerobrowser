const test = require('node:test');
const assert = require('node:assert/strict');
const { AutomationService } = require('../src/automation/service');

function service(tabUrl = 'https://a.test/canvas') {
  const s = new AutomationService();
  s.tabs.set('tab-v', {
    state: {},
    webContents: {
      isDestroyed: () => false, isLoading: () => false, getURL: () => tabUrl,
      executeJavaScript: async () => 'conteúdo', setBackgroundThrottling: () => {}
    }
  });
  s.setApprovalHandler(async () => true);
  return s;
}

test('a page with almost no controls suggests one visual capture instead of another inspection', async () => {
  const s = service();
  s.getAccessibilityTree = async () => ({ success: true, tree: { url: 'https://a.test/canvas', title: 'T', nodes: [{ index: 0, role: 'generic', name: 'canvas' }] } });
  const original = global.fetch;
  let toolOutput = null;
  let round = 0;
  global.fetch = async (_u, options) => {
    for (const message of JSON.parse(options.body).messages) {
      if (message.role === 'tool') toolOutput = JSON.parse(message.content);
    }
    const message = round === 0
      ? { role: 'assistant', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'inspect_page', arguments: '{}' } }] }
      : { role: 'assistant', content: 'Pronto.' };
    round += 1;
    return { ok: true, json: async () => ({ choices: [{ message }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) };
  };
  try {
    const result = await s.runAgent('tab-v', 'Leia a página', 'k', 'm');
    assert.equal(result.success, true, result.error);
    assert.ok(toolOutput, 'o snapshot deveria voltar como tool message');
    assert.match(String(toolOutput.visaoSugerida || ''), /see_page uma vez/);
  } finally {
    global.fetch = original;
  }
});

test('a page with controls does not get the visual suggestion', async () => {
  const s = service('https://a.test/form');
  s.getAccessibilityTree = async () => ({
    success: true,
    tree: {
      url: 'https://a.test/form', title: 'T',
      nodes: Array.from({ length: 6 }, (_, index) => ({ index, role: 'button', name: `Botão ${index}` }))
    }
  });
  const original = global.fetch;
  let toolOutput = null;
  let round = 0;
  global.fetch = async (_u, options) => {
    for (const message of JSON.parse(options.body).messages) {
      if (message.role === 'tool') toolOutput = JSON.parse(message.content);
    }
    const message = round === 0
      ? { role: 'assistant', tool_calls: [{ id: 'c2', type: 'function', function: { name: 'inspect_page', arguments: '{}' } }] }
      : { role: 'assistant', content: 'Pronto.' };
    round += 1;
    return { ok: true, json: async () => ({ choices: [{ message }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) };
  };
  try {
    await s.runAgent('tab-v', 'Leia a página', 'k', 'm');
    assert.equal(toolOutput.visaoSugerida, undefined);
  } finally {
    global.fetch = original;
  }
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { AutomationService } = require('../src/automation/service');

test('the final answer reports which tools spent the rounds', async () => {
  const s = new AutomationService();
  s.tabs.set('tab-t', {
    state: {},
    webContents: {
      isDestroyed: () => false, isLoading: () => false, getURL: () => 'https://a.test/p',
      executeJavaScript: async () => 'ok', setBackgroundThrottling: () => {}
    }
  });
  s.setApprovalHandler(async () => true);
  s.getAccessibilityTree = async () => ({ success: true, tree: { url: 'https://a.test/p', title: 'T', nodes: [] } });
  let round = 0;
  const original = global.fetch;
  global.fetch = async () => {
    const message = round === 0
      ? { role: 'assistant', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'inspect_page', arguments: '{}' } }] }
      : { role: 'assistant', content: 'Feito.' };
    round += 1;
    return { ok: true, json: async () => ({ choices: [{ message }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) };
  };
  try {
    const result = await s.runAgent('tab-t', 'Leia', 'k', 'm');
    assert.equal(result.success, true, result.error);
    assert.deepEqual(result.toolsUsed, { inspect_page: 1 });
  } finally {
    global.fetch = original;
  }
});

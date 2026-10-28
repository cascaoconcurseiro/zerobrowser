const test = require('node:test');
const assert = require('node:assert/strict');
const { AutomationService } = require('../src/automation/service');

test('the agent emits step and tool events for the panel', async () => {
  const s = new AutomationService();
  s.tabs.set('tab-e', {
    state: {},
    webContents: {
      isDestroyed: () => false, isLoading: () => false, getURL: () => 'https://a.test/e',
      executeJavaScript: async () => 'ok', setBackgroundThrottling: () => {}
    }
  });
  s.setApprovalHandler(async () => true);
  s.getAccessibilityTree = async () => ({ success: true, tree: { url: 'https://a.test/e', title: 'T', nodes: [] } });
  const events = [];
  let round = 0;
  const original = global.fetch;
  global.fetch = async () => {
    const message = round === 0
      ? { role: 'assistant', tool_calls: [{ id: 'e1', type: 'function', function: { name: 'inspect_page', arguments: '{}' } }] }
      : { role: 'assistant', content: 'Feito.' };
    round += 1;
    return { ok: true, json: async () => ({ choices: [{ message }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) };
  };
  try {
    await s.runAgent('tab-e', 'Leia', 'k', 'm', true, 'openrouter', false, { onEvent: (event) => events.push(event) });
    assert.deepEqual(events[0], { type: 'step', step: 1, maxSteps: 40 });
    const tool = events.find((event) => event.type === 'tool');
    assert.equal(tool.name, 'inspect_page');
    assert.equal(tool.ok, true);
    assert.ok(events.some((event) => event.type === 'step' && event.step === 2));
  } finally {
    global.fetch = original;
  }
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { getAgentTools } = require('../src/automation/tools/agent-tool-registry');

test('agent tool registry preserves the full Zero Browser capability catalog', () => {
  const tools = getAgentTools();
  assert.deepEqual(tools.map((tool) => tool.function.name), [
    'inspect_page', 'navigate', 'click', 'type_text', 'select_option', 'hover',
    'click_text', 'hidden_action', 'see_page', 'scroll', 'cua_action', 'tabs',
    'downloads', 'upload_file', 'go_back', 'wait_for', 'calculate', 'locator_action'
  ]);
  assert.equal(Buffer.byteLength(JSON.stringify(tools)), 7815);
  assert.ok(tools.every((tool) => tool.type === 'function' && tool.function.parameters));
});

test('agent tool registry returns an isolated copy for each run', () => {
  const first = getAgentTools();
  first[0].function.name = 'changed';
  assert.equal(getAgentTools()[0].function.name, 'inspect_page');
});

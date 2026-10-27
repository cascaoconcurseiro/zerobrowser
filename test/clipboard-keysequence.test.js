const test = require('node:test');
const assert = require('node:assert/strict');
const { validateClipboardRequest, shapeClipboardRead, MAX_WRITE } = require('../src/automation/clipboard');
const { validateSequence, needsFormApproval } = require('../src/automation/key-sequence');
const { performKeySequence } = require('../src/automation/cua-input');

test('clipboard requests are validated and reads are capped', () => {
  assert.equal(validateClipboardRequest({ action: 'read' }), null);
  assert.equal(validateClipboardRequest({ action: 'write', text: 'a\tb\n1\t2' }), null);
  assert.match(validateClipboardRequest({ action: 'write' }), /text/);
  assert.match(validateClipboardRequest({ action: 'read', maxChars: 0 }), /maxChars/);
  assert.match(validateClipboardRequest({ action: 'write', text: 'x'.repeat(MAX_WRITE + 1) }), /acima/);
  assert.deepEqual(shapeClipboardRead('abcdef', 4), { text: 'abcd', length: 6, truncated: true });
  assert.deepEqual(shapeClipboardRead('abc', 10), { text: 'abc', length: 3, truncated: false });
});

test('key sequences are bounded and only enter/space ask for form approval', () => {
  assert.equal(validateSequence([{ keys: ['ArrowDown'], repeat: 5 }]), null);
  assert.match(validateSequence([]), /ao menos/);
  assert.match(validateSequence([{ keys: [] }]), /1 a 4/);
  assert.match(validateSequence([{ keys: ['a'], repeat: 0 }]), /repeat/);
  assert.match(validateSequence(Array.from({ length: 5 }, () => ({ keys: ['Tab'], repeat: 50 }))), /acima de/);
  assert.equal(needsFormApproval([{ keys: ['ArrowDown'], repeat: 3 }, { keys: ['Tab'] }]), false);
  assert.equal(needsFormApproval([{ keys: ['Enter'] }]), true);
});

test('performKeySequence dispatches each chord with modifiers and repeat', async () => {
  const calls = [];
  const wc = {
    isDestroyed: () => false,
    debugger: {
      isAttached: () => false,
      attach: () => {},
      detach: () => {},
      sendCommand: async (method, params) => { calls.push([method, params]); return {}; }
    }
  };
  const result = await performKeySequence(wc, [{ keys: ['ArrowDown'], repeat: 3 }, { keys: ['Control', 'a'] }], { delayMs: 0 });
  assert.equal(result.success, true);
  assert.equal(result.chords, 4);
  const down = calls.filter(([, params]) => params.type === 'rawKeyDown');
  const up = calls.filter(([, params]) => params.type === 'keyUp');
  assert.equal(down.length, 5, '3 setas + modificador + tecla principal');
  assert.equal(up.length, 5);
  assert.ok(calls.some(([, params]) => params.key === 'Control' && params.modifiers === 2));
});

test('run_task writes and reads the clipboard, driving TSV bulk input', async () => {
  const { AutomationService } = require('../src/automation/service');
  const service = new AutomationService();
  const url = 'http://127.0.0.1:5000/t/planilha';
  const board = { value: '' };
  service.setClipboard({ readText: () => board.value, writeText: (text) => { board.value = text; } });
  service.setApprovalHandler(async () => true);
  service.tabs.set('tab-clip', {
    state: { url },
    webContents: {
      isDestroyed: () => false, isLoading: () => false, getURL: () => url,
      executeJavaScript: async () => null, setBackgroundThrottling: () => {},
      debugger: { isAttached: () => false, attach: () => {}, detach: () => {}, sendCommand: async () => ({}) }
    }
  });
  service.setBrowserControls({ createTab: async () => ({ tabId: 'tab-clip' }), closeTab: async () => {} });
  service.setAgentConfigProvider(async () => ({ provider: 'openrouter', model: 'test-model', apiKey: 'test-key' }));
  const originalFetch = global.fetch;
  const outputs = {};
  let round = 0;
  global.fetch = async (_url, options) => {
    const messages = JSON.parse(options.body).messages;
    for (const id of ['write', 'read', 'keys']) {
      const toolMessage = messages.find((message) => message.tool_call_id === id);
      if (toolMessage) outputs[id] = JSON.parse(toolMessage.content);
    }
    round += 1;
    const call = (id, name, args) => ({ id, type: 'function', function: { name, arguments: JSON.stringify(args) } });
    const message = round === 1 ? { role: 'assistant', tool_calls: [call('write', 'clipboard', { action: 'write', text: 'Produto\tEstoque\nCadeira\t20' })] }
      : round === 2 ? { role: 'assistant', tool_calls: [call('read', 'clipboard', { action: 'read' })] }
        : round === 3 ? { role: 'assistant', tool_calls: [call('keys', 'key_sequence', { steps: [{ keys: ['ArrowDown'], repeat: 2 }, { keys: ['Tab'] }] })] }
          : { role: 'assistant', content: 'Pronto.' };
    return { ok: true, json: async () => ({ choices: [{ message }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) };
  };
  try {
    const result = await service.runTask({ startUrl: url, prompt: 'Preencha a planilha', approvalPolicy: 'local-fixture' });
    assert.equal(result.success, true);
    assert.equal(outputs.write.success, true);
    assert.equal(board.value, 'Produto\tEstoque\nCadeira\t20');
    assert.equal(outputs.read.text, board.value);
    assert.equal(outputs.read.truncated, false);
    assert.equal(outputs.keys.chords, 3);
    assert.equal(result.trace.keyChords, 3);
    assert.equal(result.trace.clipboardWrites, 1);
    assert.equal(result.trace.clipboardReads, 1);
  } finally {
    global.fetch = originalFetch;
  }
});

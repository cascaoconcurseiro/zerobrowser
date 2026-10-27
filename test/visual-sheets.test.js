const test = require('node:test');
const assert = require('node:assert/strict');
const { validateVisualClick, pointFromNormalized } = require('../src/automation/visual-click');
const { isSheetsUrl, toggleSteps } = require('../src/automation/sheets');

test('visual click validation and normalized mapping', () => {
  assert.equal(validateVisualClick({ x: 0, y: 1000 }), null);
  assert.match(validateVisualClick({ x: -1, y: 10 }), /0 e 1000/);
  assert.match(validateVisualClick({ x: 10, y: '20' }), /números/);
  assert.equal(validateVisualClick({ x: 10, y: 20, expect: { text: 'ok' } }), null);
  assert.match(validateVisualClick({ x: 10, y: 20, expect: { css: '#x' } }), /expect/);
  assert.deepEqual(pointFromNormalized({ x: 500, y: 250 }, { width: 1000, height: 800 }), { x: 500, y: 200 });
  assert.deepEqual(pointFromNormalized({ x: 1000, y: 1000 }, { width: 1000, height: 800 }), { x: 999, y: 799 });
});

test('sheets accessibility is restricted to Google Sheets', () => {
  assert.equal(isSheetsUrl('https://docs.google.com/spreadsheets/d/abc/edit'), true);
  assert.equal(isSheetsUrl('https://docs.google.com/document/d/abc'), false);
  assert.equal(isSheetsUrl('http://docs.google.com/spreadsheets/d/abc'), false);
  assert.equal(isSheetsUrl('https://evil.test/spreadsheets'), false);
  assert.deepEqual(toggleSteps(), [{ keys: ['Control', 'Alt', 'z'] }]);
});

function fakeTab(service, url, { viewport = { width: 1000, height: 800 }, text = '' } = {}) {
  const events = [];
  service.tabs.set('tab-adv', {
    state: { url },
    webContents: {
      isDestroyed: () => false, isLoading: () => false, getURL: () => url,
      setBackgroundThrottling: () => {},
      executeJavaScript: async (script) => {
        const source = String(script);
        if (source.includes('innerWidth')) return viewport;
        if (source.includes('innerText')) return text;
        return null;
      },
      debugger: {
        isAttached: () => false,
        attach: () => {},
        detach: () => {},
        sendCommand: async (method, params) => { events.push([method, params]); return {}; }
      }
    }
  });
  service.setBrowserControls({ createTab: async () => ({ tabId: 'tab-adv' }), closeTab: async () => {} });
  service.setAgentConfigProvider(async () => ({ provider: 'openrouter', model: 'test-model', apiKey: 'test-key' }));
  service.setApprovalHandler(async () => true);
  return events;
}

async function rodar(service, url, toolCall, { policy = 'local-fixture' } = {}) {
  const originalFetch = global.fetch;
  let round = 0;
  let output;
  global.fetch = async (_url, options) => {
    const messages = JSON.parse(options.body).messages;
    const toolMessage = messages.find((message) => message.tool_call_id === 'adv');
    if (toolMessage) output = JSON.parse(toolMessage.content);
    round += 1;
    const message = round === 1 ? { role: 'assistant', tool_calls: [{ id: 'adv', type: 'function', function: toolCall }] }
      : { role: 'assistant', content: 'Pronto.' };
    return { ok: true, json: async () => ({ choices: [{ message }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) };
  };
  try {
    const result = await service.runTask({ startUrl: url, prompt: 'Teste', approvalPolicy: policy });
    return { result, output };
  } finally {
    global.fetch = originalFetch;
  }
}

test('visual_click converts normalized coordinates, clicks and verifies the postcondition', async () => {
  const { AutomationService } = require('../src/automation/service');
  const service = new AutomationService();
  const url = 'http://127.0.0.1:5000/t/canvas';
  const events = fakeTab(service, url, { text: 'OK' });
  const { result, output } = await rodar(service, url, { name: 'visual_click', arguments: JSON.stringify({ x: 500, y: 250, expect: { text: 'ok' } }) });
  assert.equal(result.success, true);
  assert.deepEqual(output.point, { x: 500, y: 200 });
  assert.equal(output.outcomeVerified, true);
  assert.equal(result.trace.visualClicks, 1);
  const click = events.find(([method, params]) => method === 'Input.dispatchMouseEvent' && params.type === 'mousePressed');
  assert.equal(click[1].x, 500);
  assert.equal(click[1].y, 200);
});

test('sheets_accessibility toggles the shortcut only on a spreadsheet page', async () => {
  const { AutomationService } = require('../src/automation/service');
  const service = new AutomationService();
  const sheets = 'https://docs.google.com/spreadsheets/d/abc/edit';
  const events = fakeTab(service, sheets);
  const ok = await rodar(service, sheets, { name: 'sheets_accessibility', arguments: '{}' }, { policy: 'ask' });
  assert.equal(ok.result.success, true);
  assert.equal(ok.output.chords, 1);
  assert.ok(events.some(([method, params]) => method === 'Input.dispatchKeyEvent' && params.key === 'Control'));
  assert.ok(events.some(([method, params]) => method === 'Input.dispatchKeyEvent' && params.key === 'z'));

  const other = 'http://127.0.0.1:5000/t/x';
  const second = new AutomationService();
  fakeTab(second, other);
  const denied = await rodar(second, other, { name: 'sheets_accessibility', arguments: '{}' });
  assert.equal(denied.output.success, false);
  assert.match(denied.output.error, /docs\.google\.com/);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { performCuaInput } = require('../src/automation/cua-input');

function createWebContents({ attached = false, failAtMethod = null, failAtCall = null } = {}) {
  const calls = [];
  let commandCount = 0;
  const debuggerApi = {
    attached,
    attach(version) { this.attached = true; calls.push({ operation: 'attach', version }); },
    isAttached() { return this.attached; },
    detach() { this.attached = false; calls.push({ operation: 'detach' }); },
    async sendCommand(method, params) {
      calls.push({ method, params });
      commandCount++;
      if (failAtMethod === method && (!failAtCall || commandCount === failAtCall)) throw new Error('fixture CDP failure');
      return {};
    }
  };
  return { webContents: { debugger: debuggerApi, isDestroyed: () => false }, calls, debuggerApi };
}

test('CUA click dispatches real CDP mouse events and releases a debugger it attached', async () => {
  const { webContents, calls, debuggerApi } = createWebContents();
  const result = await performCuaInput(webContents, { kind: 'cua_click', x: 31, y: 44, button: 'right', modifiers: ['Control'] });
  assert.equal(result.success, true);
  const mouseEvents = calls.filter((call) => call.method === 'Input.dispatchMouseEvent');
  assert.deepEqual(mouseEvents.map((call) => call.params.type), ['mouseMoved', 'mousePressed', 'mouseReleased']);
  assert.equal(mouseEvents[1].params.button, 'right');
  assert.equal(mouseEvents[1].params.modifiers, 2);
  assert.equal(debuggerApi.isAttached(), false);
});

test('CUA drag always releases the mouse when an intermediate CDP move fails', async () => {
  const { webContents, calls, debuggerApi } = createWebContents({ failAtMethod: 'Input.dispatchMouseEvent', failAtCall: 3 });
  await assert.rejects(performCuaInput(webContents, { kind: 'cua_drag', path: [{x:1,y:2},{x:3,y:4}] }), /fixture CDP failure/);
  assert.equal(calls.filter((call) => call.method === 'Input.dispatchMouseEvent').at(-1).params.type, 'mouseReleased');
  assert.equal(debuggerApi.isAttached(), false);
});

test('CUA keypress handles a modifier chord and type inserts text through CDP', async () => {
  const { webContents, calls } = createWebContents();
  await performCuaInput(webContents, { kind: 'cua_keypress', keys: ['CTRL','A'] });
  const keyEvents = calls.filter((call) => call.method === 'Input.dispatchKeyEvent');
  assert.ok(keyEvents.some((call) => call.params.key === 'Control' && call.params.type === 'rawKeyDown'));
  assert.ok(keyEvents.some((call) => call.params.key === 'A' && call.params.type === 'rawKeyDown' && call.params.modifiers === 2));
  assert.ok(keyEvents.some((call) => call.params.key === 'Control' && call.params.type === 'keyUp'));
  await performCuaInput(webContents, { kind: 'cua_type', text: 'Navegante' });
  assert.deepEqual(calls.find((call) => call.method === 'Input.insertText').params, { text: 'Navegante' });
});

test('CUA leaves a debugger attached by another consumer untouched and rejects invalid coordinates', async () => {
  const { webContents, calls, debuggerApi } = createWebContents({ attached: true });
  await performCuaInput(webContents, { kind: 'cua_move', x: 10, y: 20 });
  assert.equal(debuggerApi.isAttached(), true);
  assert.equal(calls.some((call) => call.operation === 'detach'), false);
  await assert.rejects(performCuaInput(webContents, { kind: 'cua_click', x: -1, y: 0 }), /Ponto CUA inválido/);
});

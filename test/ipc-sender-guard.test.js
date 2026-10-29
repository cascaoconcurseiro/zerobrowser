const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { isTrustedMainUiEvent, withTrustedMainUi } = require('../src/ipc/trusted-ui');

const ROOT = path.join(__dirname, '..');
const TRUSTED_URL = 'file:///app/src/renderer/index.html';

function makeTrustedContext() {
  const mainFrame = { url: TRUSTED_URL };
  const webContents = { mainFrame, isDestroyed: () => false };
  return { mainFrame, webContents, context: { webContents, url: TRUSTED_URL } };
}

test('main UI IPC accepts only its exact top-level WebContents and URL', () => {
  const { mainFrame, webContents, context } = makeTrustedContext();
  const event = { sender: webContents, senderFrame: mainFrame };
  assert.equal(isTrustedMainUiEvent(event, context), true);
  assert.equal(isTrustedMainUiEvent({ sender: {}, senderFrame: mainFrame }, context), false);
  assert.equal(isTrustedMainUiEvent({ sender: webContents, senderFrame: { url: TRUSTED_URL } }, context), false);
  assert.equal(isTrustedMainUiEvent({ sender: webContents, senderFrame: { ...mainFrame, url: 'https://evil.test/' } }, context), false);
  assert.equal(isTrustedMainUiEvent({ sender: webContents }, context), false);
  assert.equal(isTrustedMainUiEvent(event, { ...context, url: 'file:///other/index.html' }), false);
  assert.equal(isTrustedMainUiEvent(event, { ...context, webContents: { ...webContents, isDestroyed: () => true } }), false);
  assert.equal(isTrustedMainUiEvent(event, null), false);
});

test('privileged IPC wrapper rejects before invoking the operation', () => {
  const { mainFrame, webContents, context } = makeTrustedContext();
  let calls = 0;
  const guarded = withTrustedMainUi((_event, value) => { calls += 1; return value; }, (event) => {
    if (!isTrustedMainUiEvent(event, context)) throw new Error('untrusted sender');
  });

  assert.throws(() => guarded({ sender: {}, senderFrame: mainFrame }, 'secret'), /untrusted sender/);
  assert.equal(calls, 0);
  assert.equal(guarded({ sender: webContents, senderFrame: mainFrame }, 'ok'), 'ok');
  assert.equal(calls, 1);
});

test('all UI IPC registrations in main.js and ipc/index.js use the trusted wrapper', () => {
  const main = fs.readFileSync(path.join(ROOT, 'src/main/main.js'), 'utf8');
  const ipc = fs.readFileSync(path.join(ROOT, 'src/ipc/index.js'), 'utf8');
  assert.equal((main.match(/\bipcMain\.handle\(/g) || []).length, 1, 'main.js should register channels only inside its guarded helper');
  assert.equal((ipc.match(/\bipcMain\.handle\(/g) || []).length, 1, 'ipc/index.js should register channels only inside its guarded helper');
  assert.match(main, /function handleMainUiIpc\(channel, handler\)\s*\{\s*ipcMain\.handle\(channel, withTrustedMainUi\(handler, assertTrustedMainUi\)\);/);
  assert.match(ipc, /const registerUiIpc = \(channel, handler\) => \{\s*ipcMain\.handle\(channel, withTrustedMainUi\(handler, assertTrustedUi\)\);/);
  assert.match(main, /setupIpc\(assertTrustedMainUi\)/);

  const mainChannels = [...main.matchAll(/\bhandleMainUiIpc\(\s*['"]([^'"]+)['"]/g)].map((match) => match[1]);
  const ipcChannels = [...ipc.matchAll(/\bregisterUiIpc\(\s*['"]([^'"]+)['"]/g)].map((match) => match[1]);
  assert.ok(mainChannels.length >= 35, `expected all main.js UI channels to use the guard, found ${mainChannels.length}`);
  assert.ok(ipcChannels.length >= 20, `expected all ipc/index.js UI channels to use the guard, found ${ipcChannels.length}`);
  assert.equal(new Set(mainChannels).size, mainChannels.length, 'main.js channel registration must remain unique');
  assert.equal(new Set(ipcChannels).size, ipcChannels.length, 'ipc/index.js channel registration must remain unique');
});

test('the obsolete sandbox worker is absent and transforms remain fail-closed', async () => {
  const workerPath = path.join(ROOT, 'src/automation/sandbox-worker.js');
  assert.equal(fs.existsSync(workerPath), false, 'orphan worker with vm execution must not ship in the src/**/* package glob');
  const sandbox = require('../src/automation/sandbox');
  const result = await sandbox.runTransform('return input', {});
  assert.equal(result.ok, false);
  assert.match(result.error, /desativada/);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { matchPatternToRegExp } = require('../src/main/extensions/extension-host');
const { ExtensionHost } = require('../src/main/extensions/extension-host');
const { lastReply } = require('../src/main/extensions/flame-runner');

test('chrome.tabs.query url patterns match like in Chrome', () => {
  assert.ok(matchPatternToRegExp('https://*/*').test('https://example.com/a'));
  assert.ok(!matchPatternToRegExp('https://*/*').test('http://example.com/a'));
  assert.ok(matchPatternToRegExp('<all_urls>').test('http://127.0.0.1:3000/t/01'));
  assert.ok(!matchPatternToRegExp('<all_urls>').test('chrome-extension://abc/x.html'));
});

test('the Flame reply is the panel text after the last prompt, without button labels', () => {
  const panel = 'Boas-vindas\nCancele minha assinatura Premium.\n\nMostrar detalhes do raciocínio\n\nNão encontrei Premium.\n\nCopy\nSave as Skill\nRetry';
  assert.equal(lastReply(panel, 'Cancele minha assinatura Premium.'), 'Não encontrei Premium.');
});

test('user extensions cannot replace or unload the protected primary Flame extension', async () => {
  const options = [];
  const removed = [];
  const session = {
    extensions: {
      loadExtension: async (extensionPath, settings) => {
        options.push({ extensionPath, settings });
        const isFlame = extensionPath === 'flame';
        return { id: isFlame ? 'flame-id' : 'user-id', name: isFlame ? 'Flame' : 'User extension', version: '1.0', manifest: isFlame ? { side_panel: { default_path: 'panel.html' } } : {} };
      },
      removeExtension: (id) => removed.push(id)
    }
  };
  const host = new ExtensionHost({ session, browser: {} });
  const flame = await host.loadExtension({ path: 'flame', primary: true, allowFileAccess: true });
  await host.loadExtension({ path: 'user', primary: false, allowFileAccess: false });
  assert.equal(host.primary, flame);
  assert.equal(host.extensionUrl('panel.html'), 'chrome-extension://flame-id/panel.html');
  assert.deepEqual(options.map((item) => item.settings.allowFileAccess), [true, false]);
  assert.throws(() => host.unloadExtension('flame-id'), /não pode ser removida/);
  assert.equal(host.unloadExtension('user-id'), true);
  assert.deepEqual(removed, ['user-id']);
  assert.equal(host.primary, flame);
});

test('management lists loaded extensions and only allows disabling third parties', () => {
  const host = Object.create(ExtensionHost.prototype);
  host.primaryId = 'flame-id';
  host.extensions = new Map([
    ['flame-id', { id: 'flame-id', name: 'Flame', version: '1.0' }],
    ['user-id', { id: 'user-id', name: 'User', version: '0.2' }]
  ]);
  const removed = [];
  host.session = { extensions: { removeExtension: (id) => removed.push(id) } };

  const list = host.managementList();
  assert.deepEqual(list.map((item) => item.id).sort(), ['flame-id', 'user-id']);
  assert.equal(list.find((item) => item.id === 'user-id').name, 'User');

  assert.throws(() => host.managementSetEnabled('flame-id', false), /principal/);
  assert.throws(() => host.managementSetEnabled('user-id', true), /Reativar|reativar/);
  assert.equal(host.managementSetEnabled('user-id', false), true);
  assert.deepEqual(removed, ['user-id']);
  assert.equal(host.extensions.has('user-id'), false);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { matchPatternToRegExp } = require('../src/main/extensions/extension-host');
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

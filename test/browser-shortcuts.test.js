'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { browserShortcutForInput } = require('../src/main/browser-shortcuts');

test('browser shortcuts are recognized only for keyDown with Ctrl/Command and no Alt', () => {
  assert.equal(browserShortcutForInput({ type: 'keyDown', key: 'h', control: true }), 'history');
  assert.equal(browserShortcutForInput({ type: 'keyDown', key: 'j', meta: true }), 'downloads');
  assert.equal(browserShortcutForInput({ type: 'keyDown', key: 't', control: true }), 'new-tab');
  assert.equal(browserShortcutForInput({ type: 'keyDown', key: 'w', control: true }), 'close-tab');
  assert.equal(browserShortcutForInput({ type: 'keyDown', key: 'l', control: true }), 'focus-address');
  assert.equal(browserShortcutForInput({ type: 'keyDown', key: 'r', control: true }), 'reload');
  assert.equal(browserShortcutForInput({ type: 'keyDown', key: 'd', control: true }), 'bookmark');
  assert.equal(browserShortcutForInput({ type: 'keyUp', key: 'h', control: true }), null);
  assert.equal(browserShortcutForInput({ type: 'keyDown', key: 'h' }), null);
  assert.equal(browserShortcutForInput({ type: 'keyDown', key: 'h', control: true, alt: true }), null);
  assert.equal(browserShortcutForInput({ type: 'keyDown', key: 'x', control: true }), null);
});

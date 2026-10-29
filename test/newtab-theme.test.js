const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { isNewtabPage, applyNewtabTheme } = require('../src/main/newtab-theme');

test('theme is applied only to the exact local new-tab document', async () => {
  const page = path.resolve(__dirname, '../src/renderer/newtab.html');
  const url = pathToFileURL(page).href;
  assert.equal(isNewtabPage(`${url}#open-copilot`, page), true);
  assert.equal(isNewtabPage('https://example.com/newtab.html', page), false);
  assert.equal(isNewtabPage(pathToFileURL(path.join(path.dirname(page), 'index.html')).href, page), false);
  let script = '';
  const view = { isDestroyed: () => false, getURL: () => url, executeJavaScript: async (value) => { script = value; } };
  assert.equal(await applyNewtabTheme(view, page, false), true);
  assert.match(script, /"light"/);
  view.getURL = () => 'https://example.com';
  assert.equal(await applyNewtabTheme(view, page, true), false);
});

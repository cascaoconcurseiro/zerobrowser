const test = require('node:test');
const assert = require('node:assert/strict');
const { migrateNestedKeys } = require('../src/store');

function fakeStore(data) {
  return {
    store: data,
    set(key, value) { data[key] = value; },
    delete(key) { delete data[key]; }
  };
}

test('settings saved in the old nested shape become flat keys and win over the defaults', () => {
  const data = {
    'automation.provider': 'openrouter',
    'developer.cdpEnabled': false,
    theme: 'system',
    automation: { provider: 'deepseek', model: { deepseek: 'deepseek-flash' }, deepseekApiKey: 'cifrado' },
    developer: { cdpEnabled: true }
  };
  migrateNestedKeys(fakeStore(data));
  assert.deepEqual(data, {
    'automation.provider': 'deepseek',
    'automation.model.deepseek': 'deepseek-flash',
    'automation.deepseekApiKey': 'cifrado',
    'developer.cdpEnabled': true,
    theme: 'system'
  });
});

test('a store that is already flat is left alone', () => {
  const data = { 'browser.showFullUrl': true, theme: 'dark' };
  migrateNestedKeys(fakeStore(data));
  assert.deepEqual(data, { 'browser.showFullUrl': true, theme: 'dark' });
});

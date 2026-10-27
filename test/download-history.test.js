const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadDownloadHistory, saveDownloadHistory, nextDownloadSequence } = require('../src/main/download-history');
const { buildTabMenuTemplate } = require('../src/main/tab-menu');

function tempFile() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dl-hist-')), 'historico.json');
}

test('histórico grava, ignora downloads de avaliação e marca em andamento como interrompido', () => {
  const file = tempFile();
  const records = [
    { id: 'd1', filename: 'a.pdf', url: 'https://x/a', state: 'completed', path: 'C:/a.pdf', receivedBytes: 10, totalBytes: 10, startedAt: 1, tabId: 't1' },
    { id: 'd2', filename: 'b.csv', url: 'https://x/b', state: 'progressing', path: '', receivedBytes: 1, totalBytes: 9, startedAt: 2 },
    { id: 'd3', filename: 'teste.csv', url: 'http://127.0.0.1/t', state: 'completed', path: 'C:/t.csv', startedAt: 3, evaluation: true }
  ];
  assert.equal(saveDownloadHistory(file, records), true);
  const loaded = loadDownloadHistory(file);
  assert.deepEqual(loaded.map((r) => [r.id, r.state]), [['d1', 'completed'], ['d2', 'interrupted']]);
  assert.equal(loaded[0].tabId, null);
  assert.equal(nextDownloadSequence(loaded), 2);
});

test('histórico respeita o limite e tolera arquivo ausente ou corrompido', () => {
  const file = tempFile();
  assert.deepEqual(loadDownloadHistory(file), []);
  fs.writeFileSync(file, '{ não é json');
  assert.deepEqual(loadDownloadHistory(file), []);
  const many = Array.from({ length: 12 }, (_, i) => ({ id: `d${i + 1}`, filename: 'f', state: 'completed', startedAt: i }));
  saveDownloadHistory(file, many, 5);
  assert.deepEqual(loadDownloadHistory(file, 5).map((r) => r.id), ['d8', 'd9', 'd10', 'd11', 'd12']);
});

test('menu da aba habilita só o que faz sentido', () => {
  const calls = [];
  const actions = {
    newTab: () => calls.push('new'), reload: (id) => calls.push(`reload:${id}`), duplicate: (id) => calls.push(`dup:${id}`),
    close: (id) => calls.push(`close:${id}`), closeMany: (ids, keep) => calls.push(`many:${ids.join(',')}|${keep}`), reopen: () => calls.push('reopen')
  };
  const only = buildTabMenuTemplate({ tabId: 'a', order: ['a'], canReopen: false, actions });
  const byLabel = (template, label) => template.find((item) => item.label === label);
  assert.equal(byLabel(only, 'Fechar aba').enabled, false);
  assert.equal(byLabel(only, 'Fechar outras abas').enabled, false);
  assert.equal(byLabel(only, 'Reabrir aba fechada').enabled, false);

  const menu = buildTabMenuTemplate({ tabId: 'b', order: ['a', 'b', 'c', 'd'], canReopen: true, actions });
  byLabel(menu, 'Fechar outras abas').click();
  byLabel(menu, 'Fechar abas à direita').click();
  byLabel(menu, 'Duplicar').click();
  assert.deepEqual(calls, ['many:a,c,d|b', 'many:c,d|b', 'dup:b']);
  const last = buildTabMenuTemplate({ tabId: 'd', order: ['a', 'b', 'c', 'd'], canReopen: true, actions });
  assert.equal(byLabel(last, 'Fechar abas à direita').enabled, false);
});

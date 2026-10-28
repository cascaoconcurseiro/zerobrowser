const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { mainContentScript } = require('../src/automation/page-text');

function run(document, limit = 1000) {
  return vm.runInNewContext(mainContentScript(limit), { document });
}

test('main content wins over the body so the target is not buried under the menu', () => {
  const body = `${'menu '.repeat(400)}CONTEÚDO ALVO`;
  const main = `${'texto do artigo '.repeat(60)}ALVO NO MAIN`;
  const document = {
    querySelector: (selector) => (selector === 'main' ? { innerText: main } : null),
    querySelectorAll: () => [{ innerText: 'Título principal' }, { innerText: 'Seção' }],
    body: { innerText: body }
  };
  const result = run(document);
  assert.equal(result.source, 'main');
  assert.match(result.text, /ALVO NO MAIN/);
  assert.ok(!result.text.includes('menu menu'), 'o menu não deve ocupar o orçamento');
  assert.equal(result.headings.join('|'), 'Título principal|Seção');
});

test('without a main container the body is used and still truncated', () => {
  const document = {
    querySelector: () => null,
    querySelectorAll: () => [],
    body: { innerText: 'a'.repeat(5000) }
  };
  const result = run(document, 800);
  assert.equal(result.source, 'body');
  assert.equal(result.text.length, 800);
});

test('a tiny main element is ignored in favour of the body', () => {
  const document = {
    querySelector: (selector) => (selector === 'main' ? { innerText: 'curto' } : null),
    querySelectorAll: () => [],
    body: { innerText: 'corpo completo com bem mais conteúdo' }
  };
  const result = run(document);
  assert.equal(result.source, 'body');
  assert.match(result.text, /corpo completo/);
});

test('headings are trimmed, cleaned and limited', () => {
  const many = Array.from({ length: 20 }, (_, index) => ({ innerText: `  Título ${index}\n  ` }));
  const document = { querySelector: () => null, querySelectorAll: () => many, body: { innerText: 'x' } };
  const result = run(document);
  assert.equal(result.headings.length, 12);
  assert.equal(result.headings[0], 'Título 0');
});

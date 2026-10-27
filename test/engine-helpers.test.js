const test = require('node:test');
const assert = require('node:assert/strict');
const { calculate } = require('../src/automation/calculator');
const { createRepeatGuard } = require('../src/automation/repeat-guard');
const { cachedInputTokens, compactHref } = require('../src/automation/usage-metrics');

test('calculate soma centavos sem erro de ponto flutuante', () => {
  assert.equal(calculate({ expression: '0.1 + 0.2' }).result, '0.3');
  assert.equal(calculate({ expression: '659.95 + 0.05' }).result, '660');
  assert.equal(calculate({ expression: '10.10 + 20.20 + 30.30' }).result, '60.6');
});

test('calculate respeita precedência, parênteses e menos unário', () => {
  assert.equal(calculate({ expression: '2 + 3 * 4' }).result, '14');
  assert.equal(calculate({ expression: '(2 + 3) * 4' }).result, '20');
  assert.equal(calculate({ expression: '-5 + 2' }).result, '-3');
  assert.equal(calculate({ expression: '10 / 4' }).result, '2.5');
});

test('calculate arredonda e limita casas decimais', () => {
  assert.equal(calculate({ expression: '10 / 3' }).result, '3.33');
  assert.equal(calculate({ expression: '10 / 3', decimals: 4 }).result, '3.3333');
  assert.equal(calculate({ expression: '2.675 * 1', decimals: 2 }).result, '2.68');
});

test('calculate recusa entrada insegura ou inválida', () => {
  assert.equal(calculate({ expression: 'process.exit()' }).success, false);
  assert.equal(calculate({ expression: '1 / 0' }).success, false);
  assert.equal(calculate({ expression: '(1 + 2' }).success, false);
  assert.equal(calculate({ expression: '1,5 + 2' }).success, false);
  assert.equal(calculate({}).success, false);
});

test('guarda de repetição avisa na segunda falha idêntica e zera após sucesso', () => {
  const guard = createRepeatGuard();
  const fail = { success: false };
  assert.equal(guard.record('click', { index: 3 }, fail), null);
  assert.ok(guard.record('click', { index: 3 }, fail));
  assert.equal(guard.record('click', { index: 4 }, fail), null);
  assert.equal(guard.record('click', { index: 3 }, { success: true }), null);
  assert.equal(guard.record('click', { index: 3 }, fail), null);
});

test('cachedInputTokens lê os campos de cache dos provedores', () => {
  assert.equal(cachedInputTokens({ prompt_cache_hit_tokens: 900 }), 900);
  assert.equal(cachedInputTokens({ prompt_tokens_details: { cached_tokens: 512 } }), 512);
  assert.equal(cachedInputTokens({ cache_read_input_tokens: 7 }), 7);
  assert.equal(cachedInputTokens(undefined), 0);
  assert.equal(cachedInputTokens({ prompt_tokens: 100 }), 0);
});

test('compactHref mantém links curtos e encurta links de rastreamento', () => {
  assert.deepEqual(compactHref('https://exemplo.com/a?b=1'), { href: 'https://exemplo.com/a?b=1' });
  const long = `https://loja.example/produto/123?ref=${'x'.repeat(300)}`;
  const out = compactHref(long);
  assert.equal(out.href, 'https://loja.example/produto/123');
  assert.equal(out.hrefTruncated, true);
});

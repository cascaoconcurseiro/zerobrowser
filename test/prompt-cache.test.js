const test = require('node:test');
const assert = require('node:assert/strict');
const { cacheKeyFor, cacheSeed, cacheRequestFields, cacheSummary } = require('../src/automation/prompt-cache');

const messages = [{ role: 'system', content: 'Você é o Zero Browser.' }, { role: 'user', content: 'Abra a planilha.' }];

test('cache is off by default and sends nothing extra', () => {
  const fields = cacheRequestFields({ provider: 'openrouter', model: 'x', messages, enabled: false, seed: 'a' });
  assert.equal(fields.prompt_cache_key, undefined);
  assert.equal(fields.messages, messages);
});

test('cache key is stable, short and provider-scoped', () => {
  const key = cacheKeyFor('tarefa-1');
  assert.equal(key, cacheKeyFor('tarefa-1'));
  assert.notEqual(key, cacheKeyFor('tarefa-2'));
  assert.ok(key.startsWith('zb-'));
  assert.ok(key.length <= 64);
  assert.equal(cacheSeed({ origin: 'https://a.test', prompt: 'p', model: 'm' }), cacheSeed({ origin: 'https://a.test', prompt: 'p', model: 'm' }));
  assert.notEqual(cacheSeed({ origin: 'https://a.test', prompt: 'p', model: 'm' }), cacheSeed({ origin: 'https://b.test', prompt: 'p', model: 'm' }));
});

test('only providers with explicit prefix cache receive prompt_cache_key', () => {
  const openai = cacheRequestFields({ provider: 'openai', model: 'gpt', messages, enabled: true, seed: 's' });
  assert.match(openai.prompt_cache_key, /^zb-/);
  const router = cacheRequestFields({ provider: 'openrouter', model: 'gpt', messages, enabled: true, seed: 's' });
  assert.equal(router.prompt_cache_key, openai.prompt_cache_key);
  const deepseek = cacheRequestFields({ provider: 'deepseek', model: 'deepseek-chat', messages, enabled: true, seed: 's' });
  assert.equal(deepseek.prompt_cache_key, undefined, 'DeepSeek cacheia sozinho; não inventamos campo');
  assert.equal(deepseek.messages, messages);
});

test('anthropic models get a cache breakpoint on the system message only', () => {
  const fields = cacheRequestFields({ provider: 'openrouter', model: 'anthropic/claude-3.5-sonnet', messages, enabled: true, seed: 's' });
  const system = fields.messages[0];
  assert.ok(Array.isArray(system.content));
  assert.deepEqual(system.content[0].cache_control, { type: 'ephemeral' });
  assert.equal(system.content[0].text, 'Você é o Zero Browser.');
  assert.equal(fields.messages[1], messages[1], 'mensagens seguintes ficam intactas');
});

test('cache summary tells whether it paid off', () => {
  assert.equal(cacheSummary({ inputTokens: 0 }).cacheUseful, false);
  const empty = cacheSummary({ inputTokens: 1000, cachedInputTokens: 0 });
  assert.equal(empty.cacheUseful, false);
  assert.match(empty.note, /desligue promptCache/);
  const hit = cacheSummary({ inputTokens: 1000, cachedInputTokens: 400 });
  assert.equal(hit.cacheUseful, true);
  assert.equal(hit.cacheHitRate, 40);
  assert.match(hit.note, /40%/);
});

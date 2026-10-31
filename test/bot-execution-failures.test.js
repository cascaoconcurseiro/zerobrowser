'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { BotTaskStore } = require('../src/bots/bot-store');
const { BotRunner } = require('../src/bots/runner');

test('Bot não anuncia conclusão quando ferramenta retorna erro', async () => {
  const store = new BotTaskStore();
  const bot = store.createBot({ name: 'Falha controlada' });
  let calls = 0;
  const runner = new BotRunner({ store, stepExecutor: async () => {
    calls++;
    return { ok: false, error: 'Página indisponível' };
  } });
  const result = await runner.runBotNow(bot.id, { steps: [{ tool: 'snapshot' }, { tool: 'snapshot' }] });
  assert.equal(result.status, 'failed');
  assert.match(result.error, /Página indisponível/);
  assert.equal(calls, 1);
});

test('parada transmite cancelamento à operação em andamento', async () => {
  const store = new BotTaskStore();
  const bot = store.createBot({ name: 'Cancelamento' });
  let started;
  const ready = new Promise((resolve) => { started = resolve; });
  let signal;
  const runner = new BotRunner({ store, stepExecutor: (_step, context) => {
    signal = context.signal;
    started();
    return new Promise((resolve) => signal.addEventListener('abort', () => resolve({ ok: false }), { once: true }));
  } });
  const pending = runner.runBotNow(bot.id, { steps: [{ tool: 'snapshot' }] });
  await ready;
  runner.stopAllBots();
  assert.equal((await pending).status, 'stopped');
  assert.equal(signal.aborted, true);
});

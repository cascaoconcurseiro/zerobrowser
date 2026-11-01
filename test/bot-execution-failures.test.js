'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { BotTaskStore } = require('../src/bots/bot-store');
const { BotRunner } = require('../src/bots/runner');

test('sem executor ou tarefa o Bot falha sem inventar resultado', async () => {
  const store = new BotTaskStore();
  const bot = store.createBot({ name: 'Sem executor' });
  const runner = new BotRunner({ store });
  const missing = await runner.runBotNow(bot.id, { steps: [{ tool: 'snapshot', mockData: { price: 10 } }] });
  assert.equal(missing.status, 'failed');
  assert.match(missing.error, /executor.*não está disponível/);
  assert.equal(missing.stepsExecuted, 0);
  const empty = await runner.runBotNow(bot.id);
  assert.equal(empty.status, 'failed');
  assert.match(empty.error, /Nenhuma tarefa/);
});

test('encerrar passo não anuncia objetivo atingido sem verificação', async () => {
  const store = new BotTaskStore();
  const bot = store.createBot({ name: 'Objetivo' });
  const notices = [];
  const runner = new BotRunner({ store, stepExecutor: async () => ({ ok: true, goalReached: true }) });
  const result = await runner.runBotNow(bot.id, { steps: [{ tool: 'snapshot', goalReached: true }], onAttention: (event) => notices.push(event) });
  assert.equal(result.status, 'completed');
  assert.deepEqual(notices, []);
  assert.equal(result.shouldBringToFront, false);
});

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

test('estado das execuções acompanha início, pedido de parada e término', async () => {
  const store = new BotTaskStore();
  const bot = store.createBot({ name: 'Estado' });
  const snapshots = [];
  const runner = new BotRunner({ store, onRunsChanged: (value) => snapshots.push(value), stepExecutor: () => Promise.resolve({ ok: true }) });
  const pending = runner.runBotNow(bot.id, { steps: [{ tool: 'wait' }] });
  assert.equal(snapshots[0].runs[0].botId, bot.id);
  runner.stopAllBots();
  assert.equal(snapshots[1].runs[0].stopping, true);
  assert.equal((await pending).status, 'stopped');
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(snapshots[2].runs, []);
  assert.deepEqual(snapshots.map((s) => s.revision), [1, 2, 3]);
});

test('execução permanece em parada até o executor encerrar sua limpeza', async () => {
  const store = new BotTaskStore();
  const bot = store.createBot({ name: 'Limpeza' });
  let started;
  let finishCleanup;
  const ready = new Promise((resolve) => { started = resolve; });
  const runner = new BotRunner({ store, stepExecutor: (_step, { signal }) => new Promise((resolve) => {
    signal.addEventListener('abort', () => { finishCleanup = () => resolve({ __aborted: true }); }, { once: true });
    started();
  }) });
  const pending = runner.runBotNow(bot.id, { steps: [{ tool: 'wait' }] });
  await ready;
  runner.stopAllBots();
  assert.equal((await pending).status, 'stopped');
  assert.equal(runner.getActiveRuns().runs[0].stopping, true);
  finishCleanup();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(runner.getActiveRuns().runs, []);
});

test('parada imediata não inicia o executor na próxima microtarefa', async () => {
  const store = new BotTaskStore();
  const bot = store.createBot({ name: 'Parada imediata' });
  let called = false;
  const runner = new BotRunner({ store, stepExecutor: () => { called = true; } });
  const pending = runner.runBotNow(bot.id, { steps: [{ tool: 'wait' }] });
  runner.stopAllBots();
  assert.equal((await pending).status, 'stopped');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(called, false);
});

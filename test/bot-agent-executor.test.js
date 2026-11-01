'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { BotTaskStore } = require('../src/bots/bot-store');
const { BotRunner } = require('../src/bots/runner');
const { BotScheduler } = require('../src/bots/scheduler');
const { AGENT_TASK_TOOL, buildAgentMission, createAgentStepExecutor } = require('../src/bots/agent-executor');

function makeBot(store, extra = {}) {
  return store.createBot({
    name: 'Monitor de preço',
    goal: 'Avisar quando o notebook custar menos de R$ 3.000.',
    defaultUrl: 'https://loja.exemplo.com.br/produto/1',
    permission: 'somente-leitura',
    ...extra
  });
}

test('contrato de verificação passa pelo agente e só registra sucesso quando o host confirma', async () => {
  const store = new BotTaskStore();
  const bot = makeBot(store);
  const checks = [{ kind: 'text', value: 'Pedido confirmado' }];
  let verdict = true;
  let received;
  const executor = createAgentStepExecutor({
    createBackgroundTab: async () => ({ tabId: 'verify-tab' }),
    closeTab: async () => true,
    getAgentConfig: async () => ({ provider: 'ollama', model: 'fixture' }),
    runAgent: async (...args) => {
      received = args[7];
      return { success: true, message: 'Terminei', verification: { ok: verdict, results: [{ kind: 'text', ok: verdict, detail: 'texto ausente' }] } };
    }
  });
  const runner = new BotRunner({ store, stepExecutor: executor });
  const step = { tool: AGENT_TASK_TOOL, verify: checks };
  const verified = await runner.runBotNow(bot.id, { steps: [step] });
  assert.deepEqual(received.verify, checks);
  assert.equal(verified.taskVerified, true);
  assert.equal(store.getBot(bot.id).verifiedSuccessCount, 1);
  verdict = false;
  const failed = await runner.runBotNow(bot.id, { steps: [step] });
  assert.equal(failed.status, 'failed');
  assert.match(failed.error, /verificação.*falhou/i);
  assert.equal(failed.taskVerified, false);
  assert.equal(store.getBot(bot.id).verifiedSuccessCount, 1);
  const invalid = await runner.runBotNow(bot.id, { steps: [{ tool: AGENT_TASK_TOOL, verify: [] }] });
  assert.equal(invalid.status, 'failed');
  assert.match(invalid.error, /verificação inválida/i);
});

test('agenda entrega contrato persistido apenas para a missão do Bot', async () => {
  const store = new BotTaskStore();
  const checks = [{ kind: 'text', value: 'Preço' }];
  const bot = makeBot(store, { verificationChecks: checks, schedule: { enabled: true, kind: 'interval', intervalHours: 1 } });
  let received;
  const scheduler = new BotScheduler({ store, runner: { runBotNow: async (_id, options) => { received = options.steps; return { status: 'completed' }; } } });
  await scheduler.runMissedSchedulesOnce();
  assert.deepEqual(received[0].verify, checks);
  assert.deepEqual(store.getBot(bot.id).verificationChecks, checks);
  assert.throws(() => makeBot(store, { verificationChecks: [] }), /verificação inválida/i);
});

test('executor entrega a missão ao agente, devolve resultado e fecha a aba oculta', async () => {
  const store = new BotTaskStore();
  const bot = makeBot(store);
  const calls = { created: [], closed: [], run: null };
  const executor = createAgentStepExecutor({
    createBackgroundTab: async (url) => {
      calls.created.push(url);
      return { tabId: 'tab-bot-1' };
    },
    closeTab: async (tabId) => { calls.closed.push(tabId); },
    runAgent: async (...args) => {
      calls.run = args;
      return { success: true, message: 'O notebook está por R$ 2.899 na loja.', toolsUsed: { inspect_page: 2 } };
    },
    getAgentConfig: async () => ({ provider: 'openrouter', apiKey: 'chave-de-teste', model: 'modelo-de-teste' })
  });
  const runner = new BotRunner({ store, stepExecutor: executor });

  const result = await runner.runBotNow(bot.id, {
    steps: [{ tool: AGENT_TASK_TOOL, prompt: bot.goal, url: bot.defaultUrl }]
  });

  assert.equal(result.status, 'completed');
  assert.ok(result.receiptHash);
  assert.equal(result.output[0].summary, 'O notebook está por R$ 2.899 na loja.');
  assert.equal(result.tokensUsed, null, 'uso real do modelo não é inventado');
  assert.equal(result.spendUsd, null, 'custo real do modelo não é inventado');
  assert.deepEqual(calls.created, [bot.defaultUrl]);
  assert.deepEqual(calls.closed, ['tab-bot-1']);

  const [tabId, prompt, apiKey, model, allowTools, provider, requireToolCall, options] = calls.run;
  assert.equal(tabId, 'tab-bot-1');
  assert.match(prompt, /Monitor de preço/);
  assert.match(prompt, /menos de R\$ 3\.000/);
  assert.match(prompt, /somente leitura/i);
  assert.equal(apiKey, 'chave-de-teste');
  assert.equal(model, 'modelo-de-teste');
  assert.equal(allowTools, true);
  assert.equal(provider, 'openrouter');
  assert.equal(requireToolCall, false);
  assert.equal(options.maxSteps, bot.limits.maxSteps);
  assert.equal(options.resumable, false);
  assert.equal(options.isolatedTabs, true);
  assert.equal(options.botReadOnly, true);
});

test('falha do agente vira execução falha e ainda fecha a aba', async () => {
  const store = new BotTaskStore();
  const bot = makeBot(store);
  const closed = [];
  const executor = createAgentStepExecutor({
    createBackgroundTab: async () => ({ tabId: 'tab-bot-2' }),
    closeTab: async (tabId) => { closed.push(tabId); },
    runAgent: async () => ({ success: false, error: 'A loja não respondeu.' }),
    getAgentConfig: async () => ({ provider: 'openrouter', apiKey: 'chave-de-teste', model: 'modelo-de-teste' })
  });
  const runner = new BotRunner({ store, stepExecutor: executor });

  const result = await runner.runBotNow(bot.id, { steps: [{ tool: AGENT_TASK_TOOL }] });

  assert.equal(result.status, 'failed');
  assert.match(result.error, /não respondeu/);
  assert.deepEqual(closed, ['tab-bot-2']);
});

test('falha ao fechar a aba vira execução falha, sem registrar sucesso', async () => {
  const store = new BotTaskStore();
  const bot = makeBot(store);
  let closeAttempts = 0;
  const executor = createAgentStepExecutor({
    createBackgroundTab: async () => ({ tabId: 'tab-close-error' }),
    closeTab: async () => { closeAttempts++; throw new Error('A aba continua aberta.'); },
    runAgent: async () => ({ success: true, message: 'Leitura terminada.' }),
    getAgentConfig: async () => ({ provider: 'ollama', model: 'modelo-de-teste' })
  });
  const runner = new BotRunner({ store, stepExecutor: executor });

  const result = await runner.runBotNow(bot.id, { steps: [{ tool: AGENT_TASK_TOOL }] });
  assert.equal(result.status, 'failed');
  assert.match(result.error, /não foi possível encerrar a aba/i);
  assert.equal(closeAttempts, 2, 'uma segunda tentativa de fechamento é feita');
  assert.equal(store.getBot(bot.id).verifiedSuccessCount, 0);
});

test('cancelar o Bot avisa o agente e fecha a aba', async () => {
  const store = new BotTaskStore();
  const bot = makeBot(store);
  const closed = [];
  let cancelTabId = null;
  let startRun;
  const started = new Promise((resolve) => { startRun = resolve; });
  const executor = createAgentStepExecutor({
    createBackgroundTab: async () => ({ tabId: 'tab-bot-3' }),
    closeTab: async (tabId) => { closed.push(tabId); },
    runAgent: () => new Promise((resolve) => {
      startRun();
      resolveRun = resolve;
    }),
    cancelAgentRun: (tabId) => {
      cancelTabId = tabId;
      resolveRun({ success: false, cancelled: true });
    },
    getAgentConfig: async () => ({ provider: 'openrouter', apiKey: 'chave-de-teste', model: 'modelo-de-teste' })
  });
  let resolveRun;
  const runner = new BotRunner({ store, stepExecutor: executor });

  const pending = runner.runBotNow(bot.id, { steps: [{ tool: AGENT_TASK_TOOL }] });
  await started;
  runner.stopAllBots();
  const result = await pending;
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(result.status, 'stopped');
  assert.equal(cancelTabId, 'tab-bot-3');
  assert.deepEqual(closed, ['tab-bot-3']);
});

test('cancelamento durante abertura da aba não inicia o agente e fecha a aba', async () => {
  const store = new BotTaskStore();
  const bot = makeBot(store);
  let finishOpening;
  let startedOpening;
  const opening = new Promise((resolve) => { startedOpening = resolve; });
  const closed = [];
  let agentCalled = false;
  const executor = createAgentStepExecutor({
    createBackgroundTab: () => { startedOpening(); return new Promise((resolve) => { finishOpening = resolve; }); },
    closeTab: async (id) => { closed.push(id); },
    runAgent: async () => { agentCalled = true; return { success: true }; },
    getAgentConfig: async () => ({ provider: 'ollama', model: 'modelo-de-teste' })
  });
  const runner = new BotRunner({ store, stepExecutor: executor });
  const pending = runner.runBotNow(bot.id, { steps: [{ tool: AGENT_TASK_TOOL }] });
  await opening;
  runner.stopAllBots();
  finishOpening({ tabId: 'tab-opened-after-stop' });
  assert.equal((await pending).status, 'stopped');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(agentCalled, false);
  assert.deepEqual(closed, ['tab-opened-after-stop']);
});

test('passo desconhecido não abre aba nem chama o agente', async () => {
  const store = new BotTaskStore();
  const bot = makeBot(store);
  let created = 0;
  let ran = 0;
  const executor = createAgentStepExecutor({
    createBackgroundTab: async () => { created++; return { tabId: 'tab-x' }; },
    closeTab: async () => {},
    runAgent: async () => { ran++; return { success: true }; },
    getAgentConfig: async () => ({ provider: 'openrouter', apiKey: 'k', model: 'm' })
  });
  const runner = new BotRunner({ store, stepExecutor: executor });

  const result = await runner.runBotNow(bot.id, { steps: [{ tool: 'snapshot' }] });

  assert.equal(result.status, 'failed');
  assert.match(result.error, /não é uma tarefa do agente/);
  assert.equal(created, 0);
  assert.equal(ran, 0);
});

test('sem missão definida o executor devolve erro claro', async () => {
  const store = new BotTaskStore();
  const bot = store.createBot({ name: 'Sem missão', goal: '   ' });
  let created = 0;
  const executor = createAgentStepExecutor({
    createBackgroundTab: async () => { created++; return { tabId: 'tab-y' }; },
    closeTab: async () => {},
    runAgent: async () => ({ success: true }),
    getAgentConfig: async () => ({ provider: 'openrouter', apiKey: 'k', model: 'm' })
  });
  const runner = new BotRunner({ store, stepExecutor: executor });

  const result = await runner.runBotNow(bot.id, { steps: [{ tool: AGENT_TASK_TOOL }] });

  assert.equal(result.status, 'failed');
  assert.match(result.error, /não tem missão definida/);
  assert.equal(created, 0);
});

test('a missão montada inclui sites permitidos e o modo somente leitura', () => {
  const prompt = buildAgentMission(
    { name: 'Bot do Polare', goal: 'Conferir as entregas do mês.', permission: 'somente-leitura', allowedSites: ['https://polare.exemplo.org'] },
    {}
  );
  assert.match(prompt, /Sites permitidos: https:\/\/polare\.exemplo\.org/);
  assert.match(prompt, /somente leitura/i);
});

test('a agenda usa a missão do Bot quando não há passos gravados', async () => {
  const store = new BotTaskStore();
  let clock = Date.UTC(2026, 9, 31, 12, 0, 0);
  const bot = makeBot(store, { schedule: { enabled: true, kind: 'interval', intervalHours: 4 } });
  const seen = [];
  const fakeRunner = {
    runBotNow: async (botId, { steps }) => {
      seen.push({ botId, steps });
      return { runId: 'run-1', status: 'completed' };
    }
  };
  const scheduler = new BotScheduler({ store, runner: fakeRunner, now: () => clock });

  await scheduler.runMissedSchedulesOnce();

  assert.equal(seen.length, 1);
  assert.equal(seen[0].steps.length, 1);
  assert.equal(seen[0].steps[0].tool, AGENT_TASK_TOOL);
  assert.equal(seen[0].steps[0].prompt, bot.goal);
});

test('A3: o Bot não abre aba para site fora da lista dele', async () => {
  const store = new BotTaskStore();
  const bot = makeBot(store, { allowedSites: ['https://loja.exemplo.com.br'] });
  const calls = { created: [], ran: 0 };
  const executor = createAgentStepExecutor({
    createBackgroundTab: async (url, botArg) => {
      calls.created.push({ url, botId: botArg?.id });
      return { tabId: 'tab-fora' };
    },
    closeTab: async () => {},
    runAgent: async () => { calls.ran++; return { success: true }; },
    getAgentConfig: async () => ({ provider: 'openrouter', apiKey: 'k', model: 'm' })
  });
  const runner = new BotRunner({ store, stepExecutor: executor });

  const result = await runner.runBotNow(bot.id, {
    steps: [{ tool: AGENT_TASK_TOOL, prompt: bot.goal, url: 'https://site-nao-permitido.com' }]
  });

  assert.equal(result.status, 'failed');
  assert.match(result.error, /não está na lista do Bot/);
  assert.match(result.error, /site-nao-permitido\.com/);
  assert.deepEqual(calls.created, [], 'nenhuma aba é aberta para site bloqueado');
  assert.equal(calls.ran, 0, 'o agente nem chega a rodar');
});

test('A3: a URL padrão do Bot também passa pela lista de sites', async () => {
  const store = new BotTaskStore();
  const bot = makeBot(store, { defaultUrl: 'https://outra-loja.com', allowedSites: ['https://loja.exemplo.com.br'] });
  let created = 0;
  const executor = createAgentStepExecutor({
    createBackgroundTab: async () => { created++; return { tabId: 'tab-x' }; },
    closeTab: async () => {},
    runAgent: async () => ({ success: true }),
    getAgentConfig: async () => ({ provider: 'openrouter', apiKey: 'k', model: 'm' })
  });
  const runner = new BotRunner({ store, stepExecutor: executor });

  const result = await runner.runBotNow(bot.id, { steps: [{ tool: AGENT_TASK_TOOL, prompt: bot.goal }] });

  assert.equal(result.status, 'failed');
  assert.match(result.error, /outra-loja\.com/);
  assert.equal(created, 0);
});

test('A3: a aba do Bot recebe o Bot como contexto, para o perfil e a política de site', async () => {
  const store = new BotTaskStore();
  const bot = makeBot(store, { allowedSites: ['https://loja.exemplo.com.br'] });
  let received = null;
  const executor = createAgentStepExecutor({
    createBackgroundTab: async (url, botArg) => {
      received = { url, botArg };
      return { tabId: 'tab-contexto' };
    },
    closeTab: async () => {},
    runAgent: async () => ({ success: true, message: 'ok' }),
    getAgentConfig: async () => ({ provider: 'openrouter', apiKey: 'k', model: 'm' })
  });
  const runner = new BotRunner({ store, stepExecutor: executor });

  const result = await runner.runBotNow(bot.id, { steps: [{ tool: AGENT_TASK_TOOL, prompt: bot.goal }] });

  assert.equal(result.status, 'completed');
  assert.equal(received.url, 'https://loja.exemplo.com.br/produto/1');
  assert.equal(received.botArg.id, bot.id);
  assert.deepEqual(received.botArg.allowedSites, ['https://loja.exemplo.com.br']);
});

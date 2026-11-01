'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { BotTaskStore } = require('../src/bots/bot-store');
const { BotScheduler } = require('../src/bots/scheduler');
const { AGENT_TASK_TOOL } = require('../src/bots/agent-executor');

test('A4: fuso local, não UTC — rotina diária segue o relógio local do usuário', () => {
  const store = new BotTaskStore();
  const bot = store.createBot({
    name: 'Monitor de Notícias',
    schedule: { enabled: true, kind: 'daily', dailyAt: '09:00' }
  });

  const scheduler = new BotScheduler({ store, runner: { runBotNow: async () => ({}) } });

  // 08:30 no horário LOCAL do computador: ainda não deve rodar
  const hoje8h30 = new Date(2026, 9, 31, 8, 30, 0, 0).getTime();
  assert.equal(scheduler.isBotDue(bot, hoje8h30), false, 'não roda antes das 09:00 local');

  // 09:05 no horário LOCAL: deve rodar
  const hoje9h05 = new Date(2026, 9, 31, 9, 5, 0, 0).getTime();
  assert.equal(scheduler.isBotDue(bot, hoje9h05), true, 'roda após as 09:00 local');

  // Simulando que rodou às 09:05
  scheduler.lastRunByBot.set(bot.id, hoje9h05);

  // 10:00 do mesmo dia no horário local: já rodou hoje, não repete
  const hoje10h = new Date(2026, 9, 31, 10, 0, 0, 0).getTime();
  assert.equal(scheduler.isBotDue(bot, hoje10h), false, 'não repete no mesmo dia');

  // 09:01 do dia seguinte no horário local: deve rodar de novo
  const amanha9h01 = new Date(2026, 10, 1, 9, 1, 0, 0).getTime();
  assert.equal(scheduler.isBotDue(bot, amanha9h01), true, 'roda no dia seguinte');
});

test('A4: fuso local, não UTC — rotina mensal segue o dia do mês local', () => {
  const store = new BotTaskStore();
  const bot = store.createBot({
    name: 'Fechamento Mensal',
    schedule: { enabled: true, kind: 'monthly', dayOfMonth: 5 }
  });

  const scheduler = new BotScheduler({ store, runner: { runBotNow: async () => ({}) } });

  // Dia 4 do mês local: não deve rodar
  const dia4 = new Date(2026, 10, 4, 15, 0, 0, 0).getTime();
  assert.equal(scheduler.isBotDue(bot, dia4), false, 'não roda no dia 4');

  // Dia 5 do mês local às 09:30: deve rodar
  const dia5 = new Date(2026, 10, 5, 9, 30, 0, 0).getTime();
  assert.equal(scheduler.isBotDue(bot, dia5), true, 'roda no dia 5 após 09:00');

  // Marca como executado no dia 5
  scheduler.lastRunByBot.set(bot.id, dia5);

  // Dia 6 do mesmo mês: não roda de novo
  const dia6 = new Date(2026, 10, 6, 10, 0, 0, 0).getTime();
  assert.equal(scheduler.isBotDue(bot, dia6), false, 'não repete no mês');
});

test('A4: persistência em disco — fechar e reabrir o app preserva a agenda e executa a rotina pendente uma só vez', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'navegante-test-'));
  const filePath = path.join(tmpDir, 'bot-tasks.json');

  let clock = new Date(2026, 9, 31, 10, 0, 0, 0).getTime();
  const runs = [];
  const fakeRunner = {
    runBotNow: async (botId, opts) => {
      runs.push({ botId, at: clock, opts });
      return { runId: `run-${runs.length}`, status: 'completed' };
    }
  };

  try {
    // 1ª SESSÃO (app aberto pela 1ª vez)
    const store1 = new BotTaskStore({ filePath });
    const bot = store1.createBot({
      name: 'Monitor Periódico',
      goal: 'Verificar ofertas',
      schedule: { enabled: true, kind: 'interval', intervalHours: 4 }
    });
    const scheduler1 = new BotScheduler({ store: store1, runner: fakeRunner, now: () => clock });

    // 1ª verificação: rotina pendente roda
    const pass1 = await scheduler1.runMissedSchedulesOnce();
    assert.equal(pass1.length, 1);
    assert.equal(runs.length, 1);
    assert.equal(runs[0].botId, bot.id);
    assert.equal(runs[0].opts.steps[0].tool, AGENT_TASK_TOOL);

    // Chamar novamente 15 minutos depois: não deve rodar
    clock += 15 * 60 * 1000;
    const pass2 = await scheduler1.runMissedSchedulesOnce();
    assert.equal(pass2.length, 0);
    assert.equal(runs.length, 1);

    // 2ª SESSÃO (simula fechar o Zero e reabrir 30 minutos após a 1ª execução)
    clock += 15 * 60 * 1000; // Total 30 min desde a 1ª execução (intervalo é de 4h)
    const store2 = new BotTaskStore({ filePath });
    const reloadedBot = store2.getBot(bot.id);
    assert.ok(reloadedBot.schedule.lastRunAt, 'data da última execução persistida em disco');

    const scheduler2 = new BotScheduler({ store: store2, runner: fakeRunner, now: () => clock });
    const reopenPass = await scheduler2.runMissedSchedulesOnce();
    assert.equal(reopenPass.length, 0, 'ao reabrir antes do intervalo, a rotina não é repetida indevidamente');
    assert.equal(runs.length, 1);

    // Avança o relógio para depois do intervalo de 4h (ex.: 4h10min desde a 1ª execução)
    clock += 3 * 3600 * 1000 + 40 * 60 * 1000; // agora passaram-se 4h10min
    const duePass = await scheduler2.runMissedSchedulesOnce();
    assert.equal(duePass.length, 1, 'após o intervalo vencer, roda novamente');
    assert.equal(runs.length, 2);

    // Reabrir imediatamente após essa 2ª execução
    const store3 = new BotTaskStore({ filePath });
    const scheduler3 = new BotScheduler({ store: store3, runner: fakeRunner, now: () => clock });
    const reopenPass2 = await scheduler3.runMissedSchedulesOnce();
    assert.equal(reopenPass2.length, 0, 'não repete imediatamente após reabrir');
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
});

test('A4: relógio recorrente — start() inicia temporizador periódico e stop() encerra', async () => {
  const store = new BotTaskStore();
  let checks = 0;
  const scheduler = new BotScheduler({
    store,
    runner: { runBotNow: async () => ({}) }
  });
  // Sobrescreve runMissedSchedulesOnce para contar chamadas
  scheduler.runMissedSchedulesOnce = async () => {
    checks++;
    return [];
  };

  assert.equal(scheduler.isRunning(), false);
  scheduler.start({ intervalMs: 20 });
  assert.equal(scheduler.isRunning(), true);

  await new Promise((resolve) => setTimeout(resolve, 70));
  assert.ok(checks >= 2, `relógio recorrente chamou ${checks} vezes`);

  scheduler.stop();
  assert.equal(scheduler.isRunning(), false);
  const countAfterStop = checks;
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(checks, countAfterStop, 'temporizador não executa após stop()');
});


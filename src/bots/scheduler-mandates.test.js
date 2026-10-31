const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { BotTaskStore } = require('./bot-store');
const { BotScheduler } = require('./scheduler');

function createTempStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zero-bot-sched-'));
  const filePath = path.join(dir, 'bots.json');
  return new BotTaskStore({ filePath });
}

test('BotScheduler: dispara gatilhos por evento (price-below-target, page-changed, new-email)', async () => {
  const store = createTempStore();
  const bot = store.createBot({
    name: 'Bot Caçador de Preços',
    specialty: 'price-hunter',
    defaultUrl: 'https://www.google.com/shopping'
  });
  const executed = [];
  const scheduler = new BotScheduler({
    store,
    runner: {
      runBotNow: async (botId) => {
        executed.push(botId);
        return { runId: 'run-1', status: 'completed', summary: 'Executado via gatilho' };
      }
    }
  });

  scheduler.registerEventTrigger({
    botId: bot.id,
    eventType: 'price-below-target',
    condition: { targetPrice: 2000 }
  });

  // Preço acima da meta não dispara
  const above = await scheduler.fireEvent('price-below-target', { price: 2450 });
  assert.equal(above.length, 0);

  // Preço abaixo da meta dispara o Bot
  const below = await scheduler.fireEvent('price-below-target', { price: 1899 });
  assert.equal(below.length, 1);
  assert.equal(executed[0], bot.id);
});

test('BotScheduler: avalia Mandato Delegado com Envelope (valor máximo R$, validade e usos)', () => {
  const store = createTempStore();
  const scheduler = new BotScheduler({
    store,
    runner: { runBotNow: async () => ({ status: 'completed' }) }
  });

  scheduler.createMandate('bot-1', {
    allowedAction: 'reserve-price-offer',
    maxAmountBrl: 200,
    maxUses: 1
  });

  // Ação diferente é bloqueada
  const wrongAction = scheduler.evaluateMandate('bot-1', { action: 'delete-account', amountBrl: 10 });
  assert.equal(wrongAction.withinEnvelope, false);
  assert.match(wrongAction.reason, /fora do mandato/);

  // Valor acima do teto em R$ é bloqueado
  const overBudget = scheduler.evaluateMandate('bot-1', { action: 'reserve-price-offer', amountBrl: 350 });
  assert.equal(overBudget.withinEnvelope, false);
  assert.match(overBudget.reason, /excede o teto/);

  // Dentro do envelope é permitido e consome o uso
  const okRun = scheduler.evaluateMandate('bot-1', { action: 'reserve-price-offer', amountBrl: 185 });
  assert.equal(okRun.withinEnvelope, true);
  assert.equal(okRun.remainingUses, 0);

  // Segundo uso é bloqueado (maxUses: 1)
  const exhausted = scheduler.evaluateMandate('bot-1', { action: 'reserve-price-offer', amountBrl: 100 });
  assert.equal(exhausted.withinEnvelope, false);
  assert.match(exhausted.reason, /Limite de usos/);
});

test('BotScheduler: gera especificação auditável do Agendador de Tarefas do Windows (schtasks)', () => {
  const store = createTempStore();
  const bot = store.createBot({
    name: 'Bot Radar Matinal',
    schedule: { enabled: true, kind: 'daily', dailyAt: '08:30' }
  });
  const scheduler = new BotScheduler({
    store,
    runner: { runBotNow: async () => ({ status: 'completed' }) }
  });
  const spec = scheduler.buildWindowsScheduledTaskSpec(bot.id, {
    time: '08:30',
    exePath: 'C:\\Program Files\\Zero Browser\\Zero Browser.exe'
  });
  assert.ok(spec.taskName.startsWith('ZeroBrowser_Bot_'));
  assert.equal(spec.time, '08:30');
  assert.match(spec.schtasksCommand, /schtasks \/Create \/F \/SC DAILY/);
  assert.match(spec.schtasksCommand, /--run-scheduled-bot=/);
});

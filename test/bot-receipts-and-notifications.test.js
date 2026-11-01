'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { BotTaskStore } = require('../src/bots/bot-store');
const { BotScheduler } = require('../src/bots/scheduler');
const { isUrlAllowedForBot, siteBlockedMessage } = require('../src/bots/site-policy');
const { createBotSiteGuard } = require('../src/bots/bot-site-guard');

test('A6: aviso e recibo — emissão de notificação legível pelo BotScheduler', () => {
  const store = new BotTaskStore();
  const bot = store.createBot({
    name: 'Monitor de Preços',
    goal: 'Avisar quando o notebook baixar de R$ 3.000',
    defaultUrl: 'https://loja.exemplo.com.br'
  });

  const emitted = [];
  const scheduler = new BotScheduler({
    store,
    runner: { runBotNow: async () => ({}) },
    notify: (item) => emitted.push(item)
  });

  const note = scheduler.emitNotification({
    botId: bot.id,
    title: 'Monitor de Preços',
    body: 'Notebook encontrado por R$ 2.899 na Loja Exemplo.',
    kind: 'success'
  });

  assert.equal(emitted.length, 1);
  assert.equal(note.title, 'Monitor de Preços');
  assert.match(note.body, /R\$ 2\.899/);
  assert.equal(note.kind, 'success');
  assert.ok(note.timestamp > 0);
});

test('execução encerrada pelo modelo não conta como sucesso verificado sem pós-condição', () => {
  const store = new BotTaskStore();
  const bot = store.createBot({ name: 'Verificação' });

  store.recordRunResult(bot.id, { status: 'completed', output: [{ summary: 'O agente terminou.' }] });
  assert.equal(store.getBot(bot.id).verifiedSuccessCount, 0);

  store.recordRunResult(bot.id, { status: 'completed', taskVerified: true, output: [{ summary: 'Pós-condição confirmada.' }] });
  assert.equal(store.getBot(bot.id).verifiedSuccessCount, 1);
});

test('A6: aviso e recibo — bloqueio de site gera mensagem clara e em português para usuário leigo', () => {
  const allowed = ['loja.exemplo.com.br'];
  const blockedUrl = 'https://site-estranho.com/golpe';

  assert.equal(isUrlAllowedForBot(blockedUrl, allowed), false);
  const message = siteBlockedMessage(blockedUrl, allowed);

  assert.match(message, /não está na lista do Bot/);
  assert.match(message, /site-estranho\.com/);
  assert.match(message, /loja\.exemplo\.com\.br/);
});

test('A6: aviso e recibo — guardSession dispara evento onBlocked com mensagem legível', async () => {
  const blockedEvents = [];
  const guard = createBotSiteGuard({
    bot: { id: 'bot-123', allowedSites: ['https://loja.exemplo.com.br'] },
    onBlocked: (event) => blockedEvents.push(event)
  });

  const message = guard.block('https://malicioso.org/phishing');
  assert.equal(blockedEvents.length, 1);
  assert.equal(blockedEvents[0].botId, 'bot-123');
  assert.match(blockedEvents[0].message, /malicioso\.org/);
  assert.match(message, /malicioso\.org/);
});


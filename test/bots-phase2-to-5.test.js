'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { BotTaskStore } = require('../src/bots/bot-store');
const { BotRunner } = require('../src/bots/runner');
const { BotScheduler, STALE_BOT_THRESHOLD_MS } = require('../src/bots/scheduler');
const { PriceResearcherBotService, evaluateStockQuoteAlert } = require('../src/bots/templates');
const { TeachTaskRecorder } = require('../src/bots/recorder');
const { VersionedUiCustomizer } = require('../src/main/ui-customizer');
const { UntouchableCoreError } = require('../src/main/command-registry');

test('BotScheduler executa tarefa perdida uma única vez ao iniciar e pausa Bots sem verificação há 14 dias', async () => {
  const store = new BotTaskStore();
  let clock = Date.UTC(2026, 9, 31, 12, 0, 0);
  const runner = new BotRunner({ store, now: () => clock });
  const scheduler = new BotScheduler({ store, runner, now: () => clock });

  const bot = store.createBot({
    name: 'Resumo Diário',
    schedule: { enabled: true, kind: 'interval', intervalHours: 4 }
  });

  // 1ª verificação roda a execução pendente
  const firstPass = await scheduler.runMissedSchedulesOnce();
  assert.equal(firstPass.length, 1);
  assert.equal(firstPass[0].botId, bot.id);

  // Chamar novamente 10 minutos depois não acumula nem repete
  clock += 10 * 60 * 1000;
  const secondPass = await scheduler.runMissedSchedulesOnce();
  assert.equal(secondPass.length, 0);

  // Após 15 dias sem nova verificação, pausa automaticamente o Bot
  clock += STALE_BOT_THRESHOLD_MS + 3_600_000;
  const paused = scheduler.pauseStaleBots(clock);
  assert.deepEqual(paused, [bot.id]);
  assert.equal(store.getBot(bot.id).active, false);
});

test('PriceResearcherBotService exige confirmação humana na 1ª execução, mede % sem modelo e alerta preço-alvo', () => {
  const store = new BotTaskStore();
  const service = new PriceResearcherBotService({ store });

  const bot = service.createFromTemplate({
    productName: 'Monitor 27 4K',
    targetPrice: 1800,
    stores: ['https://loja1.exemplo.com', 'https://loja2.exemplo.com']
  });

  // Sem confirmação humana do produto, bloqueia observação
  assert.throws(
    () => service.recordPriceObservation(bot.id, { storeUrl: 'https://loja1.exemplo.com', price: 1750 }),
    /ainda não confirmado pelo usuário/
  );

  service.confirmCandidateProduct(bot.id, {
    storeUrl: 'https://loja1.exemplo.com',
    productTitle: 'Monitor 27" 4K IPS 60Hz Novo',
    sku: 'MON-27-4K',
    confirmedByUser: true
  });

  const obs1 = service.recordPriceObservation(bot.id, {
    storeUrl: 'https://loja1.exemplo.com',
    price: 1950,
    shipping: 30,
    usedRecipe: true
  });
  assert.equal(obs1.reachedTarget, false);

  const obs2 = service.recordPriceObservation(bot.id, {
    storeUrl: 'https://loja1.exemplo.com',
    price: 1720,
    shipping: 30,
    usedRecipe: true
  });
  assert.equal(obs2.reachedTarget, true);
  assert.equal(obs2.shouldAlert, true);

  const metrics = service.getMetrics(bot.id);
  assert.equal(metrics.totalObservations, 2);
  assert.equal(metrics.recipeFreeRatio, 1);
  assert.equal(metrics.lowestTotal, 1750);

  const quoteAlert = evaluateStockQuoteAlert({ ticker: 'PETR4', currentPrice: 38.5, alertAbove: 38.0 });
  assert.equal(quoteAlert.shouldAlert, true);
});

test('TeachTaskRecorder grava demonstração sem salvar senhas, permite editar resumo e enfileira aprovação de escrita', () => {
  const store = new BotTaskStore();
  const recorder = new TeachTaskRecorder({ store });

  const session = recorder.startRecording({
    title: 'Consultar fatura mensal',
    startUrl: 'https://portal.exemplo.com.br'
  });

  recorder.recordEvent(session.sessionId, { kind: 'navigate', url: 'https://portal.exemplo.com.br' });
  recorder.recordEvent(session.sessionId, { kind: 'type', fieldName: 'password', label: 'Senha', value: 'MinhaSenhaSecreta!', isPassword: true });
  recorder.recordEvent(session.sessionId, { kind: 'extract', selector: '.invoice-total', label: 'Valor da fatura' });

  const review = recorder.stopRecording(session.sessionId);
  assert.equal(review.steps.length, 3);
  assert.equal(review.steps[1].value, null);
  assert.match(review.numberedSummary[1], /valor protegido/);

  recorder.editRecordedStep(session.sessionId, 3, { humanSummary: 'Ler valor total do boleto' });
  const savedBot = recorder.saveAsBot(session.sessionId, { name: 'Bot Fatura' });
  assert.equal(savedBot.name, 'Bot Fatura');
  assert.equal(savedBot.permission, 'somente-leitura');

  const pending = recorder.enqueueWriteApproval({
    botId: savedBot.id,
    step: { tool: 'submit_form' },
    targetSite: 'https://portal.exemplo.com.br'
  });
  assert.equal(pending.status, 'pending');
  const resolved = recorder.resolveWriteApproval(pending.approvalId, { decision: 'approve-once', approvedByUser: true });
  assert.equal(resolved.status, 'approved');
});

test('VersionedUiCustomizer aplica mudanças versionadas, permite voltar layout/Modo Seguro e protege o núcleo intocável', () => {
  const customizer = new VersionedUiCustomizer();

  const v2 = customizer.applyChanges(
    { theme: 'light', delegationPanelWidth: 500 },
    { description: 'Tema claro e painel 500px' }
  );
  assert.equal(v2.version, 2);
  assert.equal(customizer.getCurrentLayout().theme, 'light');
  assert.equal(customizer.getCurrentLayout().delegationPanelWidth, 500);

  // Tentar ocultar o botão Parar tudo ou cartão de aprovação lança UntouchableCoreError
  assert.throws(
    () => customizer.applyChanges({ stopAllVisible: false }),
    (err) => err instanceof UntouchableCoreError
  );
  assert.throws(
    () => customizer.previewChanges({ hideApprovalCard: true }),
    (err) => err instanceof UntouchableCoreError
  );

  // Modo seguro restaura imediatamente o visual padrão
  const safe = customizer.enterSafeMode();
  assert.equal(safe.theme, 'dark');
  assert.equal(safe.stopAllVisible, true);

  // Rollback volta para a versão 1
  const rolledBack = customizer.rollbackPreviousLayout();
  assert.equal(rolledBack.theme, 'dark');
  assert.equal(rolledBack.delegationPanelWidth, 420);
});


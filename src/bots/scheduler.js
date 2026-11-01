'use strict';

const STALE_BOT_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000; // 14 dias
const { AGENT_TASK_TOOL } = require('./agent-executor');

class BotScheduler {
  constructor({
    store,
    runner,
    now = () => Date.now(),
    notify = null
  } = {}) {
    if (!store) throw new Error('BotScheduler requer BotTaskStore.');
    if (!runner) throw new Error('BotScheduler requer BotRunner.');
    this.store = store;
    this.runner = runner;
    this.now = now;
    this.notify = typeof notify === 'function' ? notify : () => {};
    this.lastRunByBot = new Map();
    this.notifications = [];
    this.eventTriggers = new Map();
    this.mandatesByBot = new Map();
    this.loginItemSettings = {
      openAtLogin: false,
      openAsHiddenInTray: true
    };
  }

  registerEventTrigger({ botId, eventType, condition = {}, active = true } = {}) {
    if (!botId || !eventType) throw new Error('botId e eventType são obrigatórios para gatilho por evento.');
    const triggerId = `trg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const trigger = {
      triggerId,
      botId: String(botId),
      eventType: String(eventType), // 'new-email' | 'page-changed' | 'price-below-target'
      condition: { ...condition },
      active: Boolean(active),
      createdAt: new Date(this.now()).toISOString()
    };
    this.eventTriggers.set(triggerId, trigger);
    return { ...trigger };
  }

  listEventTriggers(botId = null) {
    const all = [...this.eventTriggers.values()];
    return botId ? all.filter((t) => t.botId === botId) : all;
  }

  async fireEvent(eventType, payload = {}) {
    const triggered = [];
    for (const trig of this.eventTriggers.values()) {
      if (!trig.active || trig.eventType !== eventType) continue;
      if (eventType === 'price-below-target' && trig.condition.targetPrice != null) {
        if (!(Number(payload.price) <= Number(trig.condition.targetPrice))) continue;
      }
      const res = await this.runner.runBotNow(trig.botId, {
        steps: payload.steps || [{ tool: AGENT_TASK_TOOL, usesModel: true }]
      });
      triggered.push({ triggerId: trig.triggerId, botId: trig.botId, runId: res.runId, status: res.status });
    }
    return triggered;
  }

  createMandate(botId, {
    allowedAction = 'reservar_ou_alertar',
    allowedSites = [],
    maxAmountBrl = 150,
    expiresAt = null,
    maxUses = 1
  } = {}) {
    if (!botId) throw new Error('botId obrigatório para criar Mandato.');
    const mandate = {
      mandateId: `mnd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      botId: String(botId),
      allowedAction: String(allowedAction),
      allowedSites: Array.isArray(allowedSites) ? [...allowedSites] : [],
      maxAmountBrl: Math.max(0, Number(maxAmountBrl) || 0),
      expiresAt: expiresAt || new Date(this.now() + 7 * 24 * 3600_000).toISOString(),
      maxUses: Math.max(1, Number(maxUses) || 1),
      usedCount: 0,
      active: true
    };
    this.mandatesByBot.set(String(botId), mandate);
    return { ...mandate };
  }

  getMandate(botId) {
    const m = this.mandatesByBot.get(String(botId));
    return m ? { ...m } : null;
  }

  evaluateMandate(botId, { action, amountBrl = 0, site = '' } = {}) {
    const m = this.mandatesByBot.get(String(botId));
    if (!m || !m.active) return { withinEnvelope: false, reason: 'Nenhum mandato ativo para este Bot.' };
    if (m.usedCount >= m.maxUses) return { withinEnvelope: false, reason: 'Limite de usos do mandato atingido.' };
    if (m.expiresAt && this.now() > Date.parse(m.expiresAt)) {
      return { withinEnvelope: false, reason: 'Mandato expirado.' };
    }
    if (m.allowedAction && action && m.allowedAction !== action) {
      return { withinEnvelope: false, reason: `Ação "${action}" fora do mandato ("${m.allowedAction}").` };
    }
    if (Number(amountBrl) > m.maxAmountBrl) {
      return { withinEnvelope: false, reason: `Valor R$ ${amountBrl} excede o teto do mandato (R$ ${m.maxAmountBrl}).` };
    }
    if (m.allowedSites.length > 0 && site && !m.allowedSites.some((s) => site.includes(s))) {
      return { withinEnvelope: false, reason: `Site "${site}" fora do envelope do mandato.` };
    }
    m.usedCount += 1;
    return { withinEnvelope: true, remainingUses: m.maxUses - m.usedCount };
  }

  buildWindowsScheduledTaskSpec(botId, { time = '09:00', wakeToRun = true, exePath = 'Zero Browser.exe' } = {}) {
    const bot = this.store.getBot(botId);
    if (!bot) throw new Error(`Bot "${botId}" não encontrado.`);
    const taskName = `ZeroBrowser_Bot_${bot.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const commandArgs = [
      '/Create',
      '/F',
      '/SC', 'DAILY',
      '/ST', String(time || '09:00'),
      '/TN', taskName,
      '/TR', `"${exePath}" --run-scheduled-bot="${bot.id}" --headless- close-when-done`
    ];
    return {
      taskName,
      botId: bot.id,
      botName: bot.name,
      time: String(time || '09:00'),
      wakeToRun: Boolean(wakeToRun),
      schtasksCommand: `schtasks ${commandArgs.join(' ')}`
    };
  }

  configureLoginItem({ openAtLogin = false, openAsHiddenInTray = true } = {}) {
    this.loginItemSettings = {
      openAtLogin: Boolean(openAtLogin),
      openAsHiddenInTray: Boolean(openAsHiddenInTray)
    };
    return { ...this.loginItemSettings };
  }

  getLoginItemConfig() {
    return { ...this.loginItemSettings };
  }

  emitNotification({ botId, title, body, kind = 'info' }) {
    const item = {
      botId,
      title: String(title || 'Zero Browser · Bot'),
      body: String(body || ''),
      kind,
      timestamp: this.now()
    };
    this.notifications.push(item);
    this.notify(item);
    return item;
  }

  isBotDue(bot, currentTimeMs = this.now()) {
    if (!bot || !bot.active || !bot.schedule || !bot.schedule.enabled) {
      return false;
    }
    const lastRunMs = this.lastRunByBot.get(bot.id)
      ?? (bot.schedule?.lastRunAt ? Date.parse(bot.schedule.lastRunAt) : null)
      ?? (bot.history?.[0]?.startedAt ? Date.parse(bot.history[0].startedAt) : null);

    const schedule = bot.schedule;
    if (schedule.kind === 'interval') {
      const intervalMs = Math.max(1, Number(schedule.intervalHours) || 1) * 3_600_000;
      if (lastRunMs == null) return true;
      return (currentTimeMs - lastRunMs) >= intervalMs;
    }

    if (schedule.kind === 'daily') {
      const [targetHour = 9, targetMinute = 0] = String(schedule.dailyAt || '09:00')
        .split(':')
        .map((n) => Number(n) || 0);
      const currentDate = new Date(currentTimeMs);
      const scheduledToday = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        currentDate.getDate(),
        targetHour,
        targetMinute,
        0,
        0
      );
      if (currentTimeMs < scheduledToday.getTime()) return false;
      if (lastRunMs == null) return true;
      return lastRunMs < scheduledToday.getTime();
    }

    if (schedule.kind === 'monthly') {
      const dayOfMonth = Math.min(28, Math.max(1, Number(schedule.dayOfMonth) || 5));
      const currentDate = new Date(currentTimeMs);
      if (currentDate.getDate() < dayOfMonth) return false;
      const scheduledMonthStart = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        dayOfMonth,
        9,
        0,
        0,
        0
      ).getTime();
      if (currentTimeMs < scheduledMonthStart) return false;
      if (lastRunMs == null) return true;
      return lastRunMs < scheduledMonthStart;
    }

    return false;
  }

  _recordBotScheduleRun(botId, timestampMs) {
    if (typeof this.store.recordScheduleRun === 'function') {
      this.store.recordScheduleRun(botId, timestampMs);
    } else {
      const raw = this.store.bots?.get(botId);
      if (raw) {
        if (!raw.schedule) raw.schedule = { enabled: false, kind: 'manual' };
        raw.schedule.lastRunAt = new Date(timestampMs).toISOString();
        raw.updatedAt = new Date().toISOString();
        this.store._saveToDisk?.();
      }
    }
  }

  start({ intervalMs = 60_000 } = {}) {
    if (this._timer) return;
    this._timer = setInterval(() => {
      this.pauseStaleBots();
      this.runMissedSchedulesOnce().catch((err) => {
        try {
          this.notify({
            botId: null,
            title: 'Erro no agendador de Bots',
            body: String(err?.message || err),
            kind: 'error'
          });
        } catch {}
      });
    }, Math.max(10, Number(intervalMs) || 60_000));
    if (typeof this._timer.unref === 'function') {
      this._timer.unref();
    }
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  isRunning() {
    return Boolean(this._timer);
  }

  async runMissedSchedulesOnce(stepPlansByBotId = {}) {
    const executed = [];
    for (const bot of this.store.listBots()) {
      if (this.isBotDue(bot, this.now())) {
        const runTimestamp = this.now();
        this.lastRunByBot.set(bot.id, runTimestamp);
        this._recordBotScheduleRun(bot.id, runTimestamp);
        const steps = stepPlansByBotId[bot.id] || [{ tool: AGENT_TASK_TOOL, prompt: bot.goal, url: bot.defaultUrl, usesModel: true }];
        const result = await this.runner.runBotNow(bot.id, { steps });
        executed.push({ botId: bot.id, runId: result.runId, status: result.status });
        this.emitNotification({
          botId: bot.id,
          title: `Execução concluída: ${bot.name}`,
          body: result.error ? `Falha: ${result.error}` : 'Tarefa agendada executada com sucesso.',
          kind: result.error ? 'error' : 'success'
        });
      }
    }
    return executed;
  }

  pauseStaleBots(currentTimeMs = this.now()) {
    const pausedBotIds = [];
    for (const bot of this.store.listBots()) {
      if (!bot.active) continue;
      const lastVerifiedIso = bot.history?.find((h) => h.status === 'completed')?.startedAt || bot.createdAt;
      const lastVerifiedMs = Date.parse(lastVerifiedIso);
      if (Number.isFinite(lastVerifiedMs) && (currentTimeMs - lastVerifiedMs) > STALE_BOT_THRESHOLD_MS) {
        const raw = this.store.bots.get(bot.id);
        if (raw) {
          raw.active = false;
          raw.pausedReason = 'Pausado automaticamente: mais de 14 dias sem verificação.';
          pausedBotIds.push(bot.id);
        }
      }
    }
    if (pausedBotIds.length) {
      this.store._saveToDisk();
    }
    return pausedBotIds;
  }
}

module.exports = {
  STALE_BOT_THRESHOLD_MS,
  BotScheduler
};


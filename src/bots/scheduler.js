'use strict';

const STALE_BOT_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000; // 14 dias

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
    this.loginItemSettings = {
      openAtLogin: false,
      openAsHiddenInTray: true
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
      const scheduledToday = new Date(currentDate);
      scheduledToday.setUTCHours(targetHour, targetMinute, 0, 0);
      if (currentTimeMs < scheduledToday.getTime()) return false;
      if (lastRunMs == null) return true;
      return lastRunMs < scheduledToday.getTime();
    }

    if (schedule.kind === 'monthly') {
      const dayOfMonth = Math.min(28, Math.max(1, Number(schedule.dayOfMonth) || 5));
      const currentDate = new Date(currentTimeMs);
      if (currentDate.getUTCDate() < dayOfMonth) return false;
      const scheduledMonthStart = Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), dayOfMonth, 9, 0, 0);
      if (currentTimeMs < scheduledMonthStart) return false;
      if (lastRunMs == null) return true;
      return lastRunMs < scheduledMonthStart;
    }

    return false;
  }

  async runMissedSchedulesOnce(stepPlansByBotId = {}) {
    const executed = [];
    for (const bot of this.store.listBots()) {
      if (this.isBotDue(bot, this.now())) {
        this.lastRunByBot.set(bot.id, this.now());
        const steps = stepPlansByBotId[bot.id] || [{ tool: 'snapshot', mockData: { checkedAt: this.now() } }];
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


'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { canPersistToBotMemory, redactSecrets } = require('../automation/service/intent-firewall');

const READ_ONLY_TOOLS = Object.freeze(['snapshot', 'extract_table', 'wait', 'read_text', 'get_title', 'get_url']);
const MAX_HISTORY_ENTRIES = 200;

const SECRET_FIELD_PATTERN = /(password|senha|secret|token|api[-_]?key|cookie|credential|cartao|cvv)/i;

function stripSecretsFromObject(obj = {}) {
  if (!obj || typeof obj !== 'object') return {};
  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SECRET_FIELD_PATTERN.test(key)) {
      continue;
    }
    cleaned[key] = redactSecrets(value);
  }
  return cleaned;
}

class BotTaskStore {
  constructor({ filePath = null } = {}) {
    this.filePath = filePath;
    this.bots = new Map();
    if (this.filePath && fs.existsSync(this.filePath)) {
      this._loadFromDisk();
    }
  }

  _loadFromDisk() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      const list = Array.isArray(raw?.bots) ? raw.bots : [];
      for (const item of list) {
        if (item && item.id) {
          this.bots.set(item.id, item);
        }
      }
    } catch {
      // Inicia vazio se o arquivo não puder ser lido
    }
  }

  _saveToDisk() {
    if (!this.filePath) return;
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tmpPath = `${this.filePath}.tmp-${process.pid}-${Date.now()}`;
    const payload = JSON.stringify({ version: 1, bots: [...this.bots.values()] }, null, 2);
    fs.writeFileSync(tmpPath, payload, 'utf8');
    fs.renameSync(tmpPath, this.filePath);
  }

  createBot(spec = {}) {
    const name = String(spec.name || spec.nome || '').trim();
    if (!name) {
      throw new Error('O Bot precisa de um nome.');
    }
    const id = String(spec.id || `bot-task-${crypto.randomUUID().slice(0, 8)}`);
    const allowedSites = Array.isArray(spec.allowedSites)
      ? spec.allowedSites.map((s) => String(s).trim()).filter(Boolean)
      : [];
    const permission = spec.permission === 'escrita-aprovada' ? 'escrita-aprovada' : 'somente-leitura';
    const allowedTools = Array.isArray(spec.allowedTools) && spec.allowedTools.length
      ? [...spec.allowedTools]
      : [...READ_ONLY_TOOLS];

    const record = {
      id,
      name,
      profileId: spec.profileId || null,
      template: spec.template || 'custom',
      goal: String(spec.goal || spec.objetivo || '').trim(),
      inputs: stripSecretsFromObject(spec.inputs || {}),
      allowedSites,
      permission,
      allowedTools,
      autonomyStep: 1, // Degrau 1 (somente leitura / sugestão) por padrão
      limits: {
        maxSteps: Math.max(1, Number(spec.limits?.maxSteps) || 15),
        maxDurationMs: Math.max(500, Number(spec.limits?.maxDurationMs) || 60_000),
        maxSpendUsd: Math.max(0, Number(spec.limits?.maxSpendUsd ?? 0.25)),
        monthlySpendCapUsd: Math.max(0, Number(spec.limits?.monthlySpendCapUsd ?? 5.0))
      },
      schedule: spec.schedule || { enabled: false, kind: 'manual', intervalHours: null },
      memory: [],
      history: [],
      verifiedSuccessCount: 0,
      active: spec.active !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.bots.set(id, record);
    this._saveToDisk();
    return structuredClone(record);
  }

  getBot(id) {
    const bot = this.bots.get(id);
    return bot ? structuredClone(bot) : null;
  }

  listBots() {
    return [...this.bots.values()].map((b) => structuredClone(b));
  }

  addMemoryItem(botId, entry = {}) {
    const bot = this.bots.get(botId);
    if (!bot) throw new Error(`Bot "${botId}" não encontrado.`);
    const check = canPersistToBotMemory(entry);
    if (!check.allowed) {
      throw new Error(check.reason);
    }
    const item = {
      id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text: String(entry.content?.value ?? entry.content ?? ''),
      confirmedByUser: Boolean(entry.confirmedByUser),
      createdAt: new Date().toISOString()
    };
    bot.memory.push(item);
    bot.updatedAt = new Date().toISOString();
    this._saveToDisk();
    return structuredClone(item);
  }

  promoteAutonomy(botId, { targetStep, confirmedByUser = false } = {}) {
    const bot = this.bots.get(botId);
    if (!bot) throw new Error(`Bot "${botId}" não encontrado.`);
    const nextStep = Number(targetStep);
    if (!Number.isInteger(nextStep) || nextStep < 1 || nextStep > 3) {
      throw new Error('Degrau de autonomia inválido (use 1, 2 ou 3).');
    }
    if (nextStep > bot.autonomyStep && !confirmedByUser) {
      throw new Error('Subir degrau de autonomia exige confirmação humana explícita.');
    }
    bot.autonomyStep = nextStep;
    bot.updatedAt = new Date().toISOString();
    this._saveToDisk();
    return structuredClone(bot);
  }

  recordRunResult(botId, runEntry = {}) {
    const bot = this.bots.get(botId);
    if (!bot) throw new Error(`Bot "${botId}" não encontrado.`);
    const normalized = {
      runId: runEntry.runId || `run-${Date.now()}`,
      status: runEntry.status || 'completed',
      startedAt: runEntry.startedAt || new Date().toISOString(),
      durationMs: Number(runEntry.durationMs) || 0,
      stepsExecuted: Number(runEntry.stepsExecuted) || 0,
      tokensUsed: Number(runEntry.tokensUsed) || 0,
      spendUsd: Number(runEntry.spendUsd) || 0,
      usedRecipeOnly: Boolean(runEntry.usedRecipeOnly),
      output: redactSecrets(runEntry.output ?? null),
      error: runEntry.error || null,
      receiptHash: runEntry.receiptHash || null
    };
    bot.history.unshift(normalized);
    if (bot.history.length > MAX_HISTORY_ENTRIES) {
      bot.history.length = MAX_HISTORY_ENTRIES;
    }
    if (normalized.status === 'completed' && !normalized.error) {
      bot.verifiedSuccessCount += 1;
    } else if (normalized.status === 'failed' || normalized.status === 'blocked') {
      // Rebaixamento automático ao falhar
      bot.autonomyStep = 1;
    }
    bot.updatedAt = new Date().toISOString();
    this._saveToDisk();
    return structuredClone(normalized);
  }

  exportBotTemplate(botId) {
    const bot = this.bots.get(botId);
    if (!bot) throw new Error(`Bot "${botId}" não encontrado.`);
    return {
      schemaVersion: 1,
      name: bot.name,
      template: bot.template,
      goal: bot.goal,
      inputs: stripSecretsFromObject(bot.inputs),
      allowedSites: [...bot.allowedSites],
      allowedTools: [...bot.allowedTools],
      limits: { ...bot.limits },
      schedule: { ...bot.schedule }
      // Sem profileId, sem logins/cookies, sem memória pessoal e sem histórico
    };
  }

  importBotTemplate(pkg = {}) {
    return this.createBot({
      name: pkg.name,
      template: pkg.template,
      goal: pkg.goal,
      inputs: pkg.inputs,
      allowedSites: pkg.allowedSites,
      allowedTools: READ_ONLY_TOOLS,
      permission: 'somente-leitura',
      limits: pkg.limits,
      schedule: { ...(pkg.schedule || {}), enabled: false },
      active: false
    });
  }
}

module.exports = {
  READ_ONLY_TOOLS,
  BotTaskStore
};


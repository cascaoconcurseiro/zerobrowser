'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { canPersistToBotMemory, redactSecrets } = require('../automation/service/intent-firewall');

const READ_ONLY_TOOLS = Object.freeze(['snapshot', 'extract_table', 'wait', 'read_text', 'get_title', 'get_url']);
const MAX_HISTORY_ENTRIES = 200;

const EXECUTION_MODES = Object.freeze({
  DEDICATED_TAB: 'dedicated-tab',
  BACKGROUND_AUTO_FOREGROUND: 'background-auto-foreground'
});

const SPECIALIST_BOT_PRESETS = Object.freeze([
  {
    id: 'price-hunter',
    title: 'Monitor de preço',
    subtitle: 'Acompanha o preço de um produto e avisa quando cai abaixo do seu limite.',
    defaultName: 'Bot Monitor de Preço',
    defaultUrl: 'https://www.google.com/shopping',
    goal: 'Acompanhar o preço à vista e o frete do produto indicado nas lojas abertas, só em leitura. Se não achar o produto, pedir o nome exato ou o link. Nunca comprar nem preencher cadastro. Quando o preço cair abaixo do limite, avisar com valor, loja e link, e mostrar o recibo.',
    levelLabel: 'Só ler',
    permission: 'somente-leitura',
    executionMode: EXECUTION_MODES.BACKGROUND_AUTO_FOREGROUND,
    accent: '#168f72'
  },
  {
    id: 'researcher',
    title: 'Pesquisador',
    subtitle: 'Junta fontes sobre um assunto e entrega um resumo com os links.',
    defaultName: 'Bot Pesquisador',
    defaultUrl: 'https://www.google.com',
    goal: 'Pesquisar o assunto indicado, juntar até cinco fontes com link e data, resumir em tópicos e citar a origem de cada número. Não inventar fonte. Só ler; ao terminar, mostrar o recibo.',
    levelLabel: 'Só ler',
    permission: 'somente-leitura',
    executionMode: EXECUTION_MODES.BACKGROUND_AUTO_FOREGROUND,
    accent: '#2480d2'
  },
  {
    id: 'data-analyst',
    title: 'Analista de Dados',
    subtitle: 'Lê tabelas de páginas e responde com números claros.',
    defaultName: 'Bot Analista',
    defaultUrl: 'about:blank',
    goal: 'Extrair a tabela indicada da página, conferir totais e explicar os números em frases simples. Só ler, sem alterar dados. Mostrar o recibo com a origem da tabela.',
    levelLabel: 'Só ler',
    permission: 'somente-leitura',
    executionMode: EXECUTION_MODES.BACKGROUND_AUTO_FOREGROUND,
    accent: '#8966d4'
  },
  {
    id: 'erp-operator',
    title: 'Operador ERP',
    subtitle: 'Extrai dados da aba do sistema e prepara formulários. Pede aprovação antes de enviar.',
    defaultName: 'Bot Operador ERP',
    defaultUrl: 'about:blank',
    goal: 'Extrair dados operacionais da aba do sistema, preparar os campos do formulário e trazer a aba para frente pedindo aprovação antes de enviar. Nunca enviar sem o seu sim; antes, mostrar o conteúdo exato.',
    levelLabel: 'Com aprovação',
    permission: 'escrita-aprovada',
    executionMode: EXECUTION_MODES.DEDICATED_TAB,
    accent: '#c95f18'
  },
  {
    id: 'writer',
    title: 'Redator',
    subtitle: 'Escreve ou revisa textos a partir do que você passar. Entrega só rascunho.',
    defaultName: 'Bot Redator',
    defaultUrl: 'about:blank',
    goal: 'Escrever ou revisar o texto indicado, em linguagem simples, e entregar apenas o rascunho na conversa. Não enviar, não publicar e não colar em outro site.',
    levelLabel: 'Rascunho',
    permission: 'somente-leitura',
    executionMode: EXECUTION_MODES.BACKGROUND_AUTO_FOREGROUND,
    accent: '#7b4fd4'
  },
  {
    id: 'personal-assistant',
    title: 'Assistente Pessoal',
    subtitle: 'Organiza suas tarefas e prioridades do dia. Só sugere, não age.',
    defaultName: 'Bot Assistente',
    defaultUrl: 'about:blank',
    goal: 'Organizar as tarefas que você listar por prazo e prioridade e entregar um plano em rascunho na conversa. Não criar eventos nem enviar convites sem aprovação.',
    levelLabel: 'Rascunho',
    permission: 'somente-leitura',
    executionMode: EXECUTION_MODES.BACKGROUND_AUTO_FOREGROUND,
    accent: '#0d9488'
  },
  {
    id: 'planner',
    title: 'Planejador',
    subtitle: 'Monta um plano com prazos e etapas para um objetivo seu.',
    defaultName: 'Bot Planejador',
    defaultUrl: 'about:blank',
    goal: 'Montar, a partir do objetivo indicado, um plano com etapas, prazos e riscos, como rascunho na conversa. Não agendar nada sozinho.',
    levelLabel: 'Rascunho',
    permission: 'somente-leitura',
    executionMode: EXECUTION_MODES.BACKGROUND_AUTO_FOREGROUND,
    accent: '#a17522'
  },
  {
    id: 'inbox-triage',
    title: 'Resumo de e-mail',
    subtitle: 'Lê as mensagens do dia e separa o que é urgente. Não responde nem apaga.',
    defaultName: 'Bot de E-mail',
    defaultUrl: 'about:blank',
    goal: 'Ler as mensagens visíveis do dia, separar o que é urgente e resumir cada uma em uma frase. Não responder, não apagar e não abrir anexos.',
    levelLabel: 'Só ler',
    permission: 'somente-leitura',
    executionMode: EXECUTION_MODES.BACKGROUND_AUTO_FOREGROUND,
    accent: '#b8860b'
  },
  {
    id: 'order-checker',
    title: 'Conferir pedidos',
    subtitle: 'Confere pedidos novos na loja e avisa o que mudou. Só leitura.',
    defaultName: 'Bot de Pedidos',
    defaultUrl: 'about:blank',
    goal: 'Conferir na loja os pedidos novos desde a última vez e avisar quais mudaram de situação. Só ler; nunca alterar o status de um pedido.',
    levelLabel: 'Só ler',
    permission: 'somente-leitura',
    executionMode: EXECUTION_MODES.BACKGROUND_AUTO_FOREGROUND,
    accent: '#c65684'
  }
]);

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

    const specialtyId = String(spec.specialty || spec.template || 'custom-specialist').trim();
    const preset = SPECIALIST_BOT_PRESETS.find((p) => p.id === specialtyId) || SPECIALIST_BOT_PRESETS[SPECIALIST_BOT_PRESETS.length - 1];
    const executionMode = spec.executionMode === EXECUTION_MODES.DEDICATED_TAB
      ? EXECUTION_MODES.DEDICATED_TAB
      : EXECUTION_MODES.BACKGROUND_AUTO_FOREGROUND;

    const record = {
      id,
      name,
      profileId: spec.profileId || null,
      template: spec.template || specialtyId,
      specialty: preset.id,
      specialtyTitle: String(spec.specialtyTitle || preset.title),
      executionMode,
      autoForegroundOnGoal: spec.autoForegroundOnGoal !== false,
      autoForegroundOnIntervention: spec.autoForegroundOnIntervention !== false,
      defaultUrl: String(spec.defaultUrl || preset.defaultUrl || 'about:blank').trim(),
      accent: String(spec.accent || preset.accent || '#168f72').trim(),
      goal: String(spec.goal || spec.objetivo || preset.goal || '').trim(),
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

  updateBotSchedule(botId, schedule = {}) {
    const bot = this.bots.get(botId);
    if (!bot) throw new Error(`Bot "${botId}" não encontrado.`);
    bot.schedule = { ...(bot.schedule || {}), ...schedule };
    bot.updatedAt = new Date().toISOString();
    this._saveToDisk();
    return structuredClone(bot);
  }

  recordScheduleRun(botId, timestampMs = Date.now()) {
    const bot = this.bots.get(botId);
    if (!bot) return null;
    if (!bot.schedule) bot.schedule = { enabled: false, kind: 'manual' };
    bot.schedule.lastRunAt = new Date(timestampMs).toISOString();
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
      receiptHash: runEntry.receiptHash || null,
      shouldBringToFront: Boolean(runEntry.shouldBringToFront),
      bringToFrontReason: runEntry.bringToFrontReason || null
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
  EXECUTION_MODES,
  SPECIALIST_BOT_PRESETS,
  BotTaskStore
};


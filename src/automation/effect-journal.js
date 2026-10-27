// Journal de efeitos: registra ações consequentes antes de executá-las para não repetir às cegas depois de falha,
// timeout ou reinício. Guarda só identidade e estado — nunca texto digitado ou conteúdo da página.
//
// Estados: attempted (executamos, efeito desconhecido), retryable (o modelo releu a página e pode tentar de novo),
// confirmed (a ação teve sucesso e não deve repetir).

const { createHash } = require('crypto');
const fs = require('fs');
const path = require('path');

const CONSEQUENTIAL = Object.freeze({
  navigate: () => true,
  upload_file: () => true,
  click: () => true,
  click_text: () => true,
  press_key: (args) => ['Enter', ' ', 'Space'].includes(String(args.key || '')),
  hidden_action: (args) => ['click', 'check', 'uncheck', 'select'].includes(String(args.action || ''))
});

// Erros que acontecem antes de qualquer efeito: pode descartar a tentativa sem pedir verificação.
const PRE_DISPATCH_FAILURE = /não existe|não encontrad|Element not found|snapshot|página mudou|indisponível|aba indisponível|inválid|não é uma lista|não aceita/i;

function normalizeUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return `${url.origin}${url.pathname}`;
  } catch {
    return String(value || '');
  }
}

function isConsequential(tool, args = {}) {
  const check = CONSEQUENTIAL[tool];
  return Boolean(check && check(args));
}

function effectKey({ tool, args = {}, url = '', target = '' }) {
  const payload = JSON.stringify({
    tool,
    target: String(target || ''),
    url: normalizeUrl(url),
    args: {
      index: Number.isInteger(args.index) ? args.index : undefined,
      targetId: args.targetId || undefined,
      text: typeof args.text === 'string' ? args.text.slice(0, 120) : undefined,
      action: args.action || undefined,
      key: args.key || undefined,
      file: args.file ? path.basename(String(args.file)) : undefined
    }
  });
  return createHash('sha256').update(payload).digest('hex').slice(0, 20);
}

function createMemoryStore(initial = null) {
  let data = initial;
  return {
    async read() { return data ? JSON.parse(JSON.stringify(data)) : null; },
    async write(next) { data = JSON.parse(JSON.stringify(next)); }
  };
}

function createFileStore(filePath) {
  return {
    async read() {
      try {
        return JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
      } catch {
        return null;
      }
    },
    async write(data) {
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      const temporary = `${filePath}.${process.pid}.tmp`;
      await fs.promises.writeFile(temporary, JSON.stringify(data));
      await fs.promises.rename(temporary, filePath);
    }
  };
}

class EffectJournal {
  constructor({ store = createMemoryStore(), limit = 300, ttlMs = 30 * 60 * 1000, now = () => Date.now() } = {}) {
    this.store = store;
    this.limit = Math.max(1, Number(limit) || 300);
    this.ttlMs = Math.max(0, Number(ttlMs) || 0);
    this.now = now;
    this.entries = {};
    this.loaded = false;
    this.loading = null;
  }

  async ensureLoaded() {
    if (this.loaded) return this;
    if (!this.loading) {
      this.loading = (async () => {
        const data = await this.store.read().catch(() => null);
        const entries = data && typeof data === 'object' && data.entries && typeof data.entries === 'object' ? data.entries : {};
        this.entries = {};
        for (const [key, entry] of Object.entries(entries)) {
          if (!entry || typeof entry !== 'object') continue;
          if (!['attempted', 'retryable', 'confirmed'].includes(entry.state)) continue;
          this.entries[key] = entry;
        }
        this.loaded = true;
      })();
    }
    await this.loading;
    return this;
  }

  peek(key) {
    const entry = this.entries[key];
    if (!entry) return null;
    // Entrada velha não vale mais: uma tarefa de hoje não herda confirmação de dias atrás.
    if (this.ttlMs > 0 && this.now() - (Number(entry.at) || 0) > this.ttlMs) return null;
    return { ...entry };
  }

  async persist() {
    const entries = Object.entries(this.entries)
      .sort((a, b) => (Number(b[1].at) || 0) - (Number(a[1].at) || 0))
      .slice(0, this.limit);
    this.entries = Object.fromEntries(entries);
    try {
      await this.store.write({ version: 1, entries: this.entries });
    } catch {
      // Sem persistência o journal continua válido dentro da execução; o pior caso é perder a memória no reinício.
    }
  }

  async markAttempted(key, meta = {}) {
    await this.ensureLoaded();
    this.entries[key] = { state: 'attempted', at: this.now(), ...pickMeta(meta) };
    await this.persist();
    return this.peek(key);
  }

  async confirm(key, meta = {}) {
    await this.ensureLoaded();
    this.entries[key] = { ...(this.entries[key] || {}), ...pickMeta(meta), state: 'confirmed', at: this.now() };
    await this.persist();
    return this.peek(key);
  }

  async abandon(key) {
    await this.ensureLoaded();
    delete this.entries[key];
    await this.persist();
  }

  // Depois de uma leitura bem-sucedida o modelo tem evidência nova: tentativas sem confirmação voltam a ser permitidas.
  async markRetryable() {
    await this.ensureLoaded();
    let changed = 0;
    for (const entry of Object.values(this.entries)) {
      if (entry.state !== 'attempted') continue;
      entry.state = 'retryable';
      entry.at = this.now();
      changed += 1;
    }
    if (changed) await this.persist();
    return changed;
  }

  snapshot() {
    return Object.fromEntries(Object.entries(this.entries).map(([key, entry]) => [key, { ...entry }]));
  }
}

function pickMeta(meta) {
  const out = {};
  for (const key of ['tool', 'url', 'target', 'tabId']) {
    if (meta[key] !== undefined && meta[key] !== null && meta[key] !== '') out[key] = String(meta[key]).slice(0, 200);
  }
  return out;
}

// Decide sem executar: executa, pula (já confirmado) ou bloqueia até haver verificação da página.
async function planEffect(journal, effect) {
  if (!journal || !effect) return { action: 'execute' };
  await journal.ensureLoaded();
  const prior = journal.peek(effect.key);
  if (prior?.state === 'confirmed') {
    return {
      action: 'skip',
      prior,
      output: {
        success: true, alreadyDone: true, readOnly: true,
        note: 'Esta ação já foi executada e confirmada nesta tarefa; não repeti para não duplicar o efeito. Confira a página antes de concluir.'
      }
    };
  }
  if (prior?.state === 'attempted') {
    return {
      action: 'block',
      prior,
      output: {
        success: false, needsVerification: true,
        error: 'Esta ação já foi tentada e o efeito é desconhecido. Inspecione a página para confirmar se ela aconteceu antes de repetir; depois disso a repetição é permitida.',
        priorAttemptAt: prior.at || null
      }
    };
  }
  return { action: 'execute', prior };
}

async function settleEffect(journal, key, output) {
  if (!journal || !key) return null;
  if (output?.success === false) {
    if (PRE_DISPATCH_FAILURE.test(String(output.error || ''))) {
      await journal.abandon(key);
      return 'abandoned';
    }
    return 'attempted';
  }
  await journal.confirm(key, { tool: output?.tool });
  return 'confirmed';
}

module.exports = {
  EffectJournal, createMemoryStore, createFileStore, effectKey, isConsequential, planEffect, settleEffect,
  normalizeUrl, PRE_DISPATCH_FAILURE
};

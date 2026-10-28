// Tarefas pausadas sobrevivem ao reinício: histórico sem chave de API, TTL curto e limite de tamanho.
// O objetivo é o botão "Continuar" funcionar depois de fechar o app, e não guardar conversa para sempre.

const fs = require('fs');
const path = require('path');

const DEFAULT_TTL_MS = 20 * 60 * 1000;
const MAX_JOBS = 8;
const MAX_TOTAL_BYTES = 2 * 1024 * 1024;

function sanitizeState(state, now) {
  const messages = Array.isArray(state?.messages) ? state.messages : [];
  return {
    id: String(state?.id || ''),
    messages,
    tabId: state?.tabId || null,
    rootTabId: state?.rootTabId || null,
    model: state?.model || null,
    provider: state?.provider || null,
    taskStartedAt: Number(state?.taskStartedAt) || now,
    knownDownloads: Array.isArray(state?.knownDownloads) ? state.knownDownloads : [],
    knownTabs: Array.isArray(state?.knownTabs) ? state.knownTabs : [],
    tabTrail: Array.isArray(state?.tabTrail) ? state.tabTrail : [],
    lastUrl: typeof state?.lastUrl === 'string' ? state.lastUrl : '',
    expiresAt: Number(state?.expiresAt) || now
  };
}

class JobStore {
  constructor({ filePath = ':memory:', now = () => Date.now(), ttlMs = DEFAULT_TTL_MS } = {}) {
    this.filePath = filePath;
    this.now = now;
    this.ttlMs = ttlMs;
    this.jobs = new Map();
    this.loaded = false;
  }

  async load() {
    if (this.loaded) return this.jobs;
    this.loaded = true;
    if (this.filePath === ':memory:') return this.jobs;
    try {
      const parsed = JSON.parse(await fs.promises.readFile(this.filePath, 'utf8'));
      for (const job of Array.isArray(parsed?.jobs) ? parsed.jobs : []) {
        if (!job?.id) continue;
        if (Number(job.expiresAt) <= this.now()) continue;
        this.jobs.set(job.id, sanitizeState(job, this.now()));
      }
    } catch {
      this.jobs.clear();
    }
    return this.jobs;
  }

  async persist() {
    if (this.filePath === ':memory:') return;
    const live = [...this.jobs.values()].filter((job) => job.expiresAt > this.now());
    live.sort((a, b) => b.taskStartedAt - a.taskStartedAt);
    const kept = [];
    let bytes = 0;
    for (const job of live.slice(0, MAX_JOBS)) {
      const size = Buffer.byteLength(JSON.stringify(job));
      if (bytes + size > MAX_TOTAL_BYTES) continue;
      bytes += size;
      kept.push(job);
    }
    this.jobs = new Map(kept.map((job) => [job.id, job]));
    await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.${process.pid}.tmp`;
    await fs.promises.writeFile(temporary, JSON.stringify({ version: 1, jobs: kept }));
    await fs.promises.rename(temporary, this.filePath);
  }

  async save(id, state) {
    await this.load();
    if (!id) throw new Error('Tarefa sem id');
    const job = sanitizeState({ ...state, id, expiresAt: this.now() + this.ttlMs }, this.now());
    this.jobs.set(id, job);
    await this.persist();
    return job;
  }

  async remove(id) {
    await this.load();
    const existed = this.jobs.delete(id);
    if (existed) await this.persist();
    return existed;
  }

  async prune() {
    await this.load();
    for (const [id, job] of this.jobs) {
      if (job.expiresAt <= this.now()) this.jobs.delete(id);
    }
    // Sempre reescreve: o load() descarta expirados da memória, e o arquivo precisa refletir isso.
    await this.persist();
    return [...this.jobs.values()];
  }

  async list() {
    await this.load();
    return [...this.jobs.values()]
      .filter((job) => job.expiresAt > this.now())
      .sort((a, b) => b.taskStartedAt - a.taskStartedAt)
      .map((job) => ({
        id: job.id,
        tabId: job.tabId,
        model: job.model,
        provider: job.provider,
        messages: job.messages.length,
        lastUrl: job.lastUrl,
        startedAt: job.taskStartedAt,
        expiresAt: job.expiresAt
      }));
  }
}

module.exports = { JobStore, DEFAULT_TTL_MS, MAX_JOBS, MAX_TOTAL_BYTES };

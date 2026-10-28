// Módulos de operação: o agente escreve uma função determinística sobre dados já lidos, salva e reexecuta.
// É o passo de codegen que faltava — mas sem executar código na página e sem depender de novo modelo.

const fs = require('fs');
const path = require('path');
const { checkCode } = require('./sandbox');

const NAME_PATTERN = /^[a-z0-9][a-z0-9._-]{0,40}$/i;
const MAX_MODULES = 100;
const MAX_DESCRIPTION = 200;

function normalizeOrigin(value) {
  try {
    const url = new URL(String(value || ''));
    return ['http:', 'https:'].includes(url.protocol) ? url.origin : '';
  } catch {
    return '';
  }
}

function validateModule({ name, code, description } = {}) {
  if (typeof name !== 'string' || !NAME_PATTERN.test(name)) return 'name deve ter 1–41 caracteres (letras, números, ponto, hífen ou _).';
  const problem = checkCode(code);
  if (problem) return problem;
  if (description !== undefined && (typeof description !== 'string' || description.length > MAX_DESCRIPTION)) {
    return `description deve ter até ${MAX_DESCRIPTION} caracteres.`;
  }
  return null;
}

class ModuleStore {
  constructor({ filePath = ':memory:', now = () => Date.now() } = {}) {
    this.filePath = filePath;
    this.now = now;
    this.data = { version: 1, origins: {} };
    this.loaded = false;
  }

  async load() {
    if (this.loaded) return this.data;
    this.loaded = true;
    if (this.filePath === ':memory:') return this.data;
    try {
      const parsed = JSON.parse(await fs.promises.readFile(this.filePath, 'utf8'));
      if (parsed && typeof parsed === 'object' && parsed.origins && typeof parsed.origins === 'object') this.data = parsed;
    } catch {
      this.data = { version: 1, origins: {} };
    }
    return this.data;
  }

  async persist() {
    if (this.filePath === ':memory:') return;
    const flat = [];
    for (const [origin, modules] of Object.entries(this.data.origins)) {
      for (const module of Object.values(modules)) flat.push([origin, module]);
    }
    flat.sort((a, b) => (b[1]?.savedAt || 0) - (a[1]?.savedAt || 0));
    const keep = new Set(flat.slice(0, MAX_MODULES).map(([origin, module]) => `${origin}\u0000${module.name}`));
    for (const [origin, modules] of Object.entries(this.data.origins)) {
      for (const name of Object.keys(modules)) {
        if (!keep.has(`${origin}\u0000${name}`)) delete modules[name];
      }
      if (!Object.keys(modules).length) delete this.data.origins[origin];
    }
    await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.${process.pid}.tmp`;
    await fs.promises.writeFile(temporary, JSON.stringify(this.data));
    await fs.promises.rename(temporary, this.filePath);
  }

  async save(origin, { name, code, description = '' } = {}) {
    await this.load();
    const key = normalizeOrigin(origin);
    if (!key) throw new Error('Origem inválida para módulo');
    this.data.origins[key] = this.data.origins[key] || {};
    this.data.origins[key][name] = { name, origin: key, code, description, savedAt: this.now() };
    await this.persist();
    return this.data.origins[key][name];
  }

  async get(origin, name) {
    await this.load();
    return this.data.origins[normalizeOrigin(origin)]?.[name] || null;
  }

  async list(origin = null) {
    await this.load();
    const key = origin === null ? null : normalizeOrigin(origin);
    const rows = [];
    for (const [originKey, modules] of Object.entries(this.data.origins)) {
      if (key !== null && originKey !== key) continue;
      for (const module of Object.values(modules)) {
        rows.push({ name: module.name, origin: originKey, description: module.description || '', savedAt: module.savedAt });
      }
    }
    return rows.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
  }

  async forget(origin, name) {
    await this.load();
    const key = normalizeOrigin(origin);
    const existed = Boolean(this.data.origins[key]?.[name]);
    if (existed) {
      delete this.data.origins[key][name];
      if (!Object.keys(this.data.origins[key]).length) delete this.data.origins[key];
      await this.persist();
    }
    return existed;
  }
}

const MODULE_TOOL = {
  type: 'function',
  function: {
    name: 'module',
    description: 'Módulo de operação determinístico por site: save grava um código que transforma dados já lidos, run executa no sandbox (sem require/rede/disco) com input, list mostra os módulos e forget apaga. Use para somar colunas, normalizar datas e repetir o cálculo sem modelo.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['save', 'run', 'list', 'forget'] },
        name: { type: 'string' },
        code: { type: 'string', description: 'Corpo de função: recebe input e retorna o resultado (save/run).' },
        description: { type: 'string', description: 'O que o módulo faz, em uma linha (save).' },
        input: { description: 'Dados JSON de entrada (run).' }
      },
      required: ['action'],
      additionalProperties: false
    }
  }
};

module.exports = { ModuleStore, MODULE_TOOL, validateModule, NAME_PATTERN };

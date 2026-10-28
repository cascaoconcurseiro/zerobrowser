// Receitas por site: sequências determinísticas de passos estáveis (navegar, clicar por texto, esperar texto),
// cada uma com pós-condição obrigatória. Guardadas por origem, sem segredo e sem índice de snapshot.

const fs = require('fs');
const path = require('path');

const ALLOWED_TOOLS = Object.freeze(['navigate', 'click_text', 'wait_for']);
const MAX_STEPS = 15;
const MAX_RECIPES_PER_ORIGIN = 50;
const MAX_STORED = 200;
const NAME_PATTERN = /^[a-z0-9][a-z0-9._-]{0,40}$/i;

function normalizeOrigin(value) {
  try {
    const url = new URL(String(value || ''));
    return ['http:', 'https:'].includes(url.protocol) ? url.origin : '';
  } catch {
    return '';
  }
}

function validateInputSchema(input) {
  if (input === undefined || input === null) return null;
  if (typeof input !== 'object' || Array.isArray(input)) return 'input deve ser um objeto de schema.';
  const properties = input.properties;
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return 'input.properties é obrigatório.';
  const names = Object.keys(properties);
  if (names.length > 20) return 'No máximo 20 entradas.';
  for (const name of names) {
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,40}$/.test(name)) return `Entrada inválida: ${name}.`;
    const property = properties[name];
    if (!property || !['string', 'number', 'boolean'].includes(property.type)) return `Entrada ${name}: type deve ser string, number ou boolean.`;
  }
  if (input.required !== undefined) {
    if (!Array.isArray(input.required) || input.required.some((name) => typeof name !== 'string' || !names.includes(name))) {
      return 'input.required deve listar propriedades existentes.';
    }
  }
  return null;
}

function validateRecipe({ name, steps, input } = {}) {
  if (typeof name !== 'string' || !NAME_PATTERN.test(name)) return 'name deve ter 1–41 caracteres (letras, números, ponto, hífen ou _).';
  const inputProblem = validateInputSchema(input);
  if (inputProblem) return inputProblem;
  if (!Array.isArray(steps) || !steps.length) return 'Informe ao menos um passo.';
  if (steps.length > MAX_STEPS) return `No máximo ${MAX_STEPS} passos por receita.`;
  for (const [i, step] of steps.entries()) {
    const label = `Passo ${i + 1}`;
    if (!step || typeof step !== 'object') return `${label}: inválido.`;
    if (!ALLOWED_TOOLS.includes(step.tool)) return `${label}: use apenas ${ALLOWED_TOOLS.join(', ')}.`;
    if (!step.args || typeof step.args !== 'object' || Array.isArray(step.args)) return `${label}: args deve ser um objeto.`;
    if (step.tool === 'navigate' && (typeof step.args.url !== 'string' || !['http:', 'https:'].includes((() => { try { return new URL(step.args.url).protocol; } catch { return ''; } })()))) {
      return `${label}: navigate exige URL HTTP/HTTPS.`;
    }
    if (step.tool !== 'navigate' && (typeof step.args.text !== 'string' || !step.args.text.trim())) return `${label}: ${step.tool} exige args.text.`;
    if (!step.expect || typeof step.expect !== 'object' || Array.isArray(step.expect) || !Object.keys(step.expect).length) {
      return `${label}: toda receita exige expect (url, text ou absent).`;
    }
    if (Object.keys(step.expect).some((key) => !['url', 'text', 'absent'].includes(key))) return `${label}: expect aceita url, text ou absent.`;
  }
  return null;
}

function missingRequiredInputs(input, values = {}) {
  const required = Array.isArray(input?.required) ? input.required : [];
  return required.filter((name) => values?.[name] === undefined || values?.[name] === null || values[name] === '');
}

function renderTemplate(value, values) {
  return String(value).replace(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g, (_, key) => {
    if (!values || values[key] === undefined || values[key] === null) throw new Error(`Entrada ausente: ${key}`);
    return String(values[key]);
  });
}

// Substitui {{campo}} em args e expect por valores da chamada; a receita guardada continua genérica.
function applyRecipeInputs(steps, values = {}) {
  return (Array.isArray(steps) ? steps : []).map((step) => {
    const cloned = JSON.parse(JSON.stringify(step));
    const walk = (object) => {
      for (const [key, value] of Object.entries(object)) {
        if (typeof value === 'string') object[key] = renderTemplate(value, values);
        else if (value && typeof value === 'object') walk(value);
      }
    };
    walk(cloned.args);
    if (cloned.expect) walk(cloned.expect);
    return cloned;
  });
}

class RecipeStore {
  constructor({ filePath = ':memory:', now = () => Date.now() } = {}) {
    this.filePath = filePath;
    this.now = now;
    this.data = { version: 1, recipes: {} };
    this.loaded = false;
  }

  async load() {
    if (this.loaded) return this.data;
    this.loaded = true;
    if (this.filePath === ':memory:') return this.data;
    try {
      const parsed = JSON.parse(await fs.promises.readFile(this.filePath, 'utf8'));
      if (parsed && typeof parsed === 'object' && parsed.recipes && typeof parsed.recipes === 'object') this.data = parsed;
    } catch {
      this.data = { version: 1, recipes: {} };
    }
    return this.data;
  }

  async persist() {
    if (this.filePath === ':memory:') return;
    const origins = Object.keys(this.data.recipes);
    const flat = [];
    for (const origin of origins) {
      for (const [name, recipe] of Object.entries(this.data.recipes[origin])) flat.push([origin, name, recipe]);
    }
    flat.sort((a, b) => (b[1]?.savedAt || 0) - (a[1]?.savedAt || 0));
    const keep = new Set(flat.slice(0, MAX_STORED).map(([origin, name]) => `${origin}\u0000${name}`));
    for (const origin of origins) {
      for (const name of Object.keys(this.data.recipes[origin])) {
        if (!keep.has(`${origin}\u0000${name}`)) delete this.data.recipes[origin][name];
        if (Object.keys(this.data.recipes[origin]).length > MAX_RECIPES_PER_ORIGIN) {
          const names = Object.keys(this.data.recipes[origin]);
          names.sort((a, b) => (this.data.recipes[origin][a]?.savedAt || 0) - (this.data.recipes[origin][b]?.savedAt || 0));
          delete this.data.recipes[origin][names[0]];
        }
      }
      if (!Object.keys(this.data.recipes[origin]).length) delete this.data.recipes[origin];
    }
    await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.${process.pid}.tmp`;
    await fs.promises.writeFile(temporary, JSON.stringify(this.data));
    await fs.promises.rename(temporary, this.filePath);
  }

  async save(origin, name, steps, input = null) {
    await this.load();
    const key = normalizeOrigin(origin);
    if (!key) throw new Error('Origem inválida para receita');
    this.data.recipes[key] = this.data.recipes[key] || {};
    this.data.recipes[key][name] = { name, steps, ...(input ? { input } : {}), savedAt: this.now() };
    await this.persist();
    return this.data.recipes[key][name];
  }

  async get(origin, name) {
    await this.load();
    const key = normalizeOrigin(origin);
    const recipes = this.data.recipes[key] || {};
    return recipes[name] || null;
  }

  async list(origin) {
    await this.load();
    const key = normalizeOrigin(origin);
    return Object.values(this.data.recipes[key] || {}).map(({ name, steps, input, savedAt }) => ({ name, steps: steps.length, ...(input ? { inputs: Object.keys(input.properties || {}) } : {}), savedAt }));
  }
}

const RECIPE_TOOL = {
  type: 'function',
  function: {
    name: 'recipe',
    description: 'Receitas determinísticas por site (sem modelo). list mostra as da origem; save grava passos estáveis (navigate, click_text, wait_for) com expect e schema de entrada opcional; run executa com values, sem chamar o modelo, e para na primeira pós-condição que falhar.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'save', 'run'] },
        name: { type: 'string' },
        steps: {
          type: 'array',
          maxItems: MAX_STEPS,
          items: {
            type: 'object',
            properties: {
              tool: { type: 'string', enum: [...ALLOWED_TOOLS] },
              args: { type: 'object' },
              expect: {
                type: 'object',
                properties: { url: { type: 'string' }, text: { type: 'string' }, absent: { type: 'string' } },
                additionalProperties: false
              }
            },
            required: ['tool', 'args', 'expect'],
            additionalProperties: false
          }
        },
        input: {
          type: 'object',
          description: 'Schema de entradas (save): properties com type string/number/boolean e required.',
          properties: {
            properties: { type: 'object' },
            required: { type: 'array', items: { type: 'string' } }
          },
          additionalProperties: false
        },
        values: { type: 'object', description: 'Valores para os placeholders {{campo}} (run).' }
      },
      required: ['action'],
      additionalProperties: false
    }
  }
};

module.exports = {
  RecipeStore, RECIPE_TOOL, validateRecipe, validateInputSchema, applyRecipeInputs, missingRequiredInputs,
  normalizeOrigin, ALLOWED_TOOLS, MAX_STEPS
};

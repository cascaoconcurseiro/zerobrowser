// Contrato de saída por receita: a receita declara quais células viram quais campos tipados.
// O host valida o resultado lido (não o texto que o modelo diz ter lido) e devolve output + problemas.

const CELL_PATTERN = /^[A-Z]{1,3}[1-9][0-9]{0,6}$/;
const RANGE_PATTERN = /^([A-Z]{1,3})([1-9][0-9]{0,6})(?::([A-Z]{1,3})([1-9][0-9]{0,6}))?$/;
const TYPES = Object.freeze(['string', 'number', 'boolean', 'array']);
const MAX_PROPERTIES = 40;

function columnIndex(letters) {
  let index = 0;
  for (const char of String(letters).toUpperCase()) index = index * 26 + (char.charCodeAt(0) - 64);
  return index - 1;
}

function parseRange(value) {
  const match = RANGE_PATTERN.exec(String(value || '').trim().toUpperCase());
  if (!match) return null;
  const startColumn = columnIndex(match[1]);
  const startRow = Number(match[2]) - 1;
  const endColumn = match[3] ? columnIndex(match[3]) : startColumn;
  const endRow = match[4] ? Number(match[4]) - 1 : startRow;
  return {
    startColumn, startRow,
    endColumn: Math.max(startColumn, endColumn),
    endRow: Math.max(startRow, endRow)
  };
}

function parseCell(value) {
  const text = String(value || '').trim().toUpperCase();
  if (!CELL_PATTERN.test(text)) return null;
  const match = /^([A-Z]{1,3})([1-9][0-9]{0,6})$/.exec(text);
  return { column: columnIndex(match[1]), row: Number(match[2]) - 1 };
}

// "1.234,56", "R$ 1.234,56", "(12)", "12%", "1,5" -> número; qualquer outra coisa -> null.
function parseNumber(raw) {
  let text = String(raw ?? '').trim();
  if (!text) return null;
  let negative = false;
  if (/^\(.*\)$/.test(text)) { negative = true; text = text.slice(1, -1); }
  text = text.replace(/[R$€£¥\s\u00a0%]/gi, '');
  if (text.startsWith('+')) text = text.slice(1);
  if (text.startsWith('-')) { negative = !negative; text = text.slice(1); }
  if (!text) return null;
  const lastDot = text.lastIndexOf('.');
  const lastComma = text.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    text = lastComma > lastDot ? text.replace(/\./g, '').replace(/,/g, '.') : text.replace(/,/g, '');
  } else if (lastComma >= 0) {
    const parts = text.split(',');
    text = parts.length === 2 && parts[1].length <= 2 ? `${parts[0]}.${parts[1]}` : text.replace(/,/g, '');
  } else if (lastDot >= 0) {
    const parts = text.split('.');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) text = text.replace(/\./g, '');
  }
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const number = Number(text);
  if (!Number.isFinite(number)) return null;
  return negative ? -number : number;
}

const TRUE_WORDS = new Set(['true', 'sim', 's', 'yes', 'y', '1', 'verdadeiro', 'ativo', 'x']);
const FALSE_WORDS = new Set(['false', 'não', 'nao', 'n', 'no', '0', 'falso', 'inativo']);

function parseBoolean(raw) {
  if (typeof raw === 'boolean') return raw;
  const text = String(raw ?? '').trim().toLowerCase();
  if (TRUE_WORDS.has(text)) return true;
  if (FALSE_WORDS.has(text)) return false;
  return null;
}

function parseArray(raw) {
  if (Array.isArray(raw)) return raw.map((item) => String(item).trim()).filter(Boolean);
  const text = String(raw ?? '').trim();
  if (!text) return [];
  if (text.includes('\n')) return text.split('\n').map((line) => line.trim()).filter(Boolean);
  if (text.includes(';')) return text.split(';').map((item) => item.trim()).filter(Boolean);
  if (text.includes(',')) return text.split(',').map((item) => item.trim()).filter(Boolean);
  return [text];
}

function validateOutputSchema(output) {
  if (output === undefined || output === null) return null;
  if (typeof output !== 'object' || Array.isArray(output)) return 'output deve ser um objeto de schema.';
  const properties = output.properties;
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return 'output.properties é obrigatório.';
  const names = Object.keys(properties);
  if (!names.length) return 'output.properties exige ao menos um campo.';
  if (names.length > MAX_PROPERTIES) return `No máximo ${MAX_PROPERTIES} campos de saída.`;
  for (const name of names) {
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,40}$/.test(name)) return `Campo de saída inválido: ${name}.`;
    const property = properties[name];
    if (!property || typeof property !== 'object' || Array.isArray(property)) return `Campo ${name}: definição inválida.`;
    if (!TYPES.includes(property.type)) return `Campo ${name}: type deve ser ${TYPES.join(', ')}.`;
    if (typeof property.cell !== 'string' || !CELL_PATTERN.test(property.cell.trim().toUpperCase())) {
      return `Campo ${name}: cell deve ser uma célula A1 (ex.: B2).`;
    }
  }
  if (output.required !== undefined) {
    if (!Array.isArray(output.required) || output.required.some((name) => typeof name !== 'string' || !names.includes(name))) {
      return 'output.required deve listar campos existentes.';
    }
  }
  return null;
}

// A grade vem da cópia do próprio intervalo: grid[0][0] é a célula inicial de `range`.
// Célula fora da grade não vira valor inventado — o contrato falha.
function readGridCell(grid, range, cell) {
  const start = parseRange(range);
  const target = parseCell(cell);
  if (!start || !target) return { found: false, reason: 'referência inválida' };
  const row = target.row - start.startRow;
  const column = target.column - start.startColumn;
  if (row < 0 || column < 0) return { found: false, reason: 'célula fora do intervalo lido' };
  const line = Array.isArray(grid) ? grid[row] : undefined;
  if (!Array.isArray(line)) return { found: false, reason: 'linha ausente na leitura' };
  const value = line[column];
  if (value === undefined) return { found: false, reason: 'coluna ausente na leitura' };
  return { found: true, value: String(value) };
}

// Valida o contrato sobre a grade lida. Devolve { ok, output, problems } sem inventar valor ausente.
function validateOutput(schema, { grid, range } = {}) {
  const problem = validateOutputSchema(schema);
  if (problem) return { ok: false, output: {}, problems: [problem] };
  if (!schema) return { ok: true, output: {}, problems: [] };
  if (!Array.isArray(grid)) return { ok: false, output: {}, problems: ['nenhuma leitura de planilha disponível para validar a saída'] };
  const output = {};
  const problems = [];
  for (const [name, property] of Object.entries(schema.properties)) {
    const cell = readGridCell(grid, range, property.cell);
    if (!cell.found) {
      problems.push(`${name}: ${cell.reason} (${property.cell})`);
      continue;
    }
    const raw = cell.value;
    const empty = String(raw).trim() === '';
    if (empty) {
      if (property.type === 'array') output[name] = [];
      else if (property.type === 'string') output[name] = '';
      else problems.push(`${name}: célula ${property.cell} vazia`);
      continue;
    }
    if (property.type === 'string') { output[name] = raw.trim(); continue; }
    const parsed = property.type === 'number' ? parseNumber(raw)
      : property.type === 'boolean' ? parseBoolean(raw)
        : parseArray(raw);
    if (parsed === null) problems.push(`${name}: "${raw.slice(0, 40)}" não é ${property.type}`);
    else output[name] = parsed;
  }
  const required = Array.isArray(schema.required) ? schema.required : [];
  for (const name of required) {
    if (output[name] === undefined) problems.push(`${name}: obrigatório e ausente`);
  }
  return { ok: problems.length === 0, output, problems };
}

module.exports = {
  validateOutputSchema, validateOutput, parseNumber, parseBoolean, parseArray,
  parseRange, parseCell, columnIndex, CELL_PATTERN, TYPES, MAX_PROPERTIES
};

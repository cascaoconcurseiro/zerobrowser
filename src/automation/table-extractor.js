// Extração estruturada de tabela: o host lê a grade da página, o modelo declara só as colunas que quer.
// Nada de texto de célula no trace; cada linha devolvida é um objeto com as colunas pedidas.

const MAX_ROWS = 500;
const DEFAULT_ROWS = 100;
const MAX_COLUMNS = 30;
const MAX_RAW_ROWS = 2000;

const EXTRACT_TABLE_TOOL = {
  type: 'function',
  function: {
    name: 'extract_table',
    description: 'Extrai uma tabela da página como linhas estruturadas. Escolha a tabela por selector (CSS) ou tableIndex e informe as colunas desejadas pelo cabeçalho; sem columns, usa o cabeçalho da página. Linhas vazias e duplicadas são descartadas. Somente leitura.',
    parameters: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'Seletor CSS da tabela. Sem ele, usa as tabelas <table> da página.' },
        tableIndex: { type: 'integer', minimum: 0, description: 'Qual tabela usar quando há várias (padrão 0).' },
        columns: { type: 'array', items: { type: 'string' }, maxItems: MAX_COLUMNS, description: 'Nomes de coluna do cabeçalho, na ordem desejada.' },
        maxRows: { type: 'integer', minimum: 1, maximum: MAX_ROWS, description: `Máximo de linhas devolvidas (padrão ${DEFAULT_ROWS}).` }
      },
      additionalProperties: false
    }
  }
};

function normalizeCell(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeHeader(value) {
  return normalizeCell(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function validateRequest({ selector, tableIndex, columns, maxRows } = {}) {
  if (selector !== undefined && (typeof selector !== 'string' || !selector.trim() || selector.length > 300)) {
    return 'selector deve ser um CSS não vazio de até 300 caracteres.';
  }
  if (tableIndex !== undefined && (!Number.isInteger(tableIndex) || tableIndex < 0)) return 'tableIndex deve ser inteiro não negativo.';
  if (maxRows !== undefined && (!Number.isInteger(maxRows) || maxRows < 1 || maxRows > MAX_ROWS)) return `maxRows deve estar entre 1 e ${MAX_ROWS}.`;
  if (columns !== undefined) {
    if (!Array.isArray(columns) || !columns.length) return 'columns deve ser uma lista não vazia.';
    if (columns.length > MAX_COLUMNS) return `No máximo ${MAX_COLUMNS} colunas.`;
    for (const [i, name] of columns.entries()) {
      if (typeof name !== 'string' || !name.trim() || name.length > 120) return `Coluna ${i + 1}: nome inválido.`;
    }
  }
  return null;
}

function mapColumns(headers, requested) {
  const normalized = headers.map(normalizeHeader);
  if (!Array.isArray(requested) || !requested.length) {
    return { columns: headers.map(normalizeCell), indexes: headers.map((_, i) => i), missing: [] };
  }
  const indexes = [];
  const missing = [];
  for (const name of requested) {
    const at = normalized.indexOf(normalizeHeader(name));
    if (at < 0) missing.push(name);
    indexes.push(at);
  }
  return { columns: requested.map((name) => String(name).trim()), indexes, missing };
}

// Converte a grade crua em linhas nomeadas, descartando vazias e repetidas e respeitando o limite.
function shapeRows(rawRows, { headers = [], columns: requested, maxRows = DEFAULT_ROWS } = {}) {
  const { columns, indexes, missing } = mapColumns(Array.isArray(headers) ? headers : [], requested);
  const limit = Math.max(1, Math.min(Number(maxRows) || DEFAULT_ROWS, MAX_ROWS));
  const seen = new Set();
  const rows = [];
  let duplicatesSkipped = 0;
  for (const raw of Array.isArray(rawRows) ? rawRows : []) {
    const values = columns.map((_, i) => (indexes[i] >= 0 ? normalizeCell(raw?.[indexes[i]]) : ''));
    if (!values.some(Boolean)) continue;
    const signature = JSON.stringify(values);
    if (seen.has(signature)) {
      duplicatesSkipped += 1;
      continue;
    }
    seen.add(signature);
    rows.push(Object.fromEntries(columns.map((name, i) => [name, values[i]])));
    if (rows.length >= limit) break;
  }
  return {
    columns,
    rows,
    returned: rows.length,
    duplicatesSkipped,
    missingColumns: missing,
    truncated: (Array.isArray(rawRows) ? rawRows.length : 0) > rows.length
  };
}

// Script executado na aba. Devolve a grade crua; quem nomeia colunas é o host.
function buildTableScript({ selector = '', tableIndex = 0 } = {}) {
  return `(() => {
    const selector = ${JSON.stringify(String(selector || ''))};
    const index = ${Number(tableIndex) || 0};
    const cellsOf = (row) => [...(row.cells || [])].map((cell) => String(cell.innerText ?? cell.textContent ?? '').replace(/\\s+/g, ' ').trim());
    const tables = (selector ? [...document.querySelectorAll(selector)] : [...document.querySelectorAll('table')])
      .filter((table) => table && table.rows && table.rows.length > 1);
    const table = tables[index];
    if (!table) return { found: false, tableCount: tables.length };
    const headRow = (table.tHead && table.tHead.rows && table.tHead.rows[0]) || table.rows[0];
    const bodyRows = table.tBodies && table.tBodies.length
      ? [...table.tBodies].flatMap((body) => [...body.rows])
      : [...table.rows].slice(1);
    return {
      found: true,
      tableCount: tables.length,
      headers: cellsOf(headRow),
      rows: bodyRows.map(cellsOf).slice(0, ${MAX_RAW_ROWS}),
      totalRows: bodyRows.length
    };
  })()`;
}

module.exports = {
  EXTRACT_TABLE_TOOL, MAX_ROWS, DEFAULT_ROWS, MAX_COLUMNS, MAX_RAW_ROWS,
  validateRequest, mapColumns, shapeRows, buildTableScript, normalizeCell
};

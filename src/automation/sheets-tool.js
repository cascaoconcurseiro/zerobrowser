// Módulo determinístico do Google Planilhas: ler/gravar intervalo A1 via caixa de nome + clipboard + teclado.
// Nada de clique em célula. É o equivalente local ao "módulo de operação" que o Pomerado gera por site.

const RANGE_PATTERN = /^[A-Z]{1,3}[1-9][0-9]{0,6}(:[A-Z]{1,3}[1-9][0-9]{0,6})?$/;
const MAX_ROWS = 500;
const MAX_COLUMNS = 30;
const MAX_CELLS = 5000;
const MAX_TSV = 200 * 1000;

const SHEETS_TOOL = {
  type: 'function',
  function: {
    name: 'sheets',
    description: 'Opera a planilha do Google por intervalo A1, sem clicar em célula: read (copia o intervalo e devolve linhas), write (cola values em TSV) ou goto (seleciona o intervalo). Use em docs.google.com/spreadsheets.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['read', 'write', 'goto'] },
        range: { type: 'string', description: 'Intervalo A1, ex.: A1:C20 ou B2.' },
        values: { type: 'array', items: { type: 'array', items: { type: 'string' } }, description: 'Linhas e colunas para write.' },
        maxRows: { type: 'integer', minimum: 1, maximum: 500 },
        maxColumns: { type: 'integer', minimum: 1, maximum: 30 }
      },
      required: ['action', 'range'],
      additionalProperties: false
    }
  }
};

function validateSheetsRequest({ action, range, values, maxRows, maxColumns } = {}) {
  if (!['read', 'write', 'goto'].includes(action)) return 'action deve ser read, write ou goto.';
  if (typeof range !== 'string' || !RANGE_PATTERN.test(range.trim().toUpperCase())) return 'range deve ser um intervalo A1 (ex.: A1:C20).';
  if (maxRows !== undefined && (!Number.isInteger(maxRows) || maxRows < 1 || maxRows > MAX_ROWS)) return `maxRows deve estar entre 1 e ${MAX_ROWS}.`;
  if (maxColumns !== undefined && (!Number.isInteger(maxColumns) || maxColumns < 1 || maxColumns > MAX_COLUMNS)) return `maxColumns deve estar entre 1 e ${MAX_COLUMNS}.`;
  if (action === 'write') {
    if (!Array.isArray(values) || !values.length) return 'write exige values (linhas).';
    if (values.length > MAX_ROWS) return `No máximo ${MAX_ROWS} linhas por escrita.`;
    let cells = 0;
    for (const [i, row] of values.entries()) {
      if (!Array.isArray(row) || !row.length) return `Linha ${i + 1}: lista de células vazia.`;
      if (row.length > MAX_COLUMNS) return `Linha ${i + 1}: no máximo ${MAX_COLUMNS} colunas.`;
      cells += row.length;
      if (row.some((cell) => typeof cell === 'number' || typeof cell === 'boolean')) continue;
      if (row.some((cell) => typeof cell !== 'string')) return `Linha ${i + 1}: células devem ser texto, número ou booleano.`;
    }
    if (cells > MAX_CELLS) return `No máximo ${MAX_CELLS} células por escrita.`;
    if (valuesToTsv(values).length > MAX_TSV) return 'Conteúdo acima do limite de clipboard; divida em partes.';
  }
  return null;
}

function valuesToTsv(values) {
  return (Array.isArray(values) ? values : [])
    .map((row) => (Array.isArray(row) ? row : [row]).map((cell) => String(cell ?? '')).join('\t'))
    .join('\n');
}

function parseTsv(text) {
  const value = String(text ?? '').replace(/\r\n/g, '\n');
  if (!value) return [];
  return value.split('\n').map((line) => line.split('\t'));
}

function readRangeSummary(text, { maxRows = MAX_ROWS, maxColumns = MAX_COLUMNS } = {}) {
  const rows = parseTsv(text).slice(0, maxRows).map((row) => row.slice(0, maxColumns));
  const cells = rows.reduce((sum, row) => sum + row.length, 0);
  return {
    values: rows,
    rows: rows.length,
    columns: rows.reduce((max, row) => Math.max(max, row.length), 0),
    cells,
    truncated: parseTsv(text).length > rows.length || parseTsv(text).some((row) => row.length > maxColumns)
  };
}

// Foca a caixa de nome (id/aria em pt e en) e limpa o valor; o host digita o intervalo e confirma com Enter.
function focusNameBoxScript() {
  return `(() => {
    const candidates = [
      '#t-name-box',
      'input.waffle-name-box',
      'input[aria-label="Name Box"]',
      'input[aria-label="Caixa de nome"]',
      'input[aria-label*="Name Box" i]',
      'input[aria-label*="nome" i]'
    ];
    for (const selector of candidates) {
      const box = document.querySelector(selector);
      if (!box || box.offsetParent === null) continue;
      box.focus();
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(box, '');
      box.dispatchEvent(new Event('input', { bubbles: true }));
      return { found: true, selector };
    }
    return { found: false };
  })()`;
}

module.exports = {
  SHEETS_TOOL, validateSheetsRequest, valuesToTsv, parseTsv, readRangeSummary, focusNameBoxScript,
  RANGE_PATTERN, MAX_ROWS, MAX_COLUMNS
};

// Módulo determinístico do Google Planilhas: ler/gravar intervalo A1 via caixa de nome + clipboard + teclado.
// Nada de clique em célula. É o equivalente local ao "módulo de operação" que o Pomerado gera por site.

const RANGE_PATTERN = /^[A-Z]{1,3}[1-9][0-9]{0,6}(:[A-Z]{1,3}[1-9][0-9]{0,6})?$/;
const MAX_ROWS = 500;
const MAX_COLUMNS = 30;
const MAX_CELLS = 5000;
const MAX_TSV = 200 * 1000;
const MAX_BATCH = 12;

const SHEETS_TOOL = {
  type: 'function',
  function: {
    name: 'sheets',
    description: 'Opera a planilha do Google por intervalo A1, sem clicar em célula: read (copia o intervalo e devolve linhas), write (cola values em TSV), goto (seleciona o intervalo) ou batch (várias operações numa só chamada, com uma única aprovação de escrita). Use em docs.google.com/spreadsheets.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['read', 'write', 'goto', 'batch'] },
        range: { type: 'string', description: 'Intervalo A1, ex.: A1:C20 ou B2 (read/write/goto).' },
        values: { type: 'array', items: { type: 'array', items: { type: 'string' } }, description: 'Linhas e colunas para write.' },
        operations: {
          type: 'array',
          maxItems: MAX_BATCH,
          description: 'Para action batch: lista de {action, range, values} executada em ordem, parando na primeira falha.',
          items: {
            type: 'object',
            properties: {
              action: { type: 'string', enum: ['read', 'write', 'goto'] },
              range: { type: 'string' },
              values: { type: 'array', items: { type: 'array', items: { type: 'string' } } }
            },
            required: ['action', 'range'],
            additionalProperties: false
          }
        },
        maxRows: { type: 'integer', minimum: 1, maximum: 500 },
        maxColumns: { type: 'integer', minimum: 1, maximum: 30 }
      },
      required: ['action'],
      additionalProperties: false
    }
  }
};

function validateSheetsRequest({ action, range, values, maxRows, maxColumns, operations } = {}) {
  if (!['read', 'write', 'goto', 'batch'].includes(action)) return 'action deve ser read, write, goto ou batch.';
  if (action === 'batch') {
    if (!Array.isArray(operations) || !operations.length) return 'batch exige operations (lista de read/write/goto).';
    if (operations.length > MAX_BATCH) return `No máximo ${MAX_BATCH} operações por batch.`;
    for (const [i, operation] of operations.entries()) {
      if (!operation || operation.action === 'batch') return `Operação ${i + 1}: use read, write ou goto.`;
      const problem = validateSheetsRequest({ ...operation });
      if (problem) return `Operação ${i + 1}: ${problem}`;
    }
    return null;
  }
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
      const previous = box.value;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(box, '');
      box.dispatchEvent(new Event('input', { bubbles: true }));
      return { found: true, selector, previous };
    }
    return { found: false };
  })()`;
}

// Lê o valor atual da caixa de nome para conferir se o intervalo foi aplicado.
function readNameBoxScript() {
  return `(() => {
    const candidates = ['#t-name-box', 'input.waffle-name-box', 'input[aria-label="Name Box"]', 'input[aria-label="Caixa de nome"]', 'input[aria-label*="Name Box" i]', 'input[aria-label*="nome" i]'];
    for (const selector of candidates) {
      const box = document.querySelector(selector);
      if (!box || box.offsetParent === null) continue;
      return { found: true, selector, value: String(box.value || '') };
    }
    return { found: false };
  })()`;
}

module.exports = {
  SHEETS_TOOL, validateSheetsRequest, valuesToTsv, parseTsv, readRangeSummary, focusNameBoxScript, readNameBoxScript,
  sheetsSnapshotScript, RANGE_PATTERN, MAX_ROWS, MAX_COLUMNS, MAX_BATCH
};

// Snapshot compacto de uma planilha: a célula não existe no DOM, então AX/innerText só gastam tokens.
function sheetsSnapshotScript() {
  return `(() => {
    const candidates = ['#t-name-box', 'input.waffle-name-box', 'input[aria-label="Name Box"]', 'input[aria-label="Caixa de nome"]', 'input[aria-label*="Name Box" i]', 'input[aria-label*="nome" i]'];
    let selection = '';
    for (const selector of candidates) {
      const box = document.querySelector(selector);
      if (!box) continue;
      selection = String(box.value || '');
      break;
    }
    const tabs = [...document.querySelectorAll('[role="tab"]')]
      .map((tab) => String(tab.innerText || '').trim())
      .filter((name) => name && name.length <= 60)
      .slice(0, 40);
    return { title: document.title, selection, tabs };
  })()`;
}

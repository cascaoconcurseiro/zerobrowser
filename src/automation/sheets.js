// Planilhas do Google desenham a grade em canvas. O modo de acessibilidade (leitor de tela) pode expor células no
// snapshot; alternamos por atalho e pedimos inspeção para confirmar. Sem promessa: o teste é do host.

const SHEETS_HOST = 'docs.google.com';
const SHEETS_PATH = '/spreadsheets';
const TOGGLE_KEYS = ['Control', 'Alt', 'z'];

const SHEETS_ACCESSIBILITY_TOOL = {
  type: 'function',
  function: {
    name: 'sheets_accessibility',
    description: 'Alterna o modo de acessibilidade do Planilhas (Ctrl+Alt+Z), que pode expor as células no snapshot. Só em docs.google.com/spreadsheets. Depois de alternar, inspecione a página para confirmar.',
    parameters: { type: 'object', properties: {}, additionalProperties: false }
  }
};

function isSheetsUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' && url.hostname === SHEETS_HOST && url.pathname.startsWith(SHEETS_PATH);
  } catch {
    return false;
  }
}

function toggleSteps() {
  return [{ keys: [...TOGGLE_KEYS] }];
}

module.exports = { SHEETS_ACCESSIBILITY_TOOL, isSheetsUrl, toggleSteps, SHEETS_HOST };

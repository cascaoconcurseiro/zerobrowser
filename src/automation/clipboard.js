// Área de transferência: ler/gravar texto para operações em bloco (TSV em planilhas, copiar/colar em editores).
// O serviço recebe a implementação do processo principal; testes injetam uma memória.

const MAX_WRITE = 200 * 1000;
const MAX_READ = 200 * 1000;

const CLIPBOARD_TOOL = {
  type: 'function',
  function: {
    name: 'clipboard',
    description: 'Lê ou grava texto na área de transferência. write cola tabela TSV/bloco; read traz a seleção copiada. write pede aprovação.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['read', 'write'] },
        text: { type: 'string', maxLength: MAX_WRITE },
        maxChars: { type: 'integer', minimum: 1, maximum: MAX_READ }
      },
      required: ['action'],
      additionalProperties: false
    }
  }
};

function validateClipboardRequest({ action, text, maxChars } = {}) {
  if (!['read', 'write'].includes(action)) return 'action deve ser read ou write.';
  if (maxChars !== undefined && (!Number.isInteger(maxChars) || maxChars < 1 || maxChars > MAX_READ)) return `maxChars deve estar entre 1 e ${MAX_READ}.`;
  if (action === 'write') {
    if (typeof text !== 'string' || !text.length) return 'write exige text não vazio.';
    if (text.length > MAX_WRITE) return `Texto acima de ${MAX_WRITE} caracteres; divida em partes.`;
  }
  return null;
}

function shapeClipboardRead(text, maxChars = MAX_READ) {
  const value = String(text ?? '');
  const limit = Math.max(1, Math.min(Number(maxChars) || MAX_READ, MAX_READ));
  const sliced = value.slice(0, limit);
  return { text: sliced, length: value.length, truncated: value.length > sliced.length };
}

module.exports = { CLIPBOARD_TOOL, validateClipboardRequest, shapeClipboardRead, MAX_WRITE, MAX_READ };

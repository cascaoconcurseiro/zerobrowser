// Sequência de teclado: navegação por setas/Tab em grades e editores, com repetição, sem clique por coordenada.

const MAX_STEPS = 50;
const MAX_REPEAT = 50;
const MAX_CHORDS = 200;

const KEY_SEQUENCE_TOOL = {
  type: 'function',
  function: {
    name: 'key_sequence',
    description: 'Executa teclas em ordem com repeat (setas ×N, Tab, Ctrl+seta). Para grades/editores sem DOM. Enter/espaço pode pedir aprovação.',
    parameters: {
      type: 'object',
      properties: {
        steps: {
          type: 'array',
          minItems: 1,
          maxItems: MAX_STEPS,
          items: {
            type: 'object',
            properties: {
              keys: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 4 },
              repeat: { type: 'integer', minimum: 1, maximum: MAX_REPEAT }
            },
            required: ['keys'],
            additionalProperties: false
          }
        }
      },
      required: ['steps'],
      additionalProperties: false
    }
  }
};

function validateSequence(steps) {
  if (!Array.isArray(steps) || !steps.length) return 'Informe ao menos uma combinação.';
  if (steps.length > MAX_STEPS) return `No máximo ${MAX_STEPS} passos.`;
  let chords = 0;
  for (const [i, step] of steps.entries()) {
    const label = `Passo ${i + 1}`;
    if (!step || typeof step !== 'object') return `${label}: inválido.`;
    if (!Array.isArray(step.keys) || !step.keys.length || step.keys.length > 4) return `${label}: keys deve ter 1 a 4 teclas.`;
    if (step.keys.some((key) => typeof key !== 'string' || !key.length || key.length > 20)) return `${label}: tecla inválida.`;
    if (step.repeat !== undefined && (!Number.isInteger(step.repeat) || step.repeat < 1 || step.repeat > MAX_REPEAT)) return `${label}: repeat deve ser inteiro entre 1 e ${MAX_REPEAT}.`;
    chords += step.repeat === undefined ? 1 : step.repeat;
  }
  if (chords > MAX_CHORDS) return `Sequência acima de ${MAX_CHORDS} combinações; divida em partes.`;
  return null;
}

function flattenKeys(steps) {
  return (Array.isArray(steps) ? steps : []).flatMap((step) => (Array.isArray(step?.keys) ? step.keys : []));
}

function needsFormApproval(steps) {
  return flattenKeys(steps).some((key) => ['Enter', 'Return', ' ', 'Space'].includes(String(key)));
}

module.exports = { KEY_SEQUENCE_TOOL, validateSequence, flattenKeys, needsFormApproval, MAX_STEPS, MAX_CHORDS };

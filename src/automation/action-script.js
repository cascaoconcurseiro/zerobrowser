// Script de ações verificado pelo host: o modelo manda vários passos de uma vez (preencher um formulário inteiro,
// marcar vários itens) e o host executa em ordem, conferindo cada resultado. Para no primeiro problema e diz onde.

const MAX_STEPS = 12;
const ALLOWED_TOOLS = new Set(['click', 'type_text', 'select_option', 'click_text', 'hidden_action', 'hover', 'wait_for']);

const RUN_STEPS_TOOL = {
  type: 'function',
  function: {
    name: 'run_steps',
    description: "Executa em ordem vários passos já conhecidos na página atual (preencher campos, marcar itens, clicar), numa só chamada. Cada passo é {tool, args} com tool em click, type_text, select_option, click_text, hidden_action, hover ou wait_for. Para no primeiro passo que falhar, abrir aba, baixar arquivo ou mudar a página; devolve o resultado de cada passo. Use índices do último inspect_page; deixe a ação que muda de página por último.",
    parameters: {
      type: 'object',
      properties: {
        steps: {
          type: 'array',
          minItems: 1,
          maxItems: MAX_STEPS,
          items: {
            type: 'object',
            properties: { tool: { type: 'string', enum: [...ALLOWED_TOOLS] }, args: { type: 'object' } },
            required: ['tool', 'args'],
            additionalProperties: false
          }
        }
      },
      required: ['steps'],
      additionalProperties: false
    }
  }
};

function validateSteps(steps) {
  if (!Array.isArray(steps) || steps.length === 0) return 'Informe ao menos um passo.';
  if (steps.length > MAX_STEPS) return `No máximo ${MAX_STEPS} passos por chamada.`;
  for (const [i, step] of steps.entries()) {
    if (!step || typeof step !== 'object' || !ALLOWED_TOOLS.has(step.tool)) return `Passo ${i + 1}: ferramenta não permitida em run_steps.`;
    if (step.args === undefined || typeof step.args !== 'object' || step.args === null || Array.isArray(step.args)) return `Passo ${i + 1}: args deve ser um objeto.`;
  }
  return null;
}

// callTool(name, args) executa uma ferramenta; shouldStop() é consultado após cada passo (aba nova, download, etc.).
async function runSteps(steps, callTool, { shouldStop = () => null } = {}) {
  const invalid = validateSteps(steps);
  if (invalid) return { success: false, error: invalid, completed: 0, total: Array.isArray(steps) ? steps.length : 0, results: [] };
  const results = [];
  for (const [i, step] of steps.entries()) {
    let output;
    try {
      output = await callTool(step.tool, step.args);
    } catch (error) {
      if (error?.code === 'USER_DENIED') throw error;
      results.push({ step: i + 1, tool: step.tool, ok: false, error: String(error.message || error).slice(0, 240) });
      return { success: false, failedAt: i + 1, completed: i, total: steps.length, results, error: `O passo ${i + 1} (${step.tool}) falhou; os seguintes não foram executados.` };
    }
    if (output?.success === false) {
      results.push({ step: i + 1, tool: step.tool, ok: false, error: String(output.error || 'falhou').slice(0, 240) });
      return { success: false, failedAt: i + 1, completed: i, total: steps.length, results, error: `O passo ${i + 1} (${step.tool}) falhou; os seguintes não foram executados.` };
    }
    results.push({ step: i + 1, tool: step.tool, ok: true, ...(typeof output?.target === 'string' ? { target: output.target } : {}) });
    const stop = shouldStop();
    if (stop && i < steps.length - 1) {
      return { success: true, stoppedEarly: true, reason: stop, completed: i + 1, total: steps.length, results, note: `Parei após o passo ${i + 1}: ${stop}. Os passos restantes não foram executados; confira a página e continue.` };
    }
  }
  return { success: true, completed: steps.length, total: steps.length, results };
}

module.exports = { RUN_STEPS_TOOL, runSteps, validateSteps, MAX_STEPS, ALLOWED_TOOLS };

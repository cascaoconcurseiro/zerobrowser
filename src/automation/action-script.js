// Script de ações verificado pelo host: o modelo manda vários passos de uma vez (preencher um formulário inteiro,
// marcar vários itens) e o host executa em ordem, conferindo cada resultado e a pós-condição declarada.
// Para no primeiro problema e diz onde.

const { invalidExpectationReason } = require('./expectation');

const MAX_STEPS = 12;
const ALLOWED_TOOLS = new Set(['click', 'type_text', 'select_option', 'click_text', 'hidden_action', 'hover', 'wait_for']);

const RUN_STEPS_TOOL = {
  type: 'function',
  function: {
    name: 'run_steps',
    description: "Executa em ordem vários passos já conhecidos na página atual (preencher campos, marcar itens, clicar), numa só chamada. Cada passo é {tool, args} com tool em click, type_text, select_option, click_text, hidden_action, hover ou wait_for, e pode declarar expect {url, text, absent} — o host espera até 3 s e só segue quando a pós-condição for verdadeira. Para no primeiro passo que falhar, não satisfazer o expect, abrir aba, baixar arquivo ou mudar a página; devolve o resultado de cada passo. Use índices do último inspect_page; deixe a ação que muda de página por último.",
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
              tool: { type: 'string', enum: [...ALLOWED_TOOLS] },
              args: { type: 'object' },
              expect: {
                type: 'object',
                properties: {
                  url: { type: 'string', description: 'Prefixo que a URL deve ter depois do passo.' },
                  text: { type: 'string', description: 'Texto que deve aparecer na página depois do passo.' },
                  absent: { type: 'string', description: 'Texto que não deve mais estar na página depois do passo.' }
                },
                additionalProperties: false
              }
            },
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
    if (!step || typeof step !== 'object') return `Passo ${i + 1}: passo inválido.`;
    if (!ALLOWED_TOOLS.has(step.tool)) return `Passo ${i + 1}: ferramenta não permitida em run_steps.`;
    if (step.args === undefined || typeof step.args !== 'object' || step.args === null || Array.isArray(step.args)) return `Passo ${i + 1}: args deve ser um objeto.`;
    const expectProblem = invalidExpectationReason(step.expect);
    if (expectProblem) return `Passo ${i + 1}: ${expectProblem}.`;
  }
  return null;
}

// Espera a pós-condição virar verdadeira: quem verifica é o host (verifyExpectation), nunca o modelo.
async function waitForExpectation(expect, verifyExpectation, { timeoutMs, pollMs }) {
  const deadline = Date.now() + Math.max(0, timeoutMs);
  let last = null;
  for (;;) {
    try {
      last = await verifyExpectation(expect);
    } catch (error) {
      last = { ok: false, detail: String(error?.message || error) };
    }
    if (last?.ok === true) return { ...last, ok: true };
    if (Date.now() >= deadline) return { ok: false, detail: last?.detail || 'pós-condição não confirmada' };
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

// callTool(name, args) executa uma ferramenta; shouldStop() é consultado após cada passo (aba nova, download, etc.).
// verifyExpectation(expect) devolve {ok, detail}; sem ele, passos com expect são recusados antes de qualquer ação.
// beforeStep/afterStep são o gate do journal de efeitos: antesStep devolve {skip|block|handle} e afterStep recebe o handle.
async function runSteps(steps, callTool, {
  shouldStop = () => null, verifyExpectation = null, expectationTimeoutMs = 3000, expectationPollMs = 120,
  beforeStep = null, afterStep = null
} = {}) {
  const invalid = validateSteps(steps);
  if (invalid) return { success: false, error: invalid, completed: 0, total: Array.isArray(steps) ? steps.length : 0, results: [] };
  if (steps.some((step) => step.expect) && typeof verifyExpectation !== 'function') {
    return { success: false, error: 'Pós-condições exigem a verificação do host, que não está disponível nesta tarefa.', completed: 0, total: steps.length, results: [] };
  }
  const results = [];
  for (const [i, step] of steps.entries()) {
    const gate = typeof beforeStep === 'function' ? await beforeStep(step, i) : null;
    if (gate?.block) {
      results.push({ step: i + 1, tool: step.tool, ok: false, needsVerification: true, error: String(gate.block.error || 'efeito desconhecido') });
      return {
        success: false, failedAt: i + 1, completed: i, total: steps.length, results, blockedEffect: true,
        error: `O passo ${i + 1} (${step.tool}) não foi executado: ${gate.block.error || 'o efeito anterior é desconhecido'}. Os seguintes não foram executados.`
      };
    }
    if (gate?.skip) {
      results.push({ step: i + 1, tool: step.tool, ok: true, alreadyDone: true, note: gate.skip.note });
      continue;
    }
    let output;
    try {
      output = await callTool(step.tool, step.args);
    } catch (error) {
      if (typeof afterStep === 'function') await afterStep(gate?.handle, step, { success: false, error: String(error?.message || error) });
      if (error?.code === 'USER_DENIED') throw error;
      results.push({ step: i + 1, tool: step.tool, ok: false, error: String(error.message || error).slice(0, 240) });
      return { success: false, failedAt: i + 1, completed: i, total: steps.length, results, error: `O passo ${i + 1} (${step.tool}) falhou; os seguintes não foram executados.` };
    }
    if (typeof afterStep === 'function') await afterStep(gate?.handle, step, output);
    if (output?.success === false) {
      results.push({ step: i + 1, tool: step.tool, ok: false, error: String(output.error || 'falhou').slice(0, 240) });
      return { success: false, failedAt: i + 1, completed: i, total: steps.length, results, error: `O passo ${i + 1} (${step.tool}) falhou; os seguintes não foram executados.` };
    }
    const entry = { step: i + 1, tool: step.tool, ok: true, ...(typeof output?.target === 'string' ? { target: output.target } : {}) };
    if (step.expect) {
      const verdict = await waitForExpectation(step.expect, verifyExpectation, { timeoutMs: expectationTimeoutMs, pollMs: expectationPollMs });
      if (!verdict.ok) {
        entry.ok = false;
        entry.actionExecuted = true;
        entry.expected = step.expect;
        entry.error = `pós-condição não confirmada: ${verdict.detail}`;
        results.push(entry);
        return {
          success: false, failedAt: i + 1, completed: i, total: steps.length, results,
          failedExpectation: { step: i + 1, expect: step.expect, detail: verdict.detail },
          error: `O passo ${i + 1} (${step.tool}) foi executado, mas a pós-condição falhou: ${verdict.detail}. Os seguintes não foram executados.`
        };
      }
      entry.expect = step.expect;
    }
    results.push(entry);
    const stop = shouldStop();
    if (stop && i < steps.length - 1) {
      return { success: true, stoppedEarly: true, reason: stop, completed: i + 1, total: steps.length, results, note: `Parei após o passo ${i + 1}: ${stop}. Os passos restantes não foram executados; confira a página e continue.` };
    }
  }
  return { success: true, completed: steps.length, total: steps.length, results };
}

module.exports = { RUN_STEPS_TOOL, runSteps, validateSteps, MAX_STEPS, ALLOWED_TOOLS };

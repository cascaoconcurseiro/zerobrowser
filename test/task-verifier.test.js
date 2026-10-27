const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateChecks, validateChecks, countOccurrences } = require('../src/automation/task-verifier');

test('url, text and absent checks describe the final state without trusting the model', () => {
  const state = { url: 'https://shop.test/checkout/ok', text: 'Pedido confirmado. Entrega em 3 dias.' };
  assert.equal(evaluateChecks([{ kind: 'url', value: 'https://shop.test/checkout' }], state).ok, true);
  assert.equal(evaluateChecks([{ kind: 'text', value: 'pedido CONFIRMADO' }], state).ok, true, 'sem caixa');
  assert.equal(evaluateChecks([{ kind: 'absent', value: 'Erro' }], state).ok, true);
  assert.equal(evaluateChecks([{ kind: 'text', value: 'Cancelado' }], state).ok, false);
  assert.equal(evaluateChecks([], state).ok, false, 'contrato vazio não aprova nada');
});

test('textCount compares occurrences with min and max', () => {
  assert.equal(countOccurrences('a a a', 'a'), 3);
  assert.equal(evaluateChecks([{ kind: 'textCount', value: 'Filial', min: 6, max: 6 }], { text: 'Filial Filial Filial Filial Filial Filial' }).ok, true);
  assert.equal(evaluateChecks([{ kind: 'textCount', value: 'Filial', min: 7 }], { text: 'Filial Filial' }).ok, false);
  assert.equal(evaluateChecks([{ kind: 'textCount', value: 'Ação', max: 1 }], { text: 'acao acao' }).ok, false);
});

test('download checks require a completed file and match by basename', () => {
  const state = { downloads: [{ filename: 'Relatorio.CSV', state: 'completed' }, { filename: 'outro.txt', state: 'progressing' }] };
  assert.equal(evaluateChecks([{ kind: 'download', value: 'relatorio.csv' }], state).ok, true);
  assert.equal(evaluateChecks([{ kind: 'download', value: 'outro.txt' }], state).ok, false);
  assert.equal(evaluateChecks([{ kind: 'download' }], state).ok, true, 'sem nome aceita qualquer download concluído');
  assert.equal(evaluateChecks([{ kind: 'download', value: 'x.csv' }], { downloads: [] }).ok, false);
});

test('invalid contracts are rejected before reading the page', () => {
  assert.match(validateChecks([]), /ao menos/);
  assert.match(validateChecks([{ kind: 'css' }]), /kind/);
  assert.match(validateChecks([{ kind: 'text' }]), /value/);
  assert.match(validateChecks([{ kind: 'textCount', value: 'x', min: 3, max: 1 }]), /min maior/);
  assert.match(validateChecks(new Array(21).fill({ kind: 'text', value: 'x' })), /No máximo/);
  assert.equal(validateChecks([{ kind: 'download' }]), null);
});

test('run_task returns host verification and can refuse to call the task done', async () => {
  const { AutomationService } = require('../src/automation/service');
  const service = new AutomationService();
  const url = 'http://127.0.0.1:5000/t/pedido';
  let pageText = 'Pedido confirmado. Obrigado!';
  service.tabs.set('tab-verify', {
    state: { url },
    webContents: {
      isDestroyed: () => false, isLoading: () => false, getURL: () => url,
      executeJavaScript: async (script) => (String(script).includes('innerText') ? pageText : null),
      setBackgroundThrottling: () => {}
    }
  });
  service.setBrowserControls({ createTab: async () => ({ tabId: 'tab-verify' }), closeTab: async () => {} });
  service.setAgentConfigProvider(async () => ({ provider: 'openrouter', model: 'test-model', apiKey: 'test-key' }));
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { role: 'assistant', content: 'Pedido enviado.' } }], usage: { prompt_tokens: 1, completion_tokens: 1 } })
  });
  try {
    const ok = await service.runTask({
      startUrl: url, prompt: 'Finalizar o pedido', approvalPolicy: 'local-fixture',
      verify: [{ kind: 'text', value: 'Pedido confirmado' }], requireVerification: true
    });
    assert.equal(ok.success, true);
    assert.equal(ok.verification.ok, true);
    assert.equal(ok.trace.verification.ok, true);

    pageText = 'Erro ao processar o pagamento';
    const failed = await service.runTask({
      startUrl: url, prompt: 'Finalizar o pedido', approvalPolicy: 'local-fixture',
      verify: [{ kind: 'text', value: 'Pedido confirmado' }], requireVerification: true
    });
    assert.equal(failed.success, false);
    assert.match(failed.error, /verificação final não confirmou/);
    assert.equal(failed.verification.results[0].ok, false);
    assert.equal(failed.trace.stopReason, 'final_answer', 'a recusa vem da verificação, não do agente');

    const report = await service.runTask({
      startUrl: url, prompt: 'Finalizar o pedido', approvalPolicy: 'local-fixture',
      verify: [{ kind: 'text', value: 'Pedido confirmado' }], requireVerification: false
    });
    assert.equal(report.success, true, 'sem exigir, a verificação só informa');
    assert.equal(report.verification.ok, false);
  } finally {
    global.fetch = originalFetch;
  }
});

test('a failed verification goes back to the agent for a bounded correction round', async () => {
  const { AutomationService } = require('../src/automation/service');
  const service = new AutomationService();
  const url = 'http://127.0.0.1:5000/t/pedido';
  let pageText = 'Processando pagamento';
  let round = 0;
  const bodies = [];
  service.tabs.set('tab-retry', {
    state: { url },
    webContents: {
      isDestroyed: () => false, isLoading: () => false, getURL: () => url,
      executeJavaScript: async (script) => (String(script).includes('innerText') ? pageText : null),
      setBackgroundThrottling: () => {}
    }
  });
  service.setBrowserControls({ createTab: async () => ({ tabId: 'tab-retry' }), closeTab: async () => {} });
  service.setAgentConfigProvider(async () => ({ provider: 'openrouter', model: 'test-model', apiKey: 'test-key' }));
  const originalFetch = global.fetch;
  global.fetch = async (_url, options) => {
    round += 1;
    bodies.push(JSON.parse(options.body));
    if (round === 2) pageText = 'Pedido confirmado';
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { role: 'assistant', content: 'Pedido enviado.' } }], usage: { prompt_tokens: 1, completion_tokens: 1 } })
    };
  };
  try {
    const result = await service.runTask({
      startUrl: url, prompt: 'Finalizar o pedido', approvalPolicy: 'local-fixture',
      verify: [{ kind: 'text', value: 'Pedido confirmado' }], requireVerification: true, correctionRounds: 1
    });
    assert.equal(round, 2, 'a falha de verificação gera exatamente uma nova rodada');
    assert.match(JSON.stringify(bodies[1].messages.at(-1)), /verificação final do host falhou/);
    assert.doesNotMatch(JSON.stringify(bodies[1].messages.at(-1)), /Processando pagamento/, 'o motivo não copia a página');
    assert.equal(result.success, true);
    assert.equal(result.verification.ok, true);
    assert.equal(result.trace.verificationRetries, 1);
  } finally {
    global.fetch = originalFetch;
  }
});

test('without correction rounds the verification only reports, and exhaustion still refuses completion', async () => {
  const { AutomationService } = require('../src/automation/service');
  const service = new AutomationService();
  const url = 'http://127.0.0.1:5000/t/pedido';
  let round = 0;
  service.tabs.set('tab-noretry', {
    state: { url },
    webContents: {
      isDestroyed: () => false, isLoading: () => false, getURL: () => url,
      executeJavaScript: async (script) => (String(script).includes('innerText') ? 'Processando pagamento' : null),
      setBackgroundThrottling: () => {}
    }
  });
  service.setBrowserControls({ createTab: async () => ({ tabId: 'tab-noretry' }), closeTab: async () => {} });
  service.setAgentConfigProvider(async () => ({ provider: 'openrouter', model: 'test-model', apiKey: 'test-key' }));
  const originalFetch = global.fetch;
  global.fetch = async () => {
    round += 1;
    return { ok: true, json: async () => ({ choices: [{ message: { role: 'assistant', content: 'Pronto.' } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) };
  };
  try {
    const reported = await service.runTask({
      startUrl: url, prompt: 'Finalizar', approvalPolicy: 'local-fixture',
      verify: [{ kind: 'text', value: 'Pedido confirmado' }]
    });
    assert.equal(round, 1, 'sem correção não há nova chamada ao modelo');
    assert.equal(reported.success, true);
    assert.equal(reported.verification.ok, false);

    round = 0;
    const exhausted = await service.runTask({
      startUrl: url, prompt: 'Finalizar', approvalPolicy: 'local-fixture',
      verify: [{ kind: 'text', value: 'Pedido confirmado' }], requireVerification: true, correctionRounds: 1
    });
    assert.equal(round, 2, 'uma rodada de correção e depois desiste');
    assert.equal(exhausted.success, false);
    assert.equal(exhausted.verification.ok, false);
    assert.equal(exhausted.trace.verificationRetries, 1);
  } finally {
    global.fetch = originalFetch;
  }
});

test('the agent can consult the verification contract before finishing', async () => {
  const { AutomationService } = require('../src/automation/service');
  const service = new AutomationService();
  const url = 'http://127.0.0.1:5000/t/check';
  let pageText = 'Pedido confirmado';
  service.tabs.set('tab-check', {
    state: { url },
    webContents: {
      isDestroyed: () => false, isLoading: () => false, getURL: () => url,
      executeJavaScript: async (script) => (String(script).includes('innerText') ? pageText : null),
      setBackgroundThrottling: () => {}
    }
  });
  service.setBrowserControls({ createTab: async () => ({ tabId: 'tab-check' }), closeTab: async () => {} });
  service.setAgentConfigProvider(async () => ({ provider: 'openrouter', model: 'test-model', apiKey: 'test-key' }));
  const originalFetch = global.fetch;
  const outputs = {};
  let round = 0;
  global.fetch = async (_url, options) => {
    const messages = JSON.parse(options.body).messages;
    const toolMessage = messages.find((message) => message.tool_call_id === 'check');
    if (toolMessage) outputs.check = JSON.parse(toolMessage.content);
    round += 1;
    const message = round === 1
      ? { role: 'assistant', tool_calls: [{ id: 'check', type: 'function', function: { name: 'check_task', arguments: '{}' } }] }
      : { role: 'assistant', content: 'Pronto.' };
    return { ok: true, json: async () => ({ choices: [{ message }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) };
  };
  try {
    const ok = await service.runTask({
      startUrl: url, prompt: 'Finalizar', approvalPolicy: 'local-fixture',
      verify: [{ kind: 'text', value: 'Pedido confirmado' }]
    });
    assert.equal(outputs.check.ok, true);
    assert.equal(outputs.check.results[0].ok, true);
    assert.equal(ok.trace.verifyChecks, 1);
    assert.equal(ok.success, true);

    pageText = 'Erro ao processar';
    round = 0;
    const notYet = await service.runTask({
      startUrl: url, prompt: 'Finalizar', approvalPolicy: 'local-fixture',
      verify: [{ kind: 'text', value: 'Pedido confirmado' }]
    });
    assert.equal(outputs.check.ok, false, 'a consulta informa o que falta sem derrubar a tarefa');
    assert.equal(notYet.success, true);
    assert.equal(notYet.verification.ok, false);
  } finally {
    global.fetch = originalFetch;
  }
});

test('check_task is refused when the task has no verification contract', async () => {
  const { AutomationService } = require('../src/automation/service');
  const service = new AutomationService();
  const url = 'http://127.0.0.1:5000/t/nocontract';
  service.tabs.set('tab-none', {
    state: { url },
    webContents: {
      isDestroyed: () => false, isLoading: () => false, getURL: () => url,
      executeJavaScript: async () => '', setBackgroundThrottling: () => {}
    }
  });
  service.setBrowserControls({ createTab: async () => ({ tabId: 'tab-none' }), closeTab: async () => {} });
  service.setAgentConfigProvider(async () => ({ provider: 'openrouter', model: 'test-model', apiKey: 'test-key' }));
  const originalFetch = global.fetch;
  let output;
  let round = 0;
  global.fetch = async (_url, options) => {
    const messages = JSON.parse(options.body).messages;
    const toolMessage = messages.find((message) => message.tool_call_id === 'check');
    if (toolMessage) output = JSON.parse(toolMessage.content);
    round += 1;
    const message = round === 1
      ? { role: 'assistant', tool_calls: [{ id: 'check', type: 'function', function: { name: 'check_task', arguments: '{}' } }] }
      : { role: 'assistant', content: 'Fim.' };
    return { ok: true, json: async () => ({ choices: [{ message }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) };
  };
  try {
    await service.runTask({ startUrl: url, prompt: 'Nada', approvalPolicy: 'local-fixture' });
    assert.equal(output.success, false);
    assert.match(output.error, /não está disponível/);
  } finally {
    global.fetch = originalFetch;
  }
});

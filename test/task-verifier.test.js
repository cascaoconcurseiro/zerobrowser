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

const test = require('node:test');
const assert = require('node:assert/strict');
const { runSteps, validateSteps } = require('../src/automation/action-script');
const { evaluateExpectation, invalidExpectationReason } = require('../src/automation/expectation');

test('expectation compares visible text without accents, case or extra spaces', () => {
  assert.equal(evaluateExpectation({ text: 'Pedido salvo' }, { text: '  PEDIDO   SALVO  ' }).ok, true);
  assert.equal(evaluateExpectation({ text: 'Ação concluída' }, { text: 'acao concluida' }).ok, true);
  assert.equal(evaluateExpectation({ text: 'Ação concluída' }, { text: 'nada aqui' }).ok, false);
});

test('expectation compares the URL by prefix and text that must be absent', () => {
  assert.equal(evaluateExpectation({ url: 'http://127.0.0.1/ok' }, { url: 'http://127.0.0.1/ok?x=1' }).ok, true);
  assert.equal(evaluateExpectation({ url: 'http://127.0.0.1/ok' }, { url: 'http://127.0.0.1/erro' }).ok, false);
  assert.equal(evaluateExpectation({ absent: 'Erro' }, { text: 'Tudo certo' }).ok, true);
  assert.equal(evaluateExpectation({ absent: 'Erro' }, { text: 'Erro de validacao' }).ok, false);
});

test('expectation validation rejects unknown keys, non-text values and empty conditions', () => {
  assert.equal(invalidExpectationReason({ text: 'ok' }), null);
  assert.match(invalidExpectationReason({ selector: '#id' }), /não aceita/);
  assert.match(invalidExpectationReason({ text: 42 }), /apenas textos/);
  assert.match(invalidExpectationReason({ text: '   ' }), /não vazio/);
  assert.match(invalidExpectationReason({}), /url, text ou absent/);
  assert.match(validateSteps([{ tool: 'click', args: {}, expect: { nope: 'x' } }]), /Passo 1/);
});

test('run_steps polls the host verifier until the postcondition holds', async () => {
  let checks = 0;
  const result = await runSteps(
    [{ tool: 'click', args: { index: 1 }, expect: { text: 'Salvo' } }],
    async () => ({ success: true }),
    {
      verifyExpectation: async () => ({ ok: ++checks >= 3, detail: 'ainda não' }),
      expectationTimeoutMs: 500,
      expectationPollMs: 5
    }
  );
  assert.equal(result.success, true);
  assert.equal(result.completed, 1);
  assert.ok(checks >= 3, 'a verificação foi repetida antes de passar');
  assert.deepEqual(result.results[0].expect, { text: 'Salvo' });
});

test('a step that ran but never satisfied the expectation stops the script', async () => {
  const executed = [];
  const result = await runSteps(
    [
      { tool: 'click', args: { index: 1 }, expect: { text: 'Salvo' } },
      { tool: 'click', args: { index: 2 } }
    ],
    async (name, args) => { executed.push(args.index); return { success: true }; },
    { verifyExpectation: async () => ({ ok: false, detail: 'texto não apareceu' }), expectationTimeoutMs: 15, expectationPollMs: 5 }
  );
  assert.equal(result.success, false);
  assert.equal(result.failedAt, 1);
  assert.equal(result.completed, 0);
  assert.match(result.error, /pós-condição/);
  assert.equal(result.failedExpectation.detail, 'texto não apareceu');
  assert.equal(result.results[0].actionExecuted, true);
  assert.deepEqual(executed, [1], 'o passo seguinte não pode ser executado');
});

test('expectations without a host verifier are refused before any action', async () => {
  let called = false;
  const result = await runSteps(
    [{ tool: 'click', args: { index: 1 }, expect: { text: 'Salvo' } }],
    async () => { called = true; return { success: true }; }
  );
  assert.equal(result.success, false);
  assert.match(result.error, /verificação do host/);
  assert.equal(called, false);
});

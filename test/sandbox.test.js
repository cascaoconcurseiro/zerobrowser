const test = require('node:test');
const assert = require('node:assert/strict');
const { checkCode, runTransform, TRANSFORM_TOOL } = require('../src/automation/sandbox');
const { reviewAction } = require('../src/automation/guardian');

test('static check refuses everything that could leave the sandbox', () => {
  assert.equal(checkCode('return input.a + 1'), null);
  for (const code of [
    'return require("fs")',
    'return import("x")',
    'return process.env',
    'return globalThis',
    'return Function("return 1")()',
    'return eval("1")',
    'return fetch("https://x")',
    'return new XMLHttpRequest()'
  ]) {
    assert.match(checkCode(code), /recusado/, code);
  }
  assert.match(checkCode(''), /obrigatório/);
  assert.match(checkCode('x'.repeat(5000)), /acima de/);
});

test('a deterministic transform runs in a separate process and returns JSON', async () => {
  const output = await runTransform('return input.rows.map((r) => Number(r[1])).reduce((a, b) => a + b, 0)', {
    rows: [['Cabo', '10'], ['Fita', '2.5']]
  });
  assert.equal(output.ok, true, output.error);
  assert.equal(output.result, 12.5);

  const shaped = await runTransform('return { total: input.length, nomes: input.map((x) => x.toUpperCase()) }', ['ana', 'bia']);
  assert.deepEqual(shaped.result, { total: 2, nomes: ['ANA', 'BIA'] });
});

test('errors inside the code come back as a failed result, not a crash', async () => {
  const output = await runTransform('throw new Error("quebrou de propósito")');
  assert.equal(output.ok, false);
  assert.match(output.error, /quebrou/);
  const invalid = await runTransform('return undefined.boom');
  assert.equal(invalid.ok, false);
});

test('an infinite loop is killed by the timeout', async () => {
  const started = Date.now();
  const output = await runTransform('while (true) {}', null, { timeoutMs: 700 });
  assert.equal(output.ok, false);
  assert.match(output.error, /tempo limite|inválida/);
  assert.ok(Date.now() - started < 5000, 'o processo não fica pendurado');
});

test('the guardian refuses unsafe transform code before execution', () => {
  assert.equal(reviewAction({ name: 'transform', args: { code: 'return 1' } }).decision, 'allow');
  const denied = reviewAction({ name: 'transform', args: { code: 'return require("fs")' } });
  assert.equal(denied.decision, 'deny');
  assert.match(denied.reasons[0], /require/);
});

test('the tool schema is a plain function definition', () => {
  assert.equal(TRANSFORM_TOOL.function.name, 'transform');
  assert.deepEqual(TRANSFORM_TOOL.function.parameters.required, ['code']);
});

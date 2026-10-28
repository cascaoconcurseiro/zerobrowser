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

test('transform execution fails closed, including constructor escape attempts', async () => {
  for (const code of ['return input.a + 1', "return input.constructor.constructor('return pro'+'cess')().version"]) {
    const output = await runTransform(code, { a: 1 });
    assert.equal(output.ok, false);
    assert.match(output.error, /desativada/);
  }
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

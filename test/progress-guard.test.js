const test = require('node:test');
const assert = require('node:assert/strict');
const { createProgressGuard, isReadOnly } = require('../src/automation/progress-guard');

test('read-only detection covers tools, tab reads and sheet batches', () => {
  assert.equal(isReadOnly('inspect_page'), true);
  assert.equal(isReadOnly('see_page'), true);
  assert.equal(isReadOnly('wait_for'), true);
  assert.equal(isReadOnly('tabs', { action: 'read_batch' }), true);
  assert.equal(isReadOnly('tabs', { action: 'new' }), false);
  assert.equal(isReadOnly('sheets', { action: 'read' }), true);
  assert.equal(isReadOnly('sheets', { action: 'write' }), false);
  assert.equal(isReadOnly('sheets', { action: 'batch', operations: [{ action: 'read', range: 'A1' }, { action: 'goto', range: 'B2' }] }), true);
  assert.equal(isReadOnly('sheets', { action: 'batch', operations: [{ action: 'read', range: 'A1' }, { action: 'write', range: 'B2' }] }), false);
  assert.equal(isReadOnly('click', {}), false);
  assert.equal(isReadOnly('run_steps', {}), false);
});

test('three read-only turns earn a nudge; any mutation resets the counter', () => {
  const guard = createProgressGuard({ maxSteps: 40 });
  assert.equal(guard.record({ tools: [{ name: 'inspect_page', args: {} }], budgetLeft: 39 }), null);
  assert.equal(guard.record({ tools: [{ name: 'see_page', args: {} }], budgetLeft: 38 }), null);
  const nudge = guard.record({ tools: [{ name: 'inspect_page', args: {} }], budgetLeft: 37 });
  assert.match(nudge, /só leu nas últimas 3 rodadas/);
  assert.equal(guard.record({ tools: [{ name: 'click', args: { index: 2 } }], budgetLeft: 36 }), null, 'ação zera a contagem');
  assert.equal(guard.record({ tools: [{ name: 'inspect_page', args: {} }], budgetLeft: 35 }), null);
});

test('five read-only turns ask to stop inspecting', () => {
  const guard = createProgressGuard({ maxSteps: 40 });
  let note = null;
  for (let i = 0; i < 5; i++) note = guard.record({ tools: [{ name: 'inspect_page', args: {} }], budgetLeft: 30 - i }) || note;
  assert.match(note, /Cinco rodadas sem alterar nada/);
});

test('budget checkpoints fire once each', () => {
  const guard = createProgressGuard({ maxSteps: 40 });
  const half = guard.record({ tools: [{ name: 'click', args: {} }], budgetLeft: 20 });
  assert.match(half, /Restam 20 ações/);
  assert.equal(guard.record({ tools: [{ name: 'click', args: {} }], budgetLeft: 20 }), null, 'não repete o mesmo aviso');
  const five = guard.record({ tools: [{ name: 'click', args: {} }], budgetLeft: 5 });
  assert.match(five, /Restam 5 ações/);
  assert.equal(guard.record({ tools: [{ name: 'click', args: {} }], budgetLeft: 5 }), null);
});

test('a failed read does not count as progress', () => {
  const guard = createProgressGuard({ maxSteps: 40 });
  assert.equal(guard.record({ tools: [{ name: 'click', args: {}, ok: false }], budgetLeft: 30 }), null, 'falha não conta como mutação');
  guard.record({ tools: [{ name: 'click', args: {}, ok: false }], budgetLeft: 29 });
  const note = guard.record({ tools: [{ name: 'click', args: {}, ok: false }], budgetLeft: 28 });
  assert.match(note, /só leu|Cinco rodadas|Aja/, 'sem progresso real, o host avisa');
});

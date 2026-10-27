const test = require('node:test');
const assert = require('node:assert/strict');
const { diffNodes } = require('../src/automation/snapshot-diff');
const { createModelCascade } = require('../src/automation/model-cascade');
const { readStreamedCompletion } = require('../src/automation/stream-parser');
const { runSteps, validateSteps, RUN_STEPS_TOOL } = require('../src/automation/action-script');

const nodes = (n, change = []) => Array.from({ length: n }, (_, i) => ({ role: 'button', name: change.includes(i) ? `novo ${i}` : `b${i}` }));

test('diff devolve só os nodes mudados e as faixas iguais', () => {
  const d = diffNodes(nodes(20), nodes(20, [3, 4, 15]));
  assert.equal(d.iguais, '0-2,5-14,16-19');
  assert.deepEqual(d.nodes.map((n) => n.index), [3, 4, 15]);
  assert.equal(d.total, 20);
});

test('diff cai para snapshot inteiro quando mudou demais ou a lista é pequena', () => {
  assert.equal(diffNodes(nodes(20), nodes(20, [0, 1, 2, 3, 4, 5, 6, 7, 8])), null);
  assert.equal(diffNodes(nodes(5), nodes(5, [1])), null);
  const shifted = nodes(20).slice(1);
  assert.equal(diffNodes(nodes(20), shifted), null);
});

test('cascata sobe para o modelo forte após 2 falhas e volta após 3 acertos', () => {
  const c = createModelCascade({ cheapModel: 'barato', strongModel: 'forte' });
  assert.equal(c.pick(), 'barato');
  c.record({ success: false });
  assert.equal(c.pick(), 'barato');
  c.record({ success: false });
  assert.equal(c.pick(), 'forte');
  c.record({ success: true }); c.record({ success: true });
  assert.equal(c.pick(), 'forte');
  c.record({ success: true });
  assert.equal(c.pick(), 'barato');
  assert.equal(c.stats.escalations, 1);
});

test('cascata sobe de imediato quando há repetição e é neutra sem modelo barato', () => {
  const c = createModelCascade({ cheapModel: 'barato', strongModel: 'forte' });
  c.record({ success: true, repeated: true });
  assert.equal(c.pick(), 'forte');
  const off = createModelCascade({ strongModel: 'forte' });
  assert.equal(off.enabled, false);
  assert.equal(off.pick(), 'forte');
});

function streamOf(events) {
  const text = events.map((e) => `data: ${typeof e === 'string' ? e : JSON.stringify(e)}\n\n`).join('');
  const bytes = new TextEncoder().encode(text);
  // Fatia em pedaços de 17 bytes para exercitar eventos partidos no meio.
  const chunks = [];
  for (let i = 0; i < bytes.length; i += 17) chunks.push(bytes.slice(i, i + 17));
  let n = 0;
  return { getReader: () => ({ read: async () => (n < chunks.length ? { done: false, value: chunks[n++] } : { done: true }) }) };
}

test('leitor de stream remonta mensagem, chamadas de ferramenta e uso', async () => {
  const announced = [];
  const body = streamOf([
    { choices: [{ delta: { content: 'Oi ' } }] },
    { choices: [{ delta: { content: 'mundo' } }] },
    { choices: [{ delta: { tool_calls: [{ index: 0, id: 'a', function: { name: 'click', arguments: '{"ind' } }] } }] },
    { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'ex":2}' } }] } }] },
    { choices: [{ delta: { tool_calls: [{ index: 1, id: 'b', function: { name: 'type_text', arguments: '{"index":3,"text":"x"}' } }] } }] },
    { choices: [{ finish_reason: 'tool_calls', delta: {} }] },
    { usage: { prompt_tokens: 100, completion_tokens: 7 }, choices: [] },
    '[DONE]'
  ]);
  const data = await readStreamedCompletion(body, { onToolCall: (call, i) => announced.push([call.id, i]) });
  const message = data.choices[0].message;
  assert.equal(message.content, 'Oi mundo');
  assert.equal(message.tool_calls.length, 2);
  assert.equal(message.tool_calls[0].function.arguments, '{"index":2}');
  assert.deepEqual(announced, [['a', 0], ['b', 1]]);
  assert.equal(data.usage.prompt_tokens, 100);
  assert.equal(typeof data.firstTokenMs, 'number');
});

test('run_steps executa em ordem, para na primeira falha e respeita o freio do host', async () => {
  const seen = [];
  const ok = async (tool, args) => { seen.push(tool); return { success: true }; };
  const r = await runSteps([{ tool: 'type_text', args: { index: 1, text: 'a' } }, { tool: 'click', args: { index: 2 } }], ok);
  assert.equal(r.success, true);
  assert.equal(r.completed, 2);

  const falha = async (tool) => (tool === 'click' ? { success: false, error: 'sumiu' } : { success: true });
  const f = await runSteps([{ tool: 'type_text', args: {} }, { tool: 'click', args: {} }, { tool: 'click', args: {} }], falha);
  assert.equal(f.success, false);
  assert.equal(f.failedAt, 2);
  assert.equal(f.completed, 1);

  const parar = await runSteps([{ tool: 'click', args: {} }, { tool: 'click', args: {} }], ok, { shouldStop: () => 'aba nova' });
  assert.equal(parar.stoppedEarly, true);
  assert.equal(parar.completed, 1);
});

test('run_steps recusa ferramentas fora da lista e passos demais', () => {
  assert.match(validateSteps([{ tool: 'navigate', args: {} }]), /não permitida/);
  assert.match(validateSteps(Array.from({ length: 13 }, () => ({ tool: 'click', args: {} }))), /No máximo/);
  assert.equal(validateSteps([{ tool: 'click', args: { index: 1 } }]), null);
  assert.equal(RUN_STEPS_TOOL.function.name, 'run_steps');
});

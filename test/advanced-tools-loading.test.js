const test = require('node:test');
const assert = require('node:assert/strict');
const { AutomationService } = require('../src/automation/service');

function advancedToolsCall(id = 'enable-advanced') {
  return {
    role: 'assistant',
    content: null,
    tool_calls: [{ id, type: 'function', function: { name: 'enable_advanced_tools', arguments: '{}' } }]
  };
}

async function runFixture({ advancedInput, replies }) {
  const requests = [];
  const service = new AutomationService({ fetchImpl: async (_url, options) => {
    requests.push(JSON.parse(options.body));
    const message = replies.shift();
    assert.ok(message, 'O motor fez uma chamada inesperada ao modelo');
    return { ok: true, json: async () => ({ choices: [{ message }] }) };
  } });
  service.tabs.set('fixture-tab', {
    state: { url: 'https://example.test/' },
    webContents: { isDestroyed: () => false, getURL: () => 'https://example.test/', executeJavaScript: async () => '' }
  });
  service.detectHumanCheck = async () => ({ detected: false });
  service.getAccessibilityTree = async () => ({ success: true, tree: { url: 'https://example.test/', title: 'Fixture', nodes: [] } });
  const trace = { toolCalls: [], modelCalls: 0, inputTokens: 0, outputTokens: 0, usageAvailable: true };
  const result = await service.runAgent(
    'fixture-tab', 'Resuma esta página em uma frase.', 'fixture-secret', 'fixture-model', true, 'deepseek', false,
    { advancedInput, trace }
  );
  assert.equal(result.success, true);
  return { requests, trace };
}

test('ferramentas avançadas ficam fora do primeiro request comum e entram quando solicitadas', async (t) => {
  const lazy = await runFixture({ advancedInput: 'auto', replies: [advancedToolsCall(), { role: 'assistant', content: 'Resumo concluído.' }] });
  const eager = await runFixture({ advancedInput: true, replies: [{ role: 'assistant', content: 'Resumo concluído.' }] });
  const lazyFirst = lazy.requests[0];
  const eagerFirst = eager.requests[0];
  const lazyFirstNames = lazyFirst.tools.map((tool) => tool.function.name);
  const eagerFirstNames = eagerFirst.tools.map((tool) => tool.function.name);
  const advancedNames = ['clipboard', 'key_sequence', 'visual_click', 'sheets_accessibility', 'sheets'];

  assert.ok(lazyFirstNames.includes('enable_advanced_tools'));
  assert.ok(advancedNames.every((name) => !lazyFirstNames.includes(name)), 'ferramentas avançadas devem ficar fora da chamada inicial comum');
  assert.ok(advancedNames.every((name) => eagerFirstNames.includes(name)), 'modo explícito deve preservar pré-carga');
  assert.ok(lazy.requests[1].tools.some((tool) => tool.function.name === 'sheets'), 'o seletor precisa disponibilizar as definições para a chamada seguinte');
  assert.ok(!lazy.requests[1].tools.some((tool) => tool.function.name === 'enable_advanced_tools'), 'o seletor deixa de ser oferecido depois que as ferramentas são ativadas');
  assert.ok(lazyFirst.tools.length < eagerFirst.tools.length);
  const bytesSaved = eager.trace.requestMetrics[0].toolSchemaBytes - lazy.trace.requestMetrics[0].toolSchemaBytes;
  assert.ok(bytesSaved > 0, 'a chamada inicial deve serializar menos esquema');
  assert.equal(lazy.requests.length, 2, 'a ativação sob demanda acrescenta uma chamada de fixture');
  assert.equal(eager.requests.length, 1, 'a pré-carga explícita não deve acrescentar rodada');
  t.diagnostic(`Esquema do primeiro request: lazy=${lazy.trace.requestMetrics[0].toolSchemaBytes} bytes; pré-carregado=${eager.trace.requestMetrics[0].toolSchemaBytes}; redução=${bytesSaved} bytes (${((bytesSaved / eager.trace.requestMetrics[0].toolSchemaBytes) * 100).toFixed(1)}%). A condição lazy usa uma chamada simulada a mais; bytes não são tokens ou custo faturável.`);
});

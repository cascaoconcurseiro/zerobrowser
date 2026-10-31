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

async function runFixture({ advancedInput, replies, prompt = 'Resuma esta página em uma frase.' }) {
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
    'fixture-tab', prompt, 'fixture-secret', 'fixture-model', true, 'deepseek', false,
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

test('auto pré-carrega ferramentas avançadas quando o pedido já explicita intenção compatível', async () => {
  const prompt = 'Leia o intervalo A1:C5 da planilha e some os valores da coluna C.';
  const result = await runFixture({ advancedInput: 'auto', prompt, replies: [{ role: 'assistant', content: 'Total calculado.' }] });
  const first = result.requests[0];
  const names = first.tools.map((tool) => tool.function.name);
  const advancedNames = ['clipboard', 'key_sequence', 'visual_click', 'sheets_accessibility', 'sheets'];

  assert.ok(advancedNames.every((name) => names.includes(name)), 'a planilha indicada no pedido recebe as ferramentas necessárias no primeiro turno');
  assert.ok(!names.includes('enable_advanced_tools'), 'o caso reconhecido não precisa da rodada do seletor');
  assert.equal(result.requests.length, 1, 'a fixture conclui sem uma chamada extra de ativação');

  const normalized = await runFixture({ advancedInput: 'auto', prompt: 'Revise as células destacadas.', replies: [{ role: 'assistant', content: 'Revisadas.' }] });
  assert.ok(normalized.requests[0].tools.some((tool) => tool.function.name === 'sheets'), 'a classificação remove acentos para reconhecer a intenção em português');

  const forcedOff = await runFixture({ advancedInput: false, prompt, replies: [{ role: 'assistant', content: 'Resumo concluído.' }] });
  assert.ok(!forcedOff.requests[0].tools.some((tool) => tool.function.name === 'sheets'), 'a opção explícita false continua prevalecendo sobre o texto da tarefa');

  const negated = await runFixture({ advancedInput: 'auto', prompt: 'Não use planilha; apenas resuma o texto desta página.', replies: [{ role: 'assistant', content: 'Resumo concluído.' }] });
  assert.ok(!negated.requests[0].tools.some((tool) => tool.function.name === 'sheets'), 'uma instrução explícita para não usar planilha não dispara pré-carga');

  const englishNegated = await runFixture({ advancedInput: 'auto', prompt: "Don't use spreadsheets; summarize the page.", replies: [{ role: 'assistant', content: 'Summary complete.' }] });
  assert.ok(!englishNegated.requests[0].tools.some((tool) => tool.function.name === 'sheets'), 'uma instrução explícita para não usar spreadsheets não dispara pré-carga');

  const allEnglishCuesNegated = await runFixture({ advancedInput: 'auto', prompt: "Don't use clipboard or spreadsheet; summarize the page.", replies: [{ role: 'assistant', content: 'Summary complete.' }] });
  assert.ok(!allEnglishCuesNegated.requests[0].tools.some((tool) => tool.function.name === 'sheets'), 'negações coordenadas não disparam pré-carga');

  const allEnglishCuesNegatedWithAnd = await runFixture({ advancedInput: 'auto', prompt: "Don't use clipboard and spreadsheet; summarize the page.", replies: [{ role: 'assistant', content: 'Summary complete.' }] });
  assert.ok(!allEnglishCuesNegatedWithAnd.requests[0].tools.some((tool) => tool.function.name === 'sheets'), 'a conjunção and mantém cues sob a mesma negação');

  const allPortugueseCuesNegated = await runFixture({ advancedInput: 'auto', prompt: 'Não use área de transferência nem planilha; apenas resuma a página.', replies: [{ role: 'assistant', content: 'Resumo concluído.' }] });
  assert.ok(!allPortugueseCuesNegated.requests[0].tools.some((tool) => tool.function.name === 'sheets'), 'negações coordenadas em português não disparam pré-carga');

  const mixedIntent = await runFixture({ advancedInput: 'auto', prompt: 'Read spreadsheet range A1:C5 without using the clipboard.', replies: [{ role: 'assistant', content: 'Total calculated.' }] });
  assert.ok(mixedIntent.requests[0].tools.some((tool) => tool.function.name === 'sheets'), 'a recusa de clipboard não remove a necessidade positiva de Sheets');

  const english = await runFixture({ advancedInput: 'auto', prompt: 'Read spreadsheet cells A1:C5 and total column C.', replies: [{ role: 'assistant', content: 'Total calculated.' }] });
  assert.ok(english.requests[0].tools.some((tool) => tool.function.name === 'sheets'), 'uma tarefa explícita de spreadsheet em inglês pré-carrega a ferramenta');

  const englishMixedOrder = await runFixture({ advancedInput: 'auto', prompt: "Don't use clipboard; use the spreadsheet range A1:C5.", replies: [{ role: 'assistant', content: 'Total calculated.' }] });
  assert.ok(englishMixedOrder.requests[0].tools.some((tool) => tool.function.name === 'sheets'), 'a negação de clipboard não apaga Sheets quando o cue positivo vem depois');

  const portugueseMixedOrder = await runFixture({ advancedInput: 'auto', prompt: 'Não use a área de transferência; leia o intervalo A1:C5 da planilha.', replies: [{ role: 'assistant', content: 'Total calculado.' }] });
  assert.ok(portugueseMixedOrder.requests[0].tools.some((tool) => tool.function.name === 'sheets'), 'a negação de clipboard não apaga planilha quando o cue positivo vem depois');

  const englishPositiveAnd = await runFixture({ advancedInput: 'auto', prompt: "Don't use clipboard and read the spreadsheet range A1:C5.", replies: [{ role: 'assistant', content: 'Total calculated.' }] });
  assert.ok(englishPositiveAnd.requests[0].tools.some((tool) => tool.function.name === 'sheets'), 'uma ação positiva após and não fica sob a negação anterior');

  const englishPaste = await runFixture({ advancedInput: 'auto', prompt: "Don't use the clipboard API; paste these values into the sheet.", replies: [{ role: 'assistant', content: 'Values pasted.' }] });
  assert.ok(englishPaste.requests[0].tools.some((tool) => tool.function.name === 'sheets'), 'paste explícito é cue positivo de ferramenta avançada');

  const englishCoordinatedPaste = await runFixture({ advancedInput: 'auto', prompt: "Don't use clipboard and paste values into the sheet.", replies: [{ role: 'assistant', content: 'Values pasted.' }] });
  assert.ok(englishCoordinatedPaste.requests[0].tools.some((tool) => tool.function.name === 'sheets'), 'and paste divide a cláusula negativa quando inicia uma ação positiva');
});

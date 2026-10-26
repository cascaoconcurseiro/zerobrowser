const test = require('node:test');
const assert = require('node:assert/strict');
const { AutomationService } = require('../src/automation/service');

function fixture(replies) {
  const requests = [];
  const service = new AutomationService({ fetchImpl: async (_url, options) => {
    requests.push(JSON.parse(options.body));
    const message = replies.shift();
    assert.ok(message, 'O motor fez uma chamada inesperada ao modelo');
    return { ok: true, json: async () => ({ choices: [{ message }] }) };
  } });
  const page = { text: 'Filial A: estoque 81', name: 'Abrir filial B' };
  service.tabs.set('a', { state: { url: 'https://example.test' }, webContents: {
    isDestroyed: () => false, getURL: () => 'https://example.test',
    executeJavaScript: async () => page.text
  } });
  service.detectHumanCheck = async () => ({ detected: false });
  service.getAccessibilityTree = async () => ({ success: true, tree: {
    url: 'https://example.test', title: 'Filiais', nodes: [{ index: 0, role: 'button', name: page.name, rect: { x: 4, y: 8, width: 90, height: 30 } }]
  } });
  const run = (options = {}) => service.runAgent('a', 'Compare filiais e transfira 81 unidades', 'fixture-secret', 'model', true, 'deepseek', false, options);
  return { service, requests, page, run };
}

const inspect = (id) => ({ role: 'assistant', content: null, tool_calls: [{ id, type: 'function', function: { name: 'inspect_page', arguments: '{}' } }] });
const done = { role: 'assistant', content: 'Transferência conferida.' };

test('snapshot compaction removes historical text only when the current snapshot contains it verbatim', async () => {
  const nextInspect = { role: 'assistant', content: null, tool_calls: [{ id: 'second-inspect', type: 'function', function: { name: 'inspect_page', arguments: '{}' } }] };
  const { run, page, requests } = fixture([inspect('first-inspect'), nextInspect, done]);
  page.text = 'Resultado 81. Filial A: estoque 81';
  await run();
  const history = requests[2].messages;
  const prior = JSON.parse(history.find((message) => message.tool_call_id === 'first-inspect').content);
  const latest = JSON.parse(history.find((message) => message.tool_call_id === 'second-inspect').content);
  assert.equal(prior.text, undefined, 'a cópia antiga literal não é reenviada');
  assert.equal(prior.textoRepetidoNoSnapshot, 'second-inspect');
  assert.ok(latest.text.includes('Filial A: estoque 81'), 'o texto continua disponível no snapshot atual');
  assert.ok(JSON.stringify(prior).length < 220, 'o histórico mantém apenas uma referência compacta');

  const uniqueFixture = fixture([inspect('first-inspect'), nextInspect, done]);
  const tab = uniqueFixture.service.tabs.get('a');
  let snapshotCount = 0;
  tab.webContents.executeJavaScript = async () => {
    snapshotCount += 1;
    return snapshotCount === 1 ? 'Dado histórico exclusivo: filial fechada' : 'Outro conteúdo atual';
  };
  await uniqueFixture.run();
  const uniquePrior = JSON.parse(uniqueFixture.requests[2].messages.find((message) => message.tool_call_id === 'first-inspect').content);
  assert.match(uniquePrior.text, /Dado histórico exclusivo/, 'texto que não aparece no estado atual é preservado');
});

test('continuation retains the task, refreshes controls, and consumes its token once', async () => {
  const { service, run, page, requests } = fixture([inspect('first'), done]);
  const paused = await run({ maxSteps: 1, resumable: true });
  assert.equal(paused.paused, true);
  assert.equal(service.agentTabs.size, 0, 'a pausa devolve o controle da aba');
  const saved = service.pausedAgentRuns.get(paused.resumeId);
  assert.equal(JSON.stringify(saved).includes('fixture-secret'), false);
  page.name = 'Confirmar transferência';
  page.text = 'Filial B: estoque 19';
  const result = await run({ resumeId: paused.resumeId, resumable: true });
  assert.equal(result.message, done.content);
  const history = requests[1].messages;
  assert.equal(history[1].content, 'Compare filiais e transfira 81 unidades');
  assert.ok(history.some((m) => m.content?.includes?.('Filial A: estoque 81')));
  const fresh = JSON.parse(history.at(-1).content);
  assert.equal(fresh.nodes[0].name, 'Confirmar transferência');
  assert.deepEqual(fresh.nodes[0].rect, { x: 4, y: 8, width: 90, height: 30 });
  assert.equal(JSON.parse(history.find((m) => m.tool_call_id === 'first').content).nodes, undefined);
  assert.equal(service.pausedAgentRuns.size, 0);
  assert.equal((await run({ resumeId: paused.resumeId })).success, false);
  assert.equal(requests.length, 2);
});

test('continuation expires, is removed on closing the tab, and cannot switch models', async () => {
  const { service, run } = fixture([inspect('first'), inspect('second')]);
  const paused = await run({ maxSteps: 1, resumable: true });
  const wrongModel = await service.runAgent('a', '', 'fixture-secret', 'other', true, 'deepseek', false, { resumeId: paused.resumeId });
  assert.equal(wrongModel.success, false);
  assert.equal(service.pausedAgentRuns.has(paused.resumeId), true);
  service.pausedAgentRuns.get(paused.resumeId).expiresAt = 0;
  assert.equal((await run({ resumeId: paused.resumeId })).success, false);
  const again = await run({ maxSteps: 1, resumable: true });
  service.unregisterTab('a');
  assert.equal(service.pausedAgentRuns.size, 0);
  assert.equal((await run({ resumeId: again.resumeId })).success, false);
});

test('a resumed task still requests approval and stops after refusal', async () => {
  const { service, run, requests } = fixture([inspect('first'), done]);
  const paused = await run({ maxSteps: 1, resumable: true });
  service.setSettingsProvider(() => ({ automationApprovalMode: 'always-ask' }));
  let approvals = 0;
  service.setApprovalHandler(async () => { approvals++; return false; });
  const result = await run({ resumeId: paused.resumeId, resumable: true });
  assert.equal(result.success, false);
  assert.equal(approvals, 1);
  assert.equal(requests.length, 1, 'a recusa acontece antes de chamar o modelo novamente');
  assert.equal(service.pausedAgentRuns.size, 0);
});

test('temporary provider errors leave the latest task checkpoint available to retry', async () => {
  const { service, run, requests } = fixture([inspect('first'), done]);
  const paused = await run({ maxSteps: 1, resumable: true });
  let failOnce = true;
  service.setFetchImplementation(async (_url, options) => {
    requests.push(JSON.parse(options.body));
    if (failOnce) {
      failOnce = false;
      throw new Error('Temporary provider failure');
    }
    return { ok: true, json: async () => ({ choices: [{ message: done }] }) };
  });
  const failed = await run({ resumeId: paused.resumeId, resumable: true });
  assert.equal(failed.success, false);
  assert.equal(service.pausedAgentRuns.has(paused.resumeId), true);
  const retried = await run({ resumeId: paused.resumeId, resumable: true });
  assert.equal(retried.message, done.content);
  assert.equal(service.pausedAgentRuns.has(paused.resumeId), false);
  assert.equal(requests.length, 3);
});

test('benchmark tasks do not retain a resumable session and active tabs reject competing runs', async () => {
  const { service, run } = fixture([inspect('first')]);
  const result = await run({ maxSteps: 1 });
  assert.equal(result.paused, undefined);
  assert.equal(service.pausedAgentRuns.size, 0);
  service.agentTabs.add('a');
  assert.equal((await run()).success, false);
});

test('one task can revisit its own tabs while another task retains exclusive ownership', async () => {
  const action = (id, tabId, operation = 'switch') => ({ role: 'assistant', tool_calls: [{ id, type: 'function', function: { name: 'tabs', arguments: JSON.stringify({ action: operation, tabId }) } }] });
  const { service, requests, run } = fixture([
    { role: 'assistant', tool_calls: [{ id: 'new', type: 'function', function: { name: 'tabs', arguments: JSON.stringify({ action: 'new', url: 'https://example.test/b' }) } }] },
    action('back', 'a'), action('return', 'b'), action('foreign', 'other'), action('close-foreign', 'other', 'close'), done
  ]);
  service.tabs.set('other', service.tabs.get('a'));
  service.agentTabs.add('other');
  service.setBrowserControls({ createTab: async (url) => {
    assert.equal(url, 'about:blank');
    service.tabs.set('b', { webContents: {
      isDestroyed: () => false, loadURL: async () => {}, getURL: () => 'https://example.test/b',
      executeJavaScript: async () => 'Filial B'
    } });
    return { tabId: 'b' };
  } });
  await run();
  for (const id of ['new', 'back', 'return']) {
    const output = requests.flatMap((r) => r.messages).find((m) => m.tool_call_id === id);
    assert.equal(JSON.parse(output.content).success, true, id);
  }
  const rejected = requests.flatMap((r) => r.messages).find((m) => m.tool_call_id === 'foreign');
  assert.match(JSON.parse(rejected.content).error, /Outra tarefa/);
  const closeRejected = requests.flatMap((r) => r.messages).find((m) => m.tool_call_id === 'close-foreign');
  assert.match(JSON.parse(closeRejected.content).error, /Outra tarefa/);
  assert.equal(service.tabs.has('other'), true, 'a aba de outra execução continua aberta');
  assert.deepEqual([...service.agentTabs], ['other']);
});

test('optional observation returns the fresh page after the last action of a batch', async () => {
  const clicks = { role: 'assistant', tool_calls: ['left', 'right'].map((id) => ({ id, type: 'function', function: { name: 'click', arguments: '{"index":0}' } })) };
  const { service, requests, page, run } = fixture([inspect('first'), clicks, done]);
  let actions = 0;
  let reads = 0;
  const getTree = service.getAccessibilityTree.bind(service);
  service.getAccessibilityTree = async (...args) => { reads++; return getTree(...args); };
  service.executeAXAction = async () => { actions++; page.text = `Resultado salvo ${actions}`; return { success: true }; };
  const trace = { toolCalls: [], modelCalls: 0, inputTokens: 0, outputTokens: 0 };
  await run({ observeAfterActions: true, trace });
  assert.equal(actions, 2);
  assert.equal(reads, 2, 'uma leitura inicial e uma depois de todas as ações');
  const first = requests[2].messages.find((m) => m.tool_call_id === 'left');
  const last = requests[2].messages.find((m) => m.tool_call_id === 'right');
  assert.equal(JSON.parse(first.content).autoObserved, undefined);
  assert.equal(JSON.parse(last.content).autoObserved, true);
  assert.equal(JSON.parse(last.content).text, 'Resultado salvo 2');
  assert.equal(trace.modelCalls, 3, 'o modelo recebe o resultado sem uma rodada só para pedir inspect');
  assert.equal(trace.autoObservations, 1);
});

test('a failed automatic reading keeps action evidence; explicit refusal stops the task', async () => {
  const click = { role: 'assistant', tool_calls: [{ id: 'click', type: 'function', function: { name: 'click', arguments: '{"index":0}' } }] };
  for (const cancelled of [false, true]) {
    const { service, requests, run } = fixture([inspect('first'), click, done]);
    service.executeAXAction = async () => ({ success: true });
    let reads = 0;
    service.confirmConsequentialAction = async () => ++reads === 1 ? { approved: true } : { approved: false, cancelled, error: 'Leitura indisponível' };
    const result = await run({ observeAfterActions: true });
    if (cancelled) {
      assert.equal(result.cancelled, true);
      assert.equal(requests.length, 2);
    } else {
      const output = JSON.parse(requests[2].messages.at(-1).content);
      assert.equal(output.success, true, 'a ação foi executada mesmo que a leitura tenha falhado');
      assert.equal(output.observationError, 'Leitura indisponível');
    }
  }
});

test('waiting for a download that never started returns without an empty twenty-second wait', async () => {
  const { service, requests, run } = fixture([
    { role: 'assistant', tool_calls: [{ id: 'wait', type: 'function', function: { name: 'downloads', arguments: '{"action":"wait"}' } }] }, done
  ]);
  service.setBrowserControls({ listDownloads: () => [] });
  const start = Date.now();
  await run();
  const output = JSON.parse(requests[1].messages.at(-1).content);
  assert.equal(output.success, false);
  assert.match(output.error, /Nenhum download começou/);
  assert.ok(Date.now() - start < 1000, 'a ausência de download já é conhecida');
});

test('explicit startTimeoutMs preserves waiting for files generated asynchronously', async () => {
  const { service, requests, run } = fixture([
    { role: 'assistant', tool_calls: [{ id: 'wait', type: 'function', function: { name: 'downloads', arguments: '{"action":"wait","startTimeoutMs":1000}' } }] }, done
  ]);
  const started = Date.now();
  service.setBrowserControls({ listDownloads: () => Date.now() - started < 50 ? [] : [{ id: 'async-file', state: 'completed', filename: 'export.csv', startedAt: Date.now() }] });
  await run();
  const output = JSON.parse(requests[1].messages.at(-1).content);
  assert.equal(output.success, true);
  assert.equal(output.id, 'async-file');
});

test('navigation invalidates indices even when the next page repeats the same control label', async () => {
  const { service, requests, run } = fixture([inspect('first'),
    { role: 'assistant', tool_calls: [{ id: 'stale', type: 'function', function: { name: 'click', arguments: '{"index":0}' } }] }, done]);
  let url = 'https://example.test';
  let actions = 0;
  const wc = service.tabs.get('a').webContents;
  wc.getURL = () => url;
  service.executeAXAction = async () => { actions++; return { success: true }; };
  const originalFetch = service.fetchImpl;
  service.setFetchImplementation(async (...args) => {
    if (requests.length === 1) url = 'https://example.test/other-account';
    return originalFetch(...args);
  });
  await run();
  assert.equal(actions, 0);
  const output = JSON.parse(requests[2].messages.at(-1).content);
  assert.equal(output.success, false);
  assert.match(output.error, /navegação mudou/);
});

test('same-URL reloads invalidate the prior snapshot before index based actions', async () => {
  const { EventEmitter } = require('node:events');
  const { service, requests, run } = fixture([inspect('first'),
    { role: 'assistant', tool_calls: [{ id: 'stale', type: 'function', function: { name: 'click', arguments: '{"index":0}' } }] }, done]);
  const wc = service.tabs.get('a').webContents;
  const events = new EventEmitter();
  wc.on = events.on.bind(events);
  wc.removeListener = events.removeListener.bind(events);
  wc.getURL = () => 'https://example.test/account';
  const getTree = service.getAccessibilityTree.bind(service);
  service.getAccessibilityTree = async (...args) => {
    const snapshot = await getTree(...args);
    return { ...snapshot, tree: { ...snapshot.tree, url: wc.getURL() } };
  };
  let actions = 0;
  service.executeAXAction = async () => { actions++; return { success: true }; };
  const originalFetch = service.fetchImpl;
  service.setFetchImplementation(async (...args) => {
    if (requests.length === 1) events.emit('did-start-navigation', {}, 'https://example.test/account', false, true);
    return originalFetch(...args);
  });
  await run();
  assert.equal(actions, 0);
  const output = JSON.parse(requests[2].messages.at(-1).content);
  assert.equal(output.success, false);
  assert.match(output.error, /snapshot da página ficou desatualizado/i);
});

test('deepseek thinking mode preserves and passes back reasoning_content in multi-turn requests', async () => {
  const reasoningMsg = {
    role: 'assistant',
    content: null,
    reasoning_content: 'Analisando a estrutura da página...',
    tool_calls: [{ id: 'call-reasoning', type: 'function', function: { name: 'inspect_page', arguments: '{}' } }]
  };
  const finalMsg = { role: 'assistant', content: 'Tarefa concluída com raciocínio preservado.' };
  const { run, requests } = fixture([reasoningMsg, finalMsg]);
  await run();

  assert.equal(requests.length, 2, 'executou as duas rodadas do modelo');
  const secondTurnMessages = requests[1].messages;
  const assistantInTurn2 = secondTurnMessages.find((m) => m.role === 'assistant');
  assert.ok(assistantInTurn2, 'mensagem do assistente está presente na rodada 2');
  assert.equal(assistantInTurn2.reasoning_content, 'Analisando a estrutura da página...', 'reasoning_content foi preservado e reenviado');
});

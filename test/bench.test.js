const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { tarefas } = require('../bench/tarefas');
const { tarefasReais } = require('../bench/tarefas-reais');
const { iniciarServidor } = require('../bench/servidor');
const { resumir, relatorioMarkdown, lerTextoVisivelEFecharAba } = require('../bench/avaliar');

test('public JavaScript ecommerce verifier requires the observed cart state, not the model answer', () => {
  const task = tarefasReais.find((entry) => entry.id === 'r09-js-carrinho-demo');
  assert.ok(task);
  assert.equal(task.verificar({}, { mensagem: 'Wireless Keyboard x2; Total $99.98', pageTextRead: false }).aprovado, false);
  const success = { initialPageRead: true, initialStateVerified: true, pageTextRead: true, pageCleanupVerified: true, pageText: 'Cart: 2 Wireless Keyboard x2 Total: $99.98' };
  assert.equal(task.verificar({}, success).aprovado, true);
  assert.equal(task.verificar({}, { ...success, initialStateVerified: false }).aprovado, false);
  assert.equal(task.verificar({}, { ...success, pageCleanupVerified: false }).aprovado, false);
  assert.equal(task.verificar({}, { pageTextRead: true, pageText: 'Cart: 1 Wireless Keyboard x1 Total: $49.99' }).aprovado, false);
  assert.equal(task.hosts.includes('demo.testautomationtv.com'), true);
  assert.equal(task.verificarPagina, true);
});

test('public React TodoMVC verifier requires an empty precondition, mixed completion state and verified cleanup', () => {
  const task = tarefasReais.find((entry) => entry.id === 'r10-react-todomvc');
  assert.ok(task);
  const initial = 'This is just a demo of TodoMVC for testing, not the real TodoMVC app. todos Double-click to edit a todo Created by Remo H. Jansen Part of TodoMVC';
  const page = `${initial} NAVEGANTE-TESTE-A-20261026 NAVEGANTE-TESTE-B-20261026 1 item left Clear completed`;
  assert.equal(task.verificarEstadoInicial(initial), true);
  assert.equal(task.verificarEstadoInicial(`${initial} Existing user todo`), false);
  const success = { initialPageRead: true, initialStateVerified: true, pageTextRead: true, pageCleanupVerified: true, pageText: page };
  assert.equal(task.verificar({}, success).aprovado, true);
  assert.equal(task.verificar({}, { ...success, initialStateVerified: false }).aprovado, false);
  assert.equal(task.verificar({}, { ...success, pageText: `${initial} NAVEGANTE-TESTE-A-20261026 NAVEGANTE-TESTE-B-20261026 2 items left` }).aprovado, false);
  assert.equal(task.limpezaAposVerificacao.quando(page, initial), true);
  assert.equal(task.limpezaAposVerificacao.quando(page, `${initial} Existing user todo`), false);
  assert.deepEqual(task.limpezaAposVerificacao.acoes, [1, 2].flatMap(() => [
    { strategy: 'css', query: 'ul.todo-list > li:first-child', action: 'hover' },
    { strategy: 'css', query: 'ul.todo-list > li:first-child button.destroy', action: 'click' }
  ]));
});

test('public dynamic table verifier requires preflight, a filtered single row and restored original page', () => {
  const task = tarefasReais.find((entry) => entry.id === 'r11-tabela-paginada-js');
  assert.ok(task);
  const initial = 'Showing 1 to 3 of 10 entries Alice Johnson Female Sophomore Texas Mathematics Debate Team Bob Williams Male Freshman Florida Physics Soccer Daniel Martinez Male Freshman Nevada Political Science Football';
  const filtered = 'Search: Alice Johnson Student Name Gender Class Level Home State Major Extracurricular Activity Alice Johnson Female Sophomore Texas Mathematics Debate Team Showing 1 to 1 of 1 entries';
  const restored = `${initial} Showing 1 to 3 of 10 entries`;
  assert.equal(task.verificarEstadoInicial(initial), true);
  assert.equal(task.verificarEstadoInicial(initial.replace('Bob Williams', 'Other Student')), false);
  assert.equal(task.limpezaAposVerificacao.quando(filtered, initial), true);
  assert.equal(task.limpezaAposVerificacao.quando(`${filtered} Bob Williams`, initial), false);
  assert.equal(task.limpezaAposVerificacao.verificar(restored), true);
  const success = { initialPageRead: true, initialStateVerified: true, pageTextRead: true, pageCleanupVerified: true, pageText: filtered, cleanupPageText: restored, mensagem: 'Alice Johnson studies Mathematics.' };
  assert.equal(task.verificar({}, success).aprovado, true);
  assert.equal(task.verificar({}, { ...success, pageCleanupVerified: false }).aprovado, false);
  assert.equal(task.verificar({}, { ...success, initialStateVerified: false }).aprovado, false);
  assert.equal(task.verificar({}, { ...success, pageText: restored }).aprovado, false, 'must prove the filtered row before the harness restores the table');
  assert.equal(task.hosts.includes('practice.expandtesting.com'), true);
});

test('public dynamic control verifier checks enabled state before and after asynchronous reversible cleanup', () => {
  const task = tarefasReais.find((entry) => entry.id === 'r12-controle-assincrono-js');
  assert.ok(task);
  const initial = 'Dynamic Controls Enable/disable Enable';
  const initialChecks = [{ success: true, value: false }];
  const enabled = "Enable/disable It's enabled! Disable";
  const disabled = "Enable/disable It's disabled! Enable";
  const beforeChecks = [{ success: true, esperado: true, atual: true }];
  const afterChecks = [{ success: true, esperado: false, atual: false }];
  assert.equal(task.verificarEstadoInicial(initial, initialChecks), true);
  assert.equal(task.verificarEstadoInicial(initial, [{ success: true, value: true }]), false);
  assert.equal(task.limpezaAposVerificacao.quando(enabled), true);
  assert.equal(task.limpezaAposVerificacao.esperarDepois(disabled), true);
  const success = { initialPageRead: true, initialStateVerified: true, initialLocatorChecks: initialChecks, pageTextRead: true, pageText: enabled, cleanupPageText: disabled, cleanupBeforeChecks: beforeChecks, cleanupAfterChecks: afterChecks, pageCleanupVerified: true };
  assert.equal(task.verificar({}, success).aprovado, true);
  assert.equal(task.verificar({}, { ...success, cleanupBeforeChecks: [{ success: false, atual: false }] }).aprovado, false);
  assert.equal(task.verificar({}, { ...success, cleanupAfterChecks: [{ success: true, atual: true }] }).aprovado, false);
  assert.equal(task.captureInitialChecks[0].esperado, false);
});

test('independent page verification reads visible text then closes the retained tab even when reading fails', async () => {
  const calls = [];
  const mcp = {
    chamar: async (_method, params) => {
      calls.push(params);
      return params.name === 'browser_get_text'
        ? { structuredContent: { success: true, text: 'Cart: 2' } }
        : { structuredContent: { success: true } };
    }
  };
  const result = await lerTextoVisivelEFecharAba(mcp, 'tab-public-demo');
  assert.deepEqual(result, { pageText: 'Cart: 2', cleanupPageText: '', readError: '', closeError: '', cleanupAttempted: false, cleanupVerified: false, cleanupError: '', cleanupBeforeChecks: [], cleanupAfterChecks: [] });
  assert.deepEqual(calls.map((call) => call.name), ['browser_get_text', 'browser_close_tab']);
  assert.equal(calls[0].arguments.tabId, 'tab-public-demo');
  assert.equal(calls[1].arguments.tabId, 'tab-public-demo');

  const failedReadCalls = [];
  const failedRead = await lerTextoVisivelEFecharAba({
    chamar: async (_method, params) => {
      failedReadCalls.push(params.name);
      return params.name === 'browser_get_text'
        ? { isError: true, structuredContent: { success: false, error: 'read denied' } }
        : { structuredContent: { success: true } };
    }
  }, 'tab-denied');
  assert.equal(failedRead.readError, 'read denied');
  assert.deepEqual(failedReadCalls, ['browser_get_text', 'browser_close_tab']);

  const cleanupCalls = [];
  const cleanupActionArgs = [];
  const cleanup = await lerTextoVisivelEFecharAba({
    chamar: async (_method, params) => {
      cleanupCalls.push(params.name);
      if (params.name === 'browser_locator_action') cleanupActionArgs.push(params.arguments);
      if (params.name === 'browser_get_text') {
        return { structuredContent: { success: true, text: cleanupCalls.filter((name) => name === 'browser_get_text').length === 1
          ? 'Cart: 2 Wireless Keyboard x2 Total: $99.98'
          : 'Cart: 0 Your cart is empty.' } };
      }
      return { structuredContent: { success: true } };
    }
  }, 'tab-cleanup', {
    quando: (page, initial) => /Cart:\s*0/i.test(initial) && /Cart:\s*2/i.test(page),
    acoes: [{ strategy: 'css', query: '#remove', action: 'click' }],
    verificar: (page) => /Cart:\s*0/i.test(page) && /Your cart is empty\./i.test(page)
  }, 'Cart: 0');
  assert.equal(cleanup.cleanupAttempted, true);
  assert.equal(cleanup.cleanupVerified, true);
  assert.equal(cleanup.cleanupPageText, 'Cart: 0 Your cart is empty.');
  assert.deepEqual(cleanupCalls, ['browser_get_text', 'browser_locator_action', 'browser_get_text', 'browser_close_tab']);
  assert.deepEqual(cleanupActionArgs, [{ tabId: 'tab-cleanup', strategy: 'css', query: '#remove', action: 'click' }]);
});

test('public page cleanup verifies locator state before acting and waits for asynchronous reset', async () => {
  const calls = [];
  let textReads = 0;
  const cleanup = await lerTextoVisivelEFecharAba({
    chamar: async (_method, params) => {
      calls.push(params);
      if (params.name === 'browser_get_text') {
        textReads++;
        return { structuredContent: { success: true, text: textReads === 1 ? "It's enabled! Disable" : textReads < 4 ? 'Disable Wait for it...' : "It's disabled! Enable" } };
      }
      if (params.name === 'browser_locator_action' && params.arguments.action === 'isEnabled') {
        const isBeforeCheck = calls.filter((call) => call.name === 'browser_locator_action' && call.arguments.action === 'isEnabled').length === 1;
        return { structuredContent: { success: true, value: isBeforeCheck } };
      }
      return { structuredContent: { success: true } };
    }
  }, 'tab-dynamic', {
    quando: (page) => /It's enabled!/i.test(page) && /Disable/i.test(page),
    validarAntes: [{ strategy: 'css', query: '#field', action: 'isEnabled', esperado: true }],
    acoes: [{ strategy: 'role', query: 'button', name: 'Disable', exact: true, action: 'click' }],
    timeoutDepoisMs: 2000,
    esperarDepois: (page) => /It's disabled!/i.test(page),
    validarDepois: [{ strategy: 'css', query: '#field', action: 'isEnabled', esperado: false }],
    verificar: (page) => /It's disabled!/i.test(page) && /Enable/i.test(page)
  });
  assert.equal(cleanup.cleanupAttempted, true);
  assert.equal(cleanup.cleanupVerified, true);
  assert.equal(cleanup.cleanupPageText, "It's disabled! Enable");
  assert.deepEqual(cleanup.cleanupBeforeChecks, [{ success: true, esperado: true, atual: true, error: '' }]);
  assert.deepEqual(cleanup.cleanupAfterChecks, [{ success: true, esperado: false, atual: false, error: '' }]);
  assert.ok(textReads >= 4, 'the harness should wait for the asynchronous reset message');
  assert.equal(calls.at(-1).name, 'browser_close_tab');
});

test('the benchmark has 21 tasks, each with its page, and every verifier accepts the answer key and rejects an empty run', () => {
  assert.equal(tarefas.length, 21);
  assert.equal(new Set(tarefas.map((t) => t.id)).size, 21, 'ids únicos');
  for (const tarefa of tarefas) {
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'bench', 'paginas', `${tarefa.id}.html`)), `página de ${tarefa.id}`);
    const certo = tarefa.verificar(tarefa.gabarito.estado, { mensagem: tarefa.gabarito.mensagem || '', parada: tarefa.gabarito.parada || '' });
    assert.equal(certo.aprovado, true, `${tarefa.id} aprova o gabarito: ${certo.motivo}`);
    const vazio = tarefa.verificar({}, { mensagem: '' });
    // A tarefa do cartão passa quando nada é feito: o certo é não preencher.
    if (tarefa.id !== '11-campo-cartao') assert.equal(vazio.aprovado, false, `${tarefa.id} reprova execução vazia`);
  }
});

test('the fixture server serves task pages and keeps per-task state only on loopback', async () => {
  const servidor = await iniciarServidor();
  try {
    assert.match(servidor.base, /^http:\/\/127\.0\.0\.1:\d+$/);
    const pagina = await fetch(servidor.urlDa('01-botao-confirmar'));
    assert.equal(pagina.status, 200);
    assert.match(await pagina.text(), /data-tarefa="01-botao-confirmar"/);
    assert.equal((await fetch(`${servidor.base}/t/inexistente`)).status, 404);
    assert.equal((await fetch(`${servidor.base}/../package.json`)).status, 404);

    const api = `${servidor.base}/api/estado/01-botao-confirmar`;
    await fetch(api, { method: 'POST', body: JSON.stringify({ presenca: 'confirmada' }) });
    await fetch(api, { method: 'POST', body: JSON.stringify({ extra: 1 }) });
    assert.deepEqual(await (await fetch(api)).json(), { presenca: 'confirmada', extra: 1 });
    assert.deepEqual(servidor.estadoDe('01-botao-confirmar'), { presenca: 'confirmada', extra: 1 });
    assert.equal((await fetch(api, { method: 'POST', body: '[1]' })).status, 400);
    await fetch(api, { method: 'DELETE' });
    assert.deepEqual(servidor.estadoDe('01-botao-confirmar'), {});
  } finally {
    await servidor.fechar();
  }
});

test('the benchmark report counts success rate per category', () => {
  const execucoes = [
    { id: 'a', categoria: 'clique', aprovado: true, motivo: 'ok', parada: 'final_answer', passos: 3, ms: 2000, tokensDisponiveis: true, tokensEntrada: 100, tokensSaida: 10, trace: { requestMetrics: [{ attempt: 1, success: true, durationMs: 30 }, { attempt: 2, success: true, durationMs: 100 }, { attempt: 1, success: false, durationMs: 60 }] } },
    { id: 'b', categoria: 'clique', aprovado: false, motivo: 'nada', parada: 'max_steps', passos: 5, ms: 4000, tokensDisponiveis: false, tokensEntrada: 0, tokensSaida: 0 }
  ];
  const resumo = resumir(execucoes);
  assert.equal(resumo.aprovadas, 1);
  assert.deepEqual(resumo.porCategoria, { clique: { total: 2, aprovadas: 1 } });
  assert.equal(resumo.mediaPassos, 4);
  assert.equal(resumo.chamadasModelo, 2);
  assert.equal(resumo.tentativasRepetidas, 1);
  assert.equal(resumo.latenciaP50Ms, 30);
  assert.equal(resumo.latenciaP90Ms, 100);
  assert.equal(resumo.latenciaTentativaP50Ms, 60);
  assert.equal(resumo.latenciaTentativaP90Ms, 100);
  assert.equal(resumo.tokensParciais, true);
  const md = relatorioMarkdown({ rotulo: 'teste', inicio: 'agora', maxPassos: 20, modelo: 'm', provedor: 'p', resumo, execucoes });
  assert.match(md, /Taxa de sucesso: 50%/);
  assert.match(md, /Latência aceita p50\/p90: 30\/100 ms/);
  assert.match(md, /Tentativas totais p50\/p90: 60\/100 ms/);
  assert.match(md, /\| b \| falhou \| nada \| max_steps \|/);
});

function servicoComAbaLocal(url = 'http://127.0.0.1:5000/t/x') {
  const { AutomationService } = require('../src/automation/service');
  const service = new AutomationService();
  let dispatched = 0;
  let currentUrl = url;
  service.setApprovalHandler(async () => { throw new Error('a tarefa não deve abrir diálogo'); });
  service.tabs.set('tab-bench', {
    state: { url },
    webContents: { isDestroyed: () => false, isLoading: () => false, getURL: () => currentUrl, executeJavaScript: async () => { dispatched++; return { success: true }; } }
  });
  return { service, dispatched: () => dispatched, setUrl: (nextUrl) => { currentUrl = nextUrl; } };
}

test('run_task records a fixture page only after an action triggers a successful automatic observation', async () => {
  const { service, setUrl } = servicoComAbaLocal('http://127.0.0.1:5000/t/44-estoque-filiais');
  const branchUrl = 'http://127.0.0.1:5000/t/44-estoque-filiais?f=centro';
  service.setBrowserControls({ createTab: async () => ({ tabId: 'tab-bench' }), closeTab: async () => {} });
  service.setAgentConfigProvider(async () => ({ provider: 'openrouter', model: 'test-model', apiKey: 'test-key' }));
  service.getAccessibilityTree = async () => ({ success: true, tree: {
    url: service.tabs.get('tab-bench').webContents.getURL(),
    nodes: [{ index: 0, role: 'link', tag: 'a', name: 'Filial Centro', targetId: 'branch-centro' }]
  } });
  service.executeAXAction = async () => {
    setUrl(branchUrl);
    return { success: true, actionExecuted: true };
  };
  const originalFetch = global.fetch;
  let call = 0;
  global.fetch = async () => {
    call++;
    const message = call === 1
      ? { role: 'assistant', tool_calls: [{ id: 'inspect-index', type: 'function', function: { name: 'inspect_page', arguments: '{}' } }] }
      : call === 2
        ? { role: 'assistant', tool_calls: [{ id: 'open-centro', type: 'function', function: { name: 'click', arguments: '{"index":0,"targetId":"branch-centro"}' } }] }
        : { role: 'assistant', content: 'Centro: 14.' };
    return { ok: true, json: async () => ({ choices: [{ message }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) };
  };
  try {
    const result = await service.runTask({ startUrl: 'http://127.0.0.1:5000/t/44-estoque-filiais', prompt: 'Leia a filial Centro', approvalPolicy: 'local-fixture', captureReadEvidence: true });
    assert.equal(result.success, true);
    assert.deepEqual(result.trace.pageReads, ['centro'], 'auto-observed navigation counts as a read');
  } finally { global.fetch = originalFetch; }
});

test('the local-fixture task policy approves consequential local clicks without a dialog but never sensitive fields or outside navigation', async () => {
  const { service } = servicoComAbaLocal();
  service.taskApprovalPolicies.set('tab-bench', 'local-fixture');
  service.getAccessibilityTree = async () => ({ success: true, tree: { nodes: [
    { index: 0, role: 'button', tag: 'button', name: 'Excluir', isSubmitControl: true },
    { index: 1, role: 'textbox', tag: 'input', name: 'Número do cartão', sensitiveInput: true }
  ] } });

  assert.equal((await service.confirmConsequentialAction('tab-bench', { kind: 'click', elementIndex: 0 })).approved, true);
  const cartao = await service.confirmConsequentialAction('tab-bench', { kind: 'type_text', elementIndex: 1, text: '4111' });
  assert.equal(cartao.approved, false);
  assert.match(cartao.error, /pagamento/);
  const fora = await service.confirmConsequentialAction('tab-bench', { kind: 'navigate', url: 'https://example.com/' });
  assert.equal(fora.approved, false);
  assert.equal((await service.confirmConsequentialAction('tab-bench', { kind: 'navigate', url: 'http://127.0.0.1:5000/t/y' })).approved, true);

  service.taskApprovalPolicies.set('tab-bench', 'deny');
  assert.equal((await service.confirmConsequentialAction('tab-bench', { kind: 'click', elementIndex: 0 })).approved, false);
});

test('run_task opens a tab, runs the agent with a trace, keeps typed text out of it and closes the tab', async () => {
  const { service } = servicoComAbaLocal();
  const fechadas = [];
  service.setBrowserControls({
    createTab: async () => ({ tabId: 'tab-bench' }),
    closeTab: async (tabId) => { fechadas.push(tabId); }
  });
  service.setAgentConfigProvider(async () => ({ provider: 'openrouter', model: 'test-model', apiKey: 'test-key' }));
  service.getAccessibilityTree = async () => ({ success: true, tree: { url: 'http://127.0.0.1:5000/t/x', nodes: [{ index: 0, role: 'textbox', tag: 'input', name: 'Nome' }] } });
  service.executeAXAction = async () => ({ success: true, actionExecuted: true, outcomeVerified: false, error: 'valor não permaneceu' });
  service.executeLocatorAction = async (_tabId, check) => ({ success: true, value: check.action === 'isEnabled' ? false : true });
  const originalFetch = global.fetch;
  let call = 0;
  global.fetch = async () => {
    call++;
    const message = call === 1
      ? { role: 'assistant', tool_calls: [{ id: 't1', type: 'function', function: { name: 'inspect_page', arguments: '{}' } }] }
      : call === 2
        ? { role: 'assistant', tool_calls: [{ id: 't2', type: 'function', function: { name: 'type_text', arguments: '{"index":0,"text":"segredo"}' } }] }
      : { role: 'assistant', content: 'Feito.' };
    return { ok: true, json: async () => ({ choices: [{ message }], usage: { prompt_tokens: 50, completion_tokens: 5 } }) };
  };
  try {
    const result = await service.runTask({ startUrl: 'http://127.0.0.1:5000/t/x', prompt: 'Preencha o nome', approvalPolicy: 'local-fixture', captureInitialChecks: [{ strategy: 'css', query: '#field', action: 'isEnabled' }] });
    assert.equal(result.success, true);
    assert.equal(result.message, 'Feito.');
    assert.equal(result.trace.stopReason, 'final_answer');
    assert.equal(result.trace.modelCalls, 3);
    assert.equal(result.trace.inputTokens, 150);
    assert.equal(result.trace.requestMetrics.length, 3);
    assert.ok(result.trace.requestMetrics.every((metric) => Number.isFinite(metric.durationMs) && metric.success === true));
    assert.ok(result.trace.requestMetrics.every((metric) => metric.attempt === 1));
    assert.deepEqual(result.initialLocatorChecks, [{ strategy: 'css', query: '#field', action: 'isEnabled', success: true, value: false, error: '' }]);
    assert.ok(result.trace.requestMetrics.every((metric) => metric.requestBytes >= metric.messageBytes && metric.toolSchemaBytes > 0));
    assert.equal(result.trace.requestMetrics[0].toolSchemaBytes, result.trace.requestMetrics[1].toolSchemaBytes);
    assert.doesNotMatch(JSON.stringify(result.trace.requestMetrics), /segredo/, 'request metrics must retain byte counts only');
    assert.equal(result.trace.toolCalls.length, 2);
    assert.deepEqual({ success: result.trace.toolCalls[1].success, actionExecuted: result.trace.toolCalls[1].actionExecuted, outcomeVerified: result.trace.toolCalls[1].outcomeVerified }, { success: false, actionExecuted: true, outcomeVerified: false });
    assert.doesNotMatch(JSON.stringify(result.trace), /segredo/);
    assert.deepEqual(fechadas, ['tab-bench']);
    assert.equal(service.taskApprovalPolicies.has('tab-bench'), false, 'a política termina com a tarefa');
  } finally {
    global.fetch = originalFetch;
  }

  const externa = await service.runTask({ startUrl: 'https://example.com/', prompt: 'x', approvalPolicy: 'local-fixture' });
  assert.equal(externa.success, false);
});

test('run_task read_batch returns bounded matching text only from tabs owned by the task and same origin', async () => {
  const startUrl = 'http://127.0.0.1:5000/t/44-estoque-filiais?f=centro';
  const { service } = servicoComAbaLocal(startUrl);
  service.tabs.get('tab-bench').webContents.executeJavaScript = async (script) => vm.runInNewContext(script, { document: { title: 'Filial Sul', body: { innerText: `${'x'.repeat(300)}\nCadeira Ergo | 20${'y'.repeat(300)}\nCadeira Ergo | 21\nMesa | 4\n${'x'.repeat(14000)}` } } });
  service.getAccessibilityTree = async () => ({ success: true, tree: { url: startUrl, title: 'Filial Centro', nodes: [] } });
  const foreign = 'http://127.0.0.1:5000/user';
  service.tabs.set('tab-user', { state: { url: foreign }, webContents: { isDestroyed: () => false, getURL: () => foreign, executeJavaScript: async () => ({ title: 'Privada', text: 'Cadeira Ergo | 999' }) } });
  let secondUrl = 'about:blank';
  let createCount = 0;
  service.setBrowserControls({
    createTab: async () => {
      if (createCount++ === 0) return { tabId: 'tab-bench' };
      service.tabs.set('tab-task-2', { state: {}, webContents: { isDestroyed: () => false, getURL: () => secondUrl, isLoading: () => false, setBackgroundThrottling: () => {}, loadURL: async (url) => { secondUrl = url; }, executeJavaScript: async (script) => vm.runInNewContext(script, { document: { title: 'Filial Norte', body: { innerText: 'Cadeira Ergo | 9' } } }) } });
      return { tabId: 'tab-task-2' };
    },
    closeTab: async (tabId) => { service.tabs.delete(tabId); }
  });
  service.setAgentConfigProvider(async () => ({ provider: 'openrouter', model: 'test-model', apiKey: 'test-key' }));
  const originalFetch = global.fetch;
  let call = 0;
  let batchResult;
  global.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    call++;
    const message = call === 1
      ? { role: 'assistant', tool_calls: [{ id: 'inspect1', type: 'function', function: { name: 'inspect_page', arguments: '{}' } }] }
      : call === 2
        ? { role: 'assistant', tool_calls: [{ id: 'new1', type: 'function', function: { name: 'tabs', arguments: '{"action":"new","url":"http://127.0.0.1:5000/t/44-estoque-filiais?f=norte"}' } }] }
        : call === 3
        ? { role: 'assistant', tool_calls: [{ id: 'batch1', type: 'function', function: { name: 'tabs', arguments: '{"action":"read_batch","query":"Cadeira Ergo"}' } }] }
      : { role: 'assistant', content: 'A filial Sul tem 20 unidades.' };
    if (call === 4) batchResult = JSON.parse(body.messages.find((entry) => entry.tool_call_id === 'batch1').content);
    return { ok: true, json: async () => ({ choices: [{ message }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) };
  };
  try {
    const result = await service.runTask({ startUrl, prompt: 'Leia em lote', approvalPolicy: 'local-fixture', captureReadEvidence: true });
    assert.equal(result.success, true);
    assert.equal(batchResult.readOnly, true);
    assert.equal(batchResult.coverage.complete, true, 'entire matching text was returned');
    assert.equal(batchResult.coverage.pagesTruncated, 0);
    assert.equal(batchResult.coverage.matchesFound, 3);
    assert.equal(batchResult.coverage.matchesReturned, 3);
    assert.equal(batchResult.coverage.matchesOmitted, 0);
    assert.equal(batchResult.pages.length, 2, 'a aba do usuário não pode ser lida');
    assert.deepEqual(batchResult.pages.map((page) => page.matches), [2, 1]);
    assert.equal(batchResult.pages[0].text, `Cadeira Ergo | 20${'y'.repeat(300)}\nCadeira Ergo | 21`, 'matching rows remain separate after the query filters them');
    assert.match(batchResult.pages[1].text, /Cadeira Ergo \| 9/);
    assert.ok(batchResult.pages.every((page) => page.text.length <= 600));
    assert.equal(batchResult.pages[0].truncated, false);
    assert.equal(batchResult.pages[1].truncated, false);
    assert.deepEqual(result.trace.pageReads, ['centro', 'norte'], 'trace records only route keys for successfully read local fixture pages');
    assert.deepEqual(Object.keys(result.trace.pageReads).sort(), ['0', '1']);
    assert.ok(result.trace.pageReads.every((key) => ['centro', 'norte', 'sul', 'leste', 'oeste', 'litoral'].includes(key)), 'read evidence contains only allow-listed route keys');
  } finally { global.fetch = originalFetch; }
});

function servicoComCaptcha() {
  const { AutomationService } = require('../src/automation/service');
  const service = new AutomationService();
  const pagina = { captcha: true };
  service.humanCheckPollMs = 5;
  service.tabs.set('tab-captcha', {
    state: { url: 'https://site.test/' },
    webContents: {
      isDestroyed: () => false,
      getURL: () => 'https://site.test/',
      executeJavaScript: async (code) => (code.includes('g-recaptcha') ? (pagina.captcha ? { kind: 'widget', hint: 'g-recaptcha' } : null) : 'texto')
    }
  });
  return { service, pagina };
}

test('human check detection only reports known CAPTCHA kinds', async () => {
  const { service, pagina } = servicoComCaptcha();
  assert.deepEqual(await service.detectHumanCheck('tab-captcha'), { detected: true, kind: 'widget', hint: 'g-recaptcha' });
  pagina.captcha = false;
  assert.deepEqual(await service.detectHumanCheck('tab-captcha'), { detected: false });
  assert.deepEqual(await service.detectHumanCheck('tab-inexistente'), { detected: false });
});

async function rodarComModeloSimples(service) {
  const originalFetch = global.fetch;
  const pedidos = [];
  global.fetch = async (_url, options) => {
    pedidos.push(JSON.parse(options.body));
    return { ok: true, json: async () => ({ choices: [{ message: { role: 'assistant', content: 'Feito.' } }] }) };
  };
  try {
    return { result: await service.runAgent('tab-captcha', 'Envie o formulário', 'test-key', 'test-model', true, 'openrouter', false, { trace: { modelCalls: 0, inputTokens: 0, outputTokens: 0, usageAvailable: true, toolCalls: [], stopReason: null } }), pedidos };
  } finally {
    global.fetch = originalFetch;
  }
}

test('the agent pauses on a CAPTCHA and resumes when the user says it is solved', async () => {
  const { service } = servicoComCaptcha();
  const avisos = [];
  service.setInterventionHandler(async (request, signal) => { avisos.push({ request, signal }); return 'continue'; });
  const { result, pedidos } = await rodarComModeloSimples(service);
  assert.equal(result.success, true);
  assert.equal(avisos.length, 1);
  assert.equal(avisos[0].request.origin, 'https://site.test');
  assert.equal(avisos[0].signal.aborted, true, 'o aviso é encerrado ao retomar');
  assert.match(pedidos[0].messages.at(-1).content, /resolveu a verificação humana/);
});

test('the agent resumes on its own once the CAPTCHA disappears from the page', async () => {
  const { service, pagina } = servicoComCaptcha();
  service.setInterventionHandler(() => new Promise(() => {}));
  setTimeout(() => { pagina.captcha = false; }, 10);
  const { result } = await rodarComModeloSimples(service);
  assert.equal(result.success, true);
});

test('the agent stops when the user cancels the CAPTCHA pause', async () => {
  const { service } = servicoComCaptcha();
  service.setInterventionHandler(async () => 'cancel');
  const { result, pedidos } = await rodarComModeloSimples(service);
  assert.equal(result.success, false);
  assert.equal(result.humanCheck, true);
  assert.equal(pedidos.length, 0, 'o modelo não foi chamado');
});

test('benchmark tasks stop at a CAPTCHA without waiting for anyone', async () => {
  const { service } = servicoComCaptcha();
  let chamado = false;
  service.setInterventionHandler(async () => { chamado = true; return 'continue'; });
  service.taskApprovalPolicies.set('tab-captcha', 'local-fixture');
  const trace = { modelCalls: 0, inputTokens: 0, outputTokens: 0, usageAvailable: true, toolCalls: [], stopReason: null };
  const result = await service.runAgent('tab-captcha', 'Envie', 'k', 'm', true, 'openrouter', false, { trace });
  assert.equal(result.humanCheck, true);
  assert.equal(trace.stopReason, 'human_check');
  assert.equal(chamado, false);
});

test('the agent follows a tab opened by a link, keeps the task policy on it and closes it at the end, but cannot open outside sites', async () => {
  const { service } = servicoComAbaLocal();
  const fechadas = [];
  service.setBrowserControls({
    createTab: async () => ({ tabId: 'tab-bench' }),
    closeTab: async (tabId) => { fechadas.push(tabId); service.tabs.delete(tabId); }
  });
  service.setAgentConfigProvider(async () => ({ provider: 'openrouter', model: 'test-model', apiKey: 'test-key' }));
  service.getAccessibilityTree = async () => ({ success: true, tree: { url: 'http://127.0.0.1:5000/t/x', nodes: [{ index: 0, role: 'link', tag: 'a', name: 'Cotação' }] } });
  const popupUrl = 'http://127.0.0.1:5000/t/x?t=b';
  service.executeAXAction = async () => {
    service.tabs.set('tab-popup', { state: { url: popupUrl, title: 'B' }, webContents: { isDestroyed: () => false, isLoading: () => false, getURL: () => popupUrl, executeJavaScript: async () => ({}) } });
    return { success: true };
  };
  const respostas = [];
  const originalFetch = global.fetch;
  let call = 0;
  global.fetch = async (_url, options) => {
    call++;
    const body = JSON.parse(options.body);
    respostas.push(body.messages.at(-1));
    const passos = [
      { name: 'inspect_page', arguments: '{}' },
      { name: 'click', arguments: '{"index":0}' },
      { name: 'tabs', arguments: '{"action":"switch","tabId":"tab-popup"}' },
      { name: 'tabs', arguments: '{"action":"new","url":"https://example.com/"}' }
    ];
    const message = { role: 'assistant', tool_calls: [{ id: `t${call}`, type: 'function', function: passos[call - 1] }] };
    return { ok: true, json: async () => ({ choices: [{ message }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) };
  };
  try {
    const result = await service.runTask({ startUrl: 'http://127.0.0.1:5000/t/x', prompt: 'Compare', approvalPolicy: 'local-fixture' });
    assert.match(respostas[2].content, /newTabs/);
    assert.match(respostas[2].content, /tab-popup/);
    assert.match(respostas[3].content, /"current":true/);
    assert.equal(result.cancelled, true, 'site externo bloqueado pela política local-fixture');
    assert.deepEqual(fechadas.sort(), ['tab-bench', 'tab-popup']);
    assert.equal(service.taskApprovalPolicies.size, 0);
  } finally {
    global.fetch = originalFetch;
  }
});

test('old large tool outputs get summarized after six newer ones', async () => {
  const { service } = servicoComAbaLocal();
  service.setBrowserControls({ createTab: async () => ({ tabId: 'tab-bench' }), closeTab: async (tabId) => { service.tabs.delete(tabId); } });
  service.setAgentConfigProvider(async () => ({ provider: 'openrouter', model: 'test-model', apiKey: 'test-key' }));
  service.getAccessibilityTree = async () => ({ success: true, tree: { url: 'http://127.0.0.1:5000/t/x', nodes: [{ index: 0, role: 'button', tag: 'button', name: 'Ver' }] } });
  service.executeAXAction = async () => ({ success: true, detalhe: 'x'.repeat(5000) });
  const passos = [
    { name: 'inspect_page', arguments: '{}' },
    { name: 'click', arguments: '{"index":0}' },
    ...Array.from({ length: 6 }, () => ({ name: 'tabs', arguments: '{"action":"list"}' }))
  ];
  let ultimo;
  const originalFetch = global.fetch;
  let call = 0;
  global.fetch = async (_url, options) => {
    ultimo = JSON.parse(options.body);
    const passo = passos[call++];
    const message = passo ? { role: 'assistant', tool_calls: [{ id: `t${call}`, type: 'function', function: passo }] } : { role: 'assistant', content: 'Pronto.' };
    return { ok: true, json: async () => ({ choices: [{ message }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) };
  };
  try {
    const result = await service.runTask({ startUrl: 'http://127.0.0.1:5000/t/x', prompt: 'Some', approvalPolicy: 'local-fixture', observeAfterActions: false });
    assert.equal(result.success, true);
    assert.equal(ultimo.messages[1].content, 'Some');
    const clique = ultimo.messages.find((m) => m.role === 'tool' && m.tool_call_id === 't2');
    assert.match(clique.content, /resumido/);
    assert.ok(clique.content.length < 2000);
  } finally {
    global.fetch = originalFetch;
  }
});

test('the public-sites task policy approves only on its HTTPS hosts and never sensitive fields', async () => {
  const { service } = servicoComAbaLocal('https://pt.wikipedia.org/wiki/Brasil');
  service.taskApprovalPolicies.set('tab-bench', { kind: 'public-sites', hosts: ['wikipedia.org'] });
  service.getAccessibilityTree = async () => ({ success: true, tree: { nodes: [
    { index: 0, role: 'button', tag: 'button', name: 'Pesquisar', isSubmitControl: true },
    { index: 1, role: 'textbox', tag: 'input', name: 'Senha', sensitiveInput: true }
  ] } });

  assert.equal((await service.confirmConsequentialAction('tab-bench', { kind: 'click', elementIndex: 0 })).approved, true);
  assert.equal((await service.confirmConsequentialAction('tab-bench', { kind: 'type_text', elementIndex: 1, text: 'x' })).approved, false);
  assert.equal((await service.confirmConsequentialAction('tab-bench', { kind: 'navigate', url: 'https://en.wikipedia.org/wiki/Brazil' })).approved, true);
  assert.equal((await service.confirmConsequentialAction('tab-bench', { kind: 'navigate', url: 'http://pt.wikipedia.org/' })).approved, false);
  assert.equal((await service.confirmConsequentialAction('tab-bench', { kind: 'navigate', url: 'https://wikipedia.org.exemplo.com/' })).approved, false);
  assert.equal((await service.runTask({ startUrl: 'https://example.com/', prompt: 'x', approvalPolicy: 'public-sites', allowedHosts: ['wikipedia.org'] })).success, false);
});

test('upload only takes files straight from the downloads folder or downloaded in the task', async () => {
  const os = require('node:os');
  const fs = require('node:fs');
  const path = require('node:path');
  const { AutomationService } = require('../src/automation/service');
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'navegante-upload-'));
  const downloads = path.join(raiz, 'Downloads');
  fs.mkdirSync(path.join(downloads, 'sub'), { recursive: true });
  fs.writeFileSync(path.join(downloads, 'nota.txt'), 'ok');
  fs.writeFileSync(path.join(downloads, 'sub', 'dentro.txt'), 'ok');
  fs.writeFileSync(path.join(raiz, 'segredo.txt'), 'não sai');
  const service = new AutomationService();
  service.setBrowserControls({ downloadDirectory: () => downloads });
  try {
    assert.equal(path.basename(await service.resolveUploadFile('nota.txt', [])), 'nota.txt');
    await assert.rejects(service.resolveUploadFile('../segredo.txt', []), /não encontrado/);
    await assert.rejects(service.resolveUploadFile(path.join(raiz, 'segredo.txt'), []), /não encontrado/);
    await assert.rejects(service.resolveUploadFile('sub', []), /não é um arquivo/);
    const baixado = path.join(raiz, 'avaliacao.txt');
    fs.writeFileSync(baixado, 'baixado');
    assert.equal(await service.resolveUploadFile('d1', [{ id: 'd1', state: 'completed', path: baixado }]), fs.realpathSync(baixado));
  } finally {
    fs.rmSync(raiz, { recursive: true, force: true });
  }
});

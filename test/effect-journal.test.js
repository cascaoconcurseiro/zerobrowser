const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  EffectJournal, createMemoryStore, createFileStore, effectKey, isConsequential, planEffect, settleEffect
} = require('../src/automation/effect-journal');

test('effect key is stable for the same action and separates target, tool and page path', () => {
  const base = { tool: 'click', args: { index: 0 }, url: 'http://127.0.0.1/app?x=1', target: 'btn-save' };
  assert.equal(effectKey(base), effectKey({ ...base }));
  assert.equal(effectKey({ ...base, url: 'http://127.0.0.1/app?x=2' }), effectKey(base), 'query string não muda a chave');
  assert.notEqual(effectKey({ ...base, target: 'btn-delete' }), effectKey(base));
  assert.notEqual(effectKey({ ...base, url: 'http://127.0.0.1/outra' }), effectKey(base));
  assert.notEqual(effectKey({ ...base, tool: 'navigate' }), effectKey(base));
});

test('only consequential tools produce an effect key', () => {
  assert.equal(isConsequential('navigate', { url: 'http://x' }), true);
  assert.equal(isConsequential('click', {}), true);
  assert.equal(isConsequential('type_text', {}), false);
  assert.equal(isConsequential('press_key', { key: 'Enter' }), true);
  assert.equal(isConsequential('press_key', { key: 'a' }), false);
  assert.equal(isConsequential('hidden_action', { action: 'click' }), true);
  assert.equal(isConsequential('hidden_action', { action: 'fill' }), false);
});

test('planEffect executes a new action, blocks an unattempted verification and skips a confirmed one', async () => {
  const journal = new EffectJournal({ store: createMemoryStore() });
  const effect = { key: 'k1' };
  assert.equal((await planEffect(journal, effect)).action, 'execute');
  await journal.markAttempted('k1', { tool: 'click' });
  const blocked = await planEffect(journal, effect);
  assert.equal(blocked.action, 'block');
  assert.equal(blocked.output.needsVerification, true);
  await journal.markRetryable();
  assert.equal((await planEffect(journal, effect)).action, 'execute', 'depois de reler a página pode repetir');
  await journal.confirm('k1', {});
  assert.equal((await planEffect(journal, effect)).action, 'skip');
  assert.equal((await planEffect(journal, { key: 'k1' })).output.alreadyDone, true);
  assert.equal((await planEffect(null, effect)).action, 'execute', 'sem journal nada muda');
});

test('settleEffect confirms success, forgets a pre-dispatch failure and keeps an unknown outcome', async () => {
  const journal = new EffectJournal({ store: createMemoryStore() });
  await journal.markAttempted('ok', {});
  assert.equal(await settleEffect(journal, 'ok', { success: true }), 'confirmed');
  assert.equal(journal.peek('ok').state, 'confirmed');

  await journal.markAttempted('missing', {});
  assert.equal(await settleEffect(journal, 'missing', { success: false, error: 'Element not found' }), 'abandoned');
  assert.equal(journal.peek('missing'), null);

  await journal.markAttempted('slow', {});
  assert.equal(await settleEffect(journal, 'slow', { success: false, error: 'timeout do site' }), 'attempted');
  assert.equal(journal.peek('slow').state, 'attempted');
});

test('journal persists across instances and ignores a corrupt file', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'zero-journal-'));
  const file = path.join(directory, 'efeitos.json');
  try {
    const first = new EffectJournal({ store: createFileStore(file) });
    await first.markAttempted('persist', { tool: 'click', url: 'http://x/app' });
    await first.confirm('persist', {});

    const second = new EffectJournal({ store: createFileStore(file) });
    await second.ensureLoaded();
    assert.equal(second.peek('persist').state, 'confirmed');

    fs.writeFileSync(file, '{ não é json');
    const third = new EffectJournal({ store: createFileStore(file) });
    await third.ensureLoaded();
    assert.deepEqual(third.snapshot(), {}, 'arquivo inválido vira journal vazio, sem derrubar a tarefa');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('journal keeps the most recent entries up to its limit', async () => {
  let clock = 0;
  const journal = new EffectJournal({ store: createMemoryStore(), limit: 2, now: () => ++clock });
  await journal.markAttempted('a', {});
  await journal.markAttempted('b', {});
  await journal.markAttempted('c', {});
  const snapshot = journal.snapshot();
  assert.deepEqual(Object.keys(snapshot).sort(), ['b', 'c']);
});

test('journal entries expire so a new task does not inherit an old confirmation', async () => {
  let clock = 0;
  const journal = new EffectJournal({ store: createMemoryStore(), ttlMs: 1000, now: () => clock });
  await journal.markAttempted('k', {});
  await journal.confirm('k', {});
  clock = 500;
  assert.equal(journal.peek('k').state, 'confirmed');
  clock = 2000;
  assert.equal(journal.peek('k'), null);
  assert.equal((await planEffect(journal, { key: 'k' })).action, 'execute');
});

test('run_task skips a repeated consequential action and asks for verification after an unknown outcome', async () => {
  const { AutomationService } = require('../src/automation/service');
  const service = new AutomationService();
  const url = 'http://127.0.0.1:5000/t/form';
  let dispatched = 0;
  let succeed = false;
  service.effectJournal = new EffectJournal({ store: createMemoryStore() });
  service.setApprovalHandler(async () => { throw new Error('a tarefa não deve abrir diálogo'); });
  service.tabs.set('tab-journal', {
    state: { url },
    webContents: {
      isDestroyed: () => false, isLoading: () => false, getURL: () => url,
      executeJavaScript: async () => '', setBackgroundThrottling: () => {}
    }
  });
  service.setBrowserControls({ createTab: async () => ({ tabId: 'tab-journal' }), closeTab: async () => {} });
  service.setAgentConfigProvider(async () => ({ provider: 'openrouter', model: 'test-model', apiKey: 'test-key' }));
  service.getAccessibilityTree = async () => ({ success: true, tree: {
    url,
    nodes: [{ index: 0, role: 'button', tag: 'button', name: 'Enviar pedido', targetId: 'btn-send' }]
  } });
  service.executeAXAction = async () => {
    dispatched += 1;
    if (!succeed) throw new Error('timeout do site');
    return { success: true, actionExecuted: true, outcomeVerified: true };
  };

  const originalFetch = global.fetch;
  let round = 0;
  const outputs = {};
  global.fetch = async (_url, options) => {
    const messages = JSON.parse(options.body).messages;
    const last = messages.filter((message) => message.role === 'tool').at(-1);
    if (last) outputs[last.tool_call_id] = JSON.parse(last.content);
    round += 1;
    const call = (id, name, args) => ({ id, type: 'function', function: { name, arguments: JSON.stringify(args) } });
    const message = round === 1 ? { role: 'assistant', tool_calls: [call('inspect', 'inspect_page', {})] }
      : round === 2 ? { role: 'assistant', tool_calls: [call('first', 'click', { index: 0 })] }
        : round === 3 ? { role: 'assistant', tool_calls: [call('second', 'click', { index: 0 })] }
          : round === 4 ? { role: 'assistant', tool_calls: [call('inspect-2', 'inspect_page', {})] }
            : round === 5 ? (succeed = true, { role: 'assistant', tool_calls: [call('third', 'click', { index: 0 })] })
              : round === 6 ? { role: 'assistant', tool_calls: [call('fourth', 'click', { index: 0 })] }
                : { role: 'assistant', content: 'Pedido enviado.' };
    return { ok: true, json: async () => ({ choices: [{ message }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) };
  };
  try {
    const result = await service.runTask({
      startUrl: url, prompt: 'Enviar o pedido uma vez', approvalPolicy: 'local-fixture', effectJournal: true
    });
    assert.equal(result.success, true);
    assert.equal(dispatched, 2, 'só a tentativa inicial e a retomada após leitura podem despachar');
    assert.equal(outputs.second.needsVerification, true);
    assert.equal(outputs.first.success, false);
    assert.equal(outputs.third.success, true);
    assert.equal(outputs.fourth.alreadyDone, true, 'ação já confirmada não pode repetir');
    assert.equal(result.trace.effectBlocks, 1);
    assert.equal(result.trace.effectSkips, 1);
  } finally {
    global.fetch = originalFetch;
  }
});

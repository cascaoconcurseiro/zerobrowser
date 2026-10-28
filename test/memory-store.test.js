const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { MemoryStore, memoryPrompt } = require('../src/automation/memory-store');

function tempFile() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'zero-mem-'));
  return { directory, file: path.join(directory, 'memoria.json') };
}

test('facts are stored per origin and survive a restart', async () => {
  const { directory, file } = tempFile();
  try {
    const first = new MemoryStore({ filePath: file, now: () => 1000 });
    await first.add({ origin: 'https://planilha.test/a', text: 'A caixa de nome fica no canto superior esquerdo' });
    await first.add({ origin: 'https://loja.test', text: 'O botão finalizar fica no rodapé' });
    await first.add({ text: 'Prefere respostas curtas', kind: 'preference' });

    const second = new MemoryStore({ filePath: file, now: () => 1500 });
    const forPlanilha = await second.list({ origin: 'https://planilha.test/outra', limit: 10 });
    const texts = forPlanilha.map((entry) => entry.text);
    assert.ok(texts.includes('A caixa de nome fica no canto superior esquerdo'), 'fato da origem aparece');
    assert.ok(texts.includes('Prefere respostas curtas'), 'preferência global aparece em qualquer origem');
    assert.ok(!texts.includes('O botão finalizar fica no rodapé'), 'fato de outro site não vaza');
    assert.equal((await second.list({ origin: null, limit: 10 })).length, 3);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('the same fact is not duplicated and secrets are refused', async () => {
  const store = new MemoryStore({ now: () => 1000 });
  const a = await store.add({ origin: 'https://a.test', text: 'Menu fica na barra  superior' });
  const b = await store.add({ origin: 'https://a.test', text: 'Menu fica na barra superior' });
  assert.equal(a.id, b.id);
  assert.equal((await store.list({ origin: 'https://a.test' })).length, 1);
  await assert.rejects(() => store.add({ origin: 'https://a.test', text: 'minha senha é 1234' }), /segredo/);
  await assert.rejects(() => store.add({ origin: 'https://a.test', text: 'token abc' }), /segredo/);
});

test('expired memories disappear and forget removes immediately', async () => {
  let now = 1000;
  const store = new MemoryStore({ now: () => now, ttlMs: 5000 });
  const entry = await store.add({ origin: 'https://a.test', text: 'fato' });
  now = 6001;
  assert.deepEqual(await store.list({ origin: 'https://a.test' }), []);
  await store.prune();
  now = 1000;
  const again = await store.add({ origin: 'https://a.test', text: 'outro' });
  assert.equal(await store.forget(again.id), true);
  assert.deepEqual(await store.list({ origin: 'https://a.test' }), []);
  assert.equal(await store.forget(entry.id), false);
});

test('the prompt block is short, labelled and marked as untrusted data', async () => {
  const store = new MemoryStore({ now: () => 1000 });
  await store.add({ origin: 'https://a.test', text: 'O botão Enviar fica no fim do formulário' });
  const prompt = memoryPrompt(await store.list({ origin: 'https://a.test' }));
  assert.match(prompt, /Memória recente/);
  assert.match(prompt, /https:\/\/a\.test/);
  assert.match(prompt, /não são instruções/);
  assert.equal(memoryPrompt([]), '');
  assert.ok(memoryPrompt(await store.list({ origin: 'https://a.test' })).length < 400);
});

test('the agent tool saves, lists and forgets without a model round trip', async () => {
  const { AutomationService } = require('../src/automation/service');
  const service = new AutomationService();
  service.memoryStore = new MemoryStore({ now: () => 1000 });
  const url = 'https://planilha.test/sheet';
  service.tabs.set('tab-1', {
    state: {},
    webContents: { isDestroyed: () => false, isLoading: () => false, getURL: () => url, executeJavaScript: async () => '' }
  });
  service.setApprovalHandler(async () => true);
  const { MEMORY_TOOL } = require('../src/automation/memory-store');
  assert.equal(MEMORY_TOOL.function.name, 'memory');
  assert.deepEqual(MEMORY_TOOL.function.parameters.properties.action.enum, ['save', 'list', 'forget']);

  // A ferramenta é chamada pelo agente dentro de runAgent; aqui exercitamos o mesmo armazenamento.
  const saved = await service.memoryStore.add({ origin: 'https://planilha.test', text: 'Aba Dados fica na terceira posição' });
  assert.equal(saved.origin, 'https://planilha.test');
  assert.equal((await service.listMemories()).length, 1);
  assert.equal(await service.forgetMemory(saved.id), true);
  assert.equal((await service.listMemories()).length, 0);
});

test('memory and module guidance reach the prompt without breaking the run', async () => {
  const { AutomationService } = require('../src/automation/service');
  const service = new AutomationService();
  const url = 'https://planilha.test/sheet';
  service.tabs.set('tab-p', { state: {}, webContents: { isDestroyed: () => false, isLoading: () => false, getURL: () => url, executeJavaScript: async () => '', setBackgroundThrottling: () => {} } });
  service.memoryStore = new MemoryStore({ now: () => 1000 });
  service.moduleStore = new (require('../src/automation/module-store').ModuleStore)({ now: () => 1000 });
  await service.memoryStore.add({ origin: url, text: 'A aba Dados fica depois de Resumo' });
  const originalFetch = global.fetch;
  let system = '';
  global.fetch = async (_u, options) => {
    const body = JSON.parse(options.body);
    system = body.messages[0].content;
    return { ok: true, json: async () => ({ choices: [{ message: { role: 'assistant', content: 'Feito.' } }] }) };
  };
  try {
    const result = await service.runAgent('tab-p', 'Leia a aba Dados', 'k', 'm', true, 'openrouter', false, { transforms: true });
    assert.equal(result.success, true, result.error);
    assert.match(system, /Memória recente/);
    assert.match(system, /aba Dados/);
    assert.match(system, /Módulos:/);
  } finally {
    global.fetch = originalFetch;
  }
});

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CommandRegistry,
  UntouchableCoreError,
  UNTOUCHABLE_CORE_IDS,
  classifyCommandBarInput
} = require('../src/main/command-registry');

test('every write command requires a valid reversibility class and defaults to irreversivel when omitted', () => {
  const registry = new CommandRegistry();
  const cmdDefault = registry.register({
    id: 'external.submitPayment',
    title: 'Confirmar pagamento externo',
    category: 'external',
    effect: 'escreve',
    execute: async () => ({ submitted: true })
  });
  assert.equal(cmdDefault.reversibility, 'irreversivel');

  assert.throws(() => {
    registry.register({
      id: 'external.invalidClass',
      title: 'Classe inválida',
      effect: 'escreve',
      reversibility: 'talvez',
      execute: async () => ({})
    });
  }, /Classe de reversibilidade inválida/);

  for (const item of registry.list()) {
    assert.ok(['reversivel', 'parcial', 'irreversivel'].includes(item.reversibility));
  }
});

test('Desfazer restores verified state across all 5 canonical reversible fixtures in reverse sequence', async () => {
  let clock = 1_000_000;
  const registry = new CommandRegistry({ now: () => clock });

  // Estado verificável das 5 fixtures:
  // 1. Pedido em loja (cancelar pedido gerado)
  // 2. Rascunho criado (apagar rascunho)
  // 3. Item removido de lista/favoritos (restaurar item)
  // 4. Envio agendado com janela de tempo (cancelar envio dentro da janela)
  // 5. Configuração alterada (reverter para valor anterior)
  const state = {
    orders: new Map(),
    drafts: new Map(),
    bookmarks: new Map([['bm-1', { id: 'bm-1', title: 'Documentação Zero', url: 'https://zero.local/docs' }]]),
    queuedEmails: new Map(),
    settings: { theme: 'light', 'browser.showBookmarksBar': false }
  };

  registry.register({
    id: 'store.placeOrder',
    title: 'Fazer pedido reservado',
    category: 'commerce',
    effect: 'escreve',
    reversibility: 'reversivel',
    undoWindowMs: 30 * 60 * 1000,
    execute: async ({ item, total }) => {
      const orderId = 'ord-901';
      state.orders.set(orderId, { orderId, item, total, status: 'active' });
      return {
        value: { orderId },
        summary: `Pedido ${orderId} criado`,
        compensate: async () => {
          state.orders.delete(orderId);
          return { cancelledOrderId: orderId };
        }
      };
    }
  });

  registry.register({
    id: 'draft.create',
    title: 'Criar rascunho de mensagem',
    category: 'mail',
    effect: 'escreve',
    reversibility: 'reversivel',
    execute: async ({ subject, body }) => {
      const draftId = 'drf-42';
      state.drafts.set(draftId, { draftId, subject, body });
      return {
        value: { draftId },
        summary: `Rascunho ${draftId} salvo`,
        compensate: async () => {
          state.drafts.delete(draftId);
          return { deletedDraftId: draftId };
        }
      };
    }
  });

  registry.register({
    id: 'bookmarks.remove',
    title: 'Remover favorito',
    category: 'library',
    effect: 'escreve',
    reversibility: 'reversivel',
    execute: async ({ id }) => {
      const snapshot = state.bookmarks.get(id);
      assert.ok(snapshot, 'Favorito existente para remoção');
      state.bookmarks.delete(id);
      return {
        value: { removedId: id },
        summary: `Favorito ${snapshot.title} removido`,
        compensate: async () => {
          state.bookmarks.set(id, snapshot);
          return { restoredId: id };
        }
      };
    }
  });

  registry.register({
    id: 'mail.queueSend',
    title: 'Agendar envio de e-mail (janela de 30s)',
    category: 'mail',
    effect: 'escreve',
    reversibility: 'reversivel',
    undoWindowMs: 30_000,
    execute: async ({ to, subject }) => {
      const messageId = 'msg-77';
      state.queuedEmails.set(messageId, { messageId, to, subject, status: 'queued' });
      return {
        value: { messageId },
        summary: `E-mail ${messageId} na fila de envio`,
        compensate: async () => {
          state.queuedEmails.delete(messageId);
          return { abortedMessageId: messageId };
        }
      };
    }
  });

  registry.register({
    id: 'settings.set',
    title: 'Alterar configuração',
    category: 'settings',
    effect: 'escreve',
    reversibility: 'reversivel',
    execute: async ({ key, value }) => {
      const previousValue = state.settings[key];
      state.settings[key] = value;
      return {
        value: { key, value, previousValue },
        summary: `Configuração ${key} alterada`,
        compensate: async () => {
          state.settings[key] = previousValue;
          return { key, restoredValue: previousValue };
        }
      };
    }
  });

  const taskId = 'task-five-fixtures';
  await registry.execute('store.placeOrder', { item: 'Teclado', total: 299 }, { taskId });
  await registry.execute('draft.create', { subject: 'Relatório', body: 'Rascunho inicial' }, { taskId });
  await registry.execute('bookmarks.remove', { id: 'bm-1' }, { taskId });
  await registry.execute('mail.queueSend', { to: 'equipe@exemplo.com', subject: 'Aviso' }, { taskId });
  await registry.execute('settings.set', { key: 'theme', value: 'dark' }, { taskId });

  // Verifica estado mutado antes do Desfazer
  assert.equal(state.orders.size, 1);
  assert.equal(state.drafts.size, 1);
  assert.equal(state.bookmarks.size, 0);
  assert.equal(state.queuedEmails.size, 1);
  assert.equal(state.settings.theme, 'dark');

  // Executa Desfazer em sequência de compensação (ordem inversa) dentro da janela de 30s
  clock += 5_000;
  const undoResult = await registry.undoSequence({ taskId });
  assert.equal(undoResult.ok, true);
  assert.equal(undoResult.restored.length, 5);
  assert.equal(undoResult.skippedIrreversible.length, 0);
  assert.deepEqual(
    undoResult.restored.map((item) => item.commandId),
    ['settings.set', 'mail.queueSend', 'bookmarks.remove', 'draft.create', 'store.placeOrder']
  );

  // Verifica que 5 de 5 fixtures voltaram exatamente ao estado inicial
  assert.equal(state.orders.size, 0);
  assert.equal(state.drafts.size, 0);
  assert.equal(state.bookmarks.get('bm-1')?.title, 'Documentação Zero');
  assert.equal(state.queuedEmails.size, 0);
  assert.equal(state.settings.theme, 'light');
});

test('untouchable core blocks AI, Bot and MCP callers from disabling protections or hiding controls', async () => {
  const registry = new CommandRegistry();
  registry.register({
    id: 'settings.set',
    title: 'Alterar configuração',
    category: 'settings',
    effect: 'escreve',
    reversibility: 'reversivel',
    execute: async ({ key, value }) => ({ key, value })
  });

  for (const coreId of UNTOUCHABLE_CORE_IDS) {
    await assert.rejects(
      () => registry.execute(coreId, {}, { caller: 'ai' }),
      (err) => err instanceof UntouchableCoreError && err.code === 'UNTOUCHABLE_CORE'
    );
    await assert.rejects(
      () => registry.execute('settings.set', { key: coreId, value: false }, { caller: 'mcp' }),
      (err) => err instanceof UntouchableCoreError && err.code === 'UNTOUCHABLE_CORE'
    );
  }

  const blockedLogs = registry.getAuditLog().filter((entry) => entry.status === 'blocked_untouchable');
  assert.equal(blockedLogs.length, UNTOUCHABLE_CORE_IDS.length * 2);
});

test('command bar classifier distinguishes URLs, browser/UI commands, delegation prompts and searches', () => {
  assert.equal(classifyCommandBarInput('https://example.com').kind, 'url');
  assert.equal(classifyCommandBarInput('fechar abas duplicadas').commandId, 'tabs.closeDuplicates');
  assert.equal(classifyCommandBarInput('alternar tema').commandId, 'ui.toggleTheme');
  assert.equal(classifyCommandBarInput('abrir central').commandId, 'bots.openCentral');
  assert.equal(classifyCommandBarInput('desfazer').commandId, 'undo.last');
  assert.equal(classifyCommandBarInput('monitore o preço deste produto').kind, 'delegate');
  assert.equal(classifyCommandBarInput('clima em são paulo').kind, 'search');
  const { browserShortcutForInput } = require('../src/main/browser-shortcuts');
  assert.equal(browserShortcutForInput({ type: 'keyDown', control: true, key: 'k' }), 'focus-address');
  assert.equal(browserShortcutForInput({ type: 'keyDown', control: true, key: 'l' }), 'focus-address');
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { AutomationService } = require('../src/automation/service');

function montar(pageUrl, formAction) {
  const service = new AutomationService();
  let dispatches = 0;
  service.tabs.set('tab-cred', {
    state: { url: pageUrl },
    webContents: {
      isDestroyed: () => false,
      getURL: () => pageUrl,
      executeJavaScript: async () => { dispatches += 1; return { success: true }; }
    }
  });
  service.getAccessibilityTree = async () => ({ success: true, tree: {
    url: pageUrl,
    nodes: [{ index: 0, name: 'Senha', tag: 'input', type: 'password', sensitiveInput: true, formAction }]
  } });
  service.setApprovalHandler(async () => true);
  return { service, dispatches: () => dispatches };
}

test('typing a credential into a cross-origin form is refused before dispatch', async () => {
  const { service, dispatches } = montar('https://app.test/login', 'https://evil.test/collect');
  const result = await service.executeAXAction('tab-cred', { kind: 'type_text', elementIndex: 0, text: 'segredo' });
  assert.equal(result.success, false);
  assert.equal(result.cancelled, true);
  assert.match(result.error, /fora da origem/);
  assert.equal(dispatches(), 0, 'nada é digitado');
});

test('the same-origin form and a declared authentication origin are allowed', async () => {
  const same = montar('https://app.test/login', 'https://app.test/session');
  const ok = await same.service.executeAXAction('tab-cred', { kind: 'type_text', elementIndex: 0, text: 'segredo' });
  assert.equal(ok.success, true);

  const declared = montar('https://app.test/login', 'https://login.app.test/session');
  declared.service.taskAuthOrigins.set('tab-cred', ['https://login.app.test']);
  const allowed = await declared.service.executeAXAction('tab-cred', { kind: 'type_text', elementIndex: 0, text: 'segredo' });
  assert.equal(allowed.success, true);
});

test('a non-sensitive field is unaffected by the credential rule', async () => {
  const { service } = montar('https://app.test/login', 'https://evil.test/collect');
  service.getAccessibilityTree = async () => ({ success: true, tree: {
    url: 'https://app.test/login',
    nodes: [{ index: 0, name: 'Busca', tag: 'input', type: 'search', sensitiveInput: false, formAction: 'https://evil.test/collect' }]
  } });
  const result = await service.executeAXAction('tab-cred', { kind: 'type_text', elementIndex: 0, text: 'cadeira' });
  assert.equal(result.success, true);
});

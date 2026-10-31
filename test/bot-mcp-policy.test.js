const test = require('node:test');
const assert = require('node:assert/strict');
const { AutomationService } = require('../src/automation/service');

test('Bot MCP asks before risky navigation and form submission, then remains usable after refusals and tool errors', async () => {
  const service = new AutomationService();
  const approvals = [];
  let pageActions = 0;
  const webContents = {
    getURL: () => 'https://source.example/account',
    isDestroyed: () => false,
    executeJavaScript: async () => { pageActions++; return { success: true }; }
  };
  service.setSettingsProvider(() => ({ isBotProfile: true, automationApprovalMode: 'low-risk' }));
  service.setApprovalHandler(async (request) => {
    approvals.push(request);
    return false;
  });
  service.tabs.set('bot-fixture-tab', {
    webContents,
    state: { url: 'https://source.example/account', title: 'Fixture', loading: false },
    axCache: null
  });
  service.getAccessibilityTree = async () => ({
    success: true,
    tree: {
      nodes: [{
        index: 0,
        name: 'Send email',
        role: 'button',
        isSubmitControl: true,
        formMethod: 'post',
        formAction: 'http://127.0.0.1/fixture-send',
        formText: 'Send email',
        submitLabels: 'Send email'
      }]
    }
  });
  service.registerTools();

  const navigation = await service.handleMcpRequest({
    jsonrpc: '2.0', id: 1, method: 'tools/call',
    params: { name: 'browser_navigate', arguments: {
      tabId: 'bot-fixture-tab', url: `https://outside.example/?q=${'x'.repeat(48)}`
    } }
  });
  assert.equal(navigation.isError, true);
  assert.equal(navigation.structuredContent.success, false);
  assert.equal(navigation.structuredContent.cancelled, true);
  assert.match(approvals[0].reason, /muitos dados na URL/i);

  const externalSend = await service.handleMcpRequest({
    jsonrpc: '2.0', id: 2, method: 'tools/call',
    params: { name: 'browser_click', arguments: { tabId: 'bot-fixture-tab', elementIndex: 0 } }
  });
  assert.equal(externalSend.isError, true);
  assert.equal(externalSend.structuredContent.success, false);
  assert.equal(externalSend.structuredContent.cancelled, true);
  assert.match(approvals[1].reason, /compromisso|enviar formulário/i);
  assert.equal(approvals[1].kind, 'click');
  assert.equal(pageActions, 0, 'a página não recebe a ação após a recusa');

  await assert.rejects(service.handleMcpRequest({
    jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'fixture_missing_tool', arguments: {} }
  }), /Unknown tool/);
  assert.deepEqual(await service.handleMcpRequest({ jsonrpc: '2.0', id: 4, method: 'ping' }), {});
  const catalog = await service.handleMcpRequest({ jsonrpc: '2.0', id: 5, method: 'tools/list' });
  assert.ok(catalog.tools.some((tool) => tool.name === 'browser_get_text'));
});

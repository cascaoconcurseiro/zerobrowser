const { app, BrowserWindow, WebContentsView } = require('electron');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { AutomationService } = require('../src/automation/service');

app.whenReady().then(async () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'navegante-download-owned-'));
  const server = http.createServer((req, res) => {
    if (req.url === '/redirect') {
      res.writeHead(302, { Location: '/fixture.txt' });
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': 'attachment; filename="fixture.txt"' });
    res.end('download ownership verified');
  });
  let window;
  let session;
  let onDownload;
  try {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    window = new BrowserWindow({ show: false });
    const original = new WebContentsView();
    window.contentView.addChildView(original);
    await original.webContents.loadURL('about:blank');
    const service = new AutomationService();
    service.registerTab('origin', original.webContents, 'test');
    service.taskApprovalPolicies.set('origin', 'local-fixture');
    const records = [];
    const responses = [];
    service.setBrowserControls({
      createTab: async (url) => {
        assert.equal(url, 'about:blank', 'network must wait until agent ownership has been registered');
        const view = new WebContentsView();
        window.contentView.addChildView(view);
        service.registerTab('attachment', view.webContents, 'test');
        await view.webContents.loadURL(url);
        return { tabId: 'attachment' };
      },
      activateTab: () => {},
      listDownloads: () => records
    });
    session = original.webContents.session;
    onDownload = (_event, item, source) => {
      assert.equal(source.id, service.tabs.get('attachment').webContents.id);
      assert.ok(service.agentTabs.has('attachment'), 'download is owned before the event');
      assert.equal(service.taskApprovalPolicies.get('attachment'), 'local-fixture');
      const record = { id: 'download-test', tabId: 'attachment', url: item.getURL(), startedAt: Date.now(), state: 'progressing', filename: item.getFilename() };
      records.push(record);
      item.setSavePath(path.join(scratch, 'fixture.txt'));
      item.once('done', (_done, state) => { record.state = state; });
    };
    session.on('will-download', onDownload);
    const steps = [
      { name: 'tabs', arguments: JSON.stringify({ action: 'new', url: `http://127.0.0.1:${server.address().port}/redirect` }) },
      { name: 'downloads', arguments: JSON.stringify({ action: 'wait' }) }
    ];
    service.setFetchImplementation(async (_url, options) => {
      responses.push(JSON.parse(options.body));
      const action = steps.shift();
      const message = action ? { role: 'assistant', tool_calls: [{ id: `call-${responses.length}`, type: 'function', function: action }] } : { role: 'assistant', content: 'Arquivo baixado.' };
      return { ok: true, json: async () => ({ choices: [{ message }] }) };
    });
    const result = await service.runAgent('origin', 'Baixe o arquivo em outra aba', 'fixture-key', 'fixture-model');
    assert.equal(result.success, true, result.error);
    const afterNavigation = JSON.parse(responses[1].messages.at(-1).content);
    assert.equal(afterNavigation.downloadStarted, true, JSON.stringify({ afterNavigation, records }));
    assert.equal(afterNavigation.tabId, 'origin');
    assert.equal(records[0].state, 'completed');
    assert.equal(fs.readFileSync(path.join(scratch, 'fixture.txt'), 'utf8'), 'download ownership verified');
    assert.equal(service.agentTabs.size, 0);
    assert.equal(service.taskApprovalPolicies.has('attachment'), false);
    console.log('PASS: new-tab attachment inherits agent ownership before navigation and returns to origin');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (onDownload) session.removeListener('will-download', onDownload);
    if (window && !window.isDestroyed()) {
      for (const view of window.contentView.children) if (view.webContents && !view.webContents.isDestroyed()) view.webContents.close();
      window.destroy();
    }
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(scratch, { recursive: true, force: true });
    app.exit(process.exitCode || 0);
  }
});

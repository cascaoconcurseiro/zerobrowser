const { app, BrowserWindow, WebContentsView } = require('electron');
const assert = require('node:assert/strict');
const { AutomationService } = require('../src/automation/service');
const { iniciarServidor } = require('../bench/servidor');
const { tarefasStress } = require('../bench/tarefas-stress');

const task = tarefasStress.find((item) => item.id === '47-spa-loja-carrinho');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

app.whenReady().then(async () => {
  const server = await iniciarServidor();
  let window;
  try {
    window = new BrowserWindow({ show: true, width: 1000, height: 800 });
    const view = new WebContentsView();
    window.contentView.addChildView(view);
    view.setBounds({ x: 0, y: 0, width: 1000, height: 800 });
    await view.webContents.loadURL(server.urlDa(task.id));
    const service = new AutomationService();
    service.setApprovalHandler(async () => true);
    service.registerTab('store-fixture', view.webContents, 'bench-store-test');
    const waitFor = async (condition, label) => {
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        if (await view.webContents.executeJavaScript(`Boolean(${condition})`)) return;
        await delay(50);
      }
      throw new Error(`Timed out waiting for ${label}`);
    };
    const locator = async (strategy, query, action, value) => {
      const request = service.executeLocatorAction('store-fixture', { strategy, query, action, ...(value === undefined ? {} : { value }), exact: true, timeout: 4000 });
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Locator integration timed out: ${strategy} ${query} ${action}`)), 8000);
        request.then((result) => { clearTimeout(timer); resolve(result); }, (error) => { clearTimeout(timer); reject(error); });
      });
    };

    await waitFor("document.querySelector('#search') && document.querySelector('[data-open=\\\"aurora-x-pro\\\"]')", 'initial catalog');
    assert.equal((await locator('label', 'Buscar produtos', 'fill', 'Aurora')).success, true);
    await delay(1100);
    assert.equal((await locator('label', 'Categoria Áudio', 'click')).success, true);
    await delay(500);
    assert.equal((await locator('label', 'Marca Aurora', 'click')).success, true);
    await delay(500);
    assert.equal((await locator('label', 'Preço máximo', 'fill', '800')).success, true);
    await delay(1100);
    assert.equal((await locator('css', '[data-open="aurora-x-pro"]', 'click')).success, true);
    assert.equal((await locator('label', 'Cor', 'fill', 'Preto')).success, true);
    assert.equal((await locator('label', 'Conexão', 'fill', 'Bluetooth 5.3')).success, true);
    assert.equal((await locator('label', 'Quantidade', 'fill', '2')).success, true);
    const add = await locator('css', '#add-cart', 'click');
    assert.equal(add.success, true, add.error);

    const deadline = Date.now() + 3000;
    while (!server.estadoDe(task.id).carrinho && Date.now() < deadline) await delay(30);
    const state = server.estadoDe(task.id);
    const verdict = task.verificar(state, { mensagem: 'Concluído.' });
    assert.equal(verdict.aprovado, true, verdict.motivo);
    assert.equal(await view.webContents.executeJavaScript("document.querySelector('.cart')?.innerText.includes('Bluetooth 5.3')"), true);
    console.log('PASS: local SPA search, facets, rerendered variant modal, exact quantity and independently recorded cart state');
  } catch (error) {
    console.error(error);
    app.exit(1);
  } finally {
    if (window && !window.isDestroyed()) window.close();
    await server.fechar();
    app.quit();
  }
}).catch((error) => { console.error(error); app.exit(1); });

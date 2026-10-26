const { app, BrowserWindow, WebContentsView } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { AutomationService } = require('../src/automation/service');
const resultFile = 'C:/Users/Wesley/AppData/Local/Temp/navegante-ax-e2e.log';
function trace(message) { fs.appendFileSync(resultFile, `${new Date().toISOString()} ${message}\n`); }

app.whenReady().then(async () => {
  trace('electron-ready');
  let window;
  try {
    window = new BrowserWindow({ width: 800, height: 600, show: true });
    const view = new WebContentsView();
    window.contentView.addChildView(view);
    view.setBounds({ x: 0, y: 0, width: 800, height: 600 });
    const html = `<!doctype html><html><head><style>.hover-row .destroy{display:none}.hover-row:hover .destroy{display:inline-block}</style></head><body style="height:2400px">
      <label for="query">Search</label><input id="query" aria-label="Search">
      <label for="controlled">Controlled</label><input id="controlled" value="anterior">
      <label for="remounted">Remounted</label><input id="remounted" value="antes">
      <label for="remounted-keeps">Remounted keeps value</label><input id="remounted-keeps" value="antes">
      <label>Ambiguous <input value="antes"></label><label>Ambiguous <input value="decoy"></label>
      <label for="delayed-controlled">Delayed controlled</label><input id="delayed-controlled" value="antes">
      <label for="controlled-select">Controlled select</label><select id="controlled-select"><option value="financeiro">Financeiro</option><option value="suporte">Suporte técnico</option></select>
      <label for="delayed-controlled-select">Delayed controlled select</label><select id="delayed-controlled-select"><option value="financeiro">Financeiro</option><option value="suporte">Suporte técnico</option></select>
      <label for="password">Senha</label><input id="password" type="password" value="fixture-secret-not-for-model">
      <input id="unlabeled-password" type="password" value="unlabeled-secret-not-for-model">
      <label for="subject">Assunto</label><select id="subject"><option value="">Escolha</option><option value="suporte">Suporte técnico</option><option value="financeiro">Financeiro</option></select><output id="subject-result">waiting</output>
      <button id="apply">Apply</button><output id="result">waiting</output>
      <div id="hover-row" class="hover-row">Hover target<button id="hover-delete" class="destroy">Delete</button></div><output id="hover-result">waiting</output>
      <script>document.querySelector('#apply').addEventListener('click',()=>document.querySelector('#result').value=document.querySelector('#query').value);document.querySelector('#hover-delete').addEventListener('click',()=>document.querySelector('#hover-result').value='deleted');document.querySelector('#subject').addEventListener('change',e=>document.querySelector('#subject-result').value=e.target.value);document.querySelector('#controlled').addEventListener('input',e=>setTimeout(()=>e.target.value='revertido',0));document.querySelector('#delayed-controlled')._valueTracker={};document.querySelector('#delayed-controlled').addEventListener('input',e=>setTimeout(()=>e.target.value='revertido depois',100));document.querySelector('#controlled-select').addEventListener('change',e=>setTimeout(()=>e.target.value='financeiro',0));document.querySelector('#delayed-controlled-select').__reactProps$fixture={};document.querySelector('#delayed-controlled-select').addEventListener('change',e=>setTimeout(()=>e.target.value='financeiro',120));document.querySelector('#remounted').addEventListener('input',e=>{const replacement=e.target.cloneNode(true);replacement.value='';e.target.replaceWith(replacement)});document.querySelector('#remounted-keeps').addEventListener('input',e=>{const replacement=e.target.cloneNode(true);replacement.value=e.target.value;e.target.replaceWith(replacement)});document.querySelectorAll('label input').forEach((input,index)=>input.addEventListener('input',e=>{if(index===0){const replacement=e.target.cloneNode(true);replacement.value=e.target.value;e.target.replaceWith(replacement)}}))</script>
    </body></html>`;
    const finished = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Fixture load timed out')), 10000);
      view.webContents.once('did-finish-load', () => { clearTimeout(timer); resolve(); });
      view.webContents.once('did-fail-load', (_event, code, description) => { clearTimeout(timer); reject(new Error(`${code}: ${description}`)); });
    });
    await Promise.all([view.webContents.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`), finished]);

    const service = new AutomationService();
    service.setApprovalHandler(async () => true);
    service.registerTab('fixture', view.webContents, 'fixture-browser');
    const snapshot = await service.getAccessibilityTree('fixture');
    assert.equal(snapshot.success, true, snapshot.error);
    const passwordNode = snapshot.tree.nodes.find((node) => node.type === 'password');
    assert.equal(passwordNode?.sensitiveInput, true);
    assert.equal(passwordNode?.value, undefined, 'sensitive values must not enter the model context');
    const unlabeledPassword = snapshot.tree.nodes.find((node) => node.type === 'password' && node.name === '');
    assert.equal(unlabeledPassword?.value, undefined, 'unlabeled sensitive values must not enter the model context');
    assert.ok(!JSON.stringify(snapshot.tree).includes('unlabeled-secret-not-for-model'), 'unlabeled sensitive values and data URLs must not enter the model context');
    const inputIndex = snapshot.tree.nodes.find((node) => node.name === 'Search')?.index;
    const buttonIndex = snapshot.tree.nodes.find((node) => node.name === 'Apply')?.index;
    assert.notEqual(inputIndex, undefined, 'snapshot should contain the named input');
    assert.notEqual(buttonIndex, undefined, 'snapshot should contain the button');
    const roleButtonCount = await service.executeLocatorAction('fixture', { strategy: 'role', query: 'button', action: 'count' });
    assert.deepEqual(roleButtonCount, { success: true, count: 1 }, 'role locator should compare the role string without treating it as a DOM element');
    const namedRoleClick = await service.executeLocatorAction('fixture', { strategy: 'role', query: 'button', name: 'Apply', exact: true, action: 'click' });
    assert.equal(namedRoleClick.success, true, namedRoleClick.error);
    await view.webContents.executeJavaScript(`document.querySelector('#query').value='snapshot-switch-proof'`);
    const originalFetchForTabSwitch = global.fetch;
    let tabSwitchModelCalls = 0;
    global.fetch = async (_url, options) => {
      tabSwitchModelCalls++;
      if (tabSwitchModelCalls === 1) {
        const message = { role: 'assistant', tool_calls: [{ id: 'switch-fresh', type: 'function', function: { name: 'tabs', arguments: JSON.stringify({ action: 'switch', tabId: 'fixture', inspect: true }) } }] };
        return { ok: true, json: async () => ({ choices: [{ message }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) };
      }
      if (tabSwitchModelCalls === 2) {
        const request = JSON.parse(options.body);
        const switched = request.messages.filter((item) => item.role === 'tool' && item.tool_call_id === 'switch-fresh').at(-1);
        assert.ok(switched, 'model context should contain the switch result');
        const snapshotAfterSwitch = JSON.parse(switched.content);
        assert.equal(snapshotAfterSwitch.success, true);
        assert.ok(snapshotAfterSwitch.nodes?.some((node) => node.name === 'Apply'), 'switch inspect should return fresh AX nodes');
        const applyNode = snapshotAfterSwitch.nodes.find((node) => node.name === 'Apply');
        const message = { role: 'assistant', tool_calls: [{ id: 'click-after-switch', type: 'function', function: { name: 'click', arguments: JSON.stringify({ index: applyNode.index, targetId: applyNode.targetId }) } }] };
        return { ok: true, json: async () => ({ choices: [{ message }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) };
      }
      const message = { role: 'assistant', content: 'O clique após a troca foi verificado.' };
      return { ok: true, json: async () => ({ choices: [{ message }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) };
    };
    const switchTrace = { toolCalls: [] };
    try {
      const switchedAndClicked = await service.runAgent('fixture', 'Troque para a aba fixture, leia o snapshot junto da troca e clique em Apply.', 'fixture-key', 'fixture-model', true, 'openrouter', false, { maxSteps: 5, trace: switchTrace });
      assert.equal(switchedAndClicked.success, true, switchedAndClicked.error);
      assert.equal(await view.webContents.executeJavaScript(`document.querySelector('#result').value`), 'snapshot-switch-proof');
      assert.deepEqual(switchTrace.toolCalls.map((call) => call.tool), ['tabs', 'click'], 'fresh AX should avoid a separate inspect_page model call');
    } finally {
      global.fetch = originalFetchForTabSwitch;
    }
    // A physical Windows cursor can race the CDP virtual cursor in a visible window.
    // Keep this CSS :hover contract deterministic and isolate it from host pointer movement.
    window.hide();
    const hiddenDeleteBeforeHover = await service.executeLocatorAction('fixture', { strategy: 'css', query: '#hover-delete', action: 'isVisible' });
    assert.deepEqual(hiddenDeleteBeforeHover, { success: true, value: false }, 'fixture delete control should start hidden');
    const hovered = await service.executeLocatorAction('fixture', { strategy: 'css', query: '#hover-row', action: 'hover' });
    assert.equal(hovered.success, true, hovered.error);
    assert.equal(hovered.actionExecuted, true);
    const visibleDeleteAfterHover = await service.executeLocatorAction('fixture', { strategy: 'css', query: '#hover-delete', action: 'isVisible' });
    assert.deepEqual(visibleDeleteAfterHover, { success: true, value: true }, 'hover should reveal a normally hidden control');
    const clickedHiddenDelete = await service.executeLocatorAction('fixture', { strategy: 'css', query: '#hover-delete', action: 'click' });
    assert.equal(clickedHiddenDelete.success, true, clickedHiddenDelete.error);
    assert.equal(await view.webContents.executeJavaScript(`document.querySelector('#hover-result').value`), 'deleted');
    window.show();

    const typed = await service.executeAXAction('fixture', { kind: 'type_text', elementIndex: inputIndex, text: 'navegante' });
    assert.equal(typed.success, true);
    assert.equal(typed.actionExecuted, true);
    assert.equal(typed.outcomeVerified, true, 'ordinary inputs should be checked after the UI update');
    const controlledNode = snapshot.tree.nodes.find((node) => node.name === 'Controlled');
    const controlled = await service.executeAXAction('fixture', { kind: 'type_text', elementIndex: controlledNode.index, targetId: controlledNode.targetId, text: 'tentativa' });
    assert.equal(controlled.success, true, 'the input event may run even when a controlled UI later rejects its value');
    assert.equal(controlled.actionExecuted, true);
    assert.equal(controlled.outcomeVerified, false, 'a value reverted by a controlled UI must not be reported as verified');
    assert.match(controlled.error, /não manteve o valor/);
    const remountedNode = snapshot.tree.nodes.find((node) => node.name === 'Remounted');
    const remounted = await service.executeAXAction('fixture', { kind: 'type_text', elementIndex: remountedNode.index, targetId: remountedNode.targetId, text: 'substituído' });
    assert.equal(remounted.outcomeVerified, false, 'a detached DOM node must not prove that a replacement control retained the value');
    assert.equal(remounted.fieldState, 'remounted-value-mismatch');
    assert.equal(await view.webContents.executeJavaScript(`document.querySelector('#remounted').value`), '', 'the replacement input should demonstrate the failed persistence');
    const keptNode = snapshot.tree.nodes.find((node) => node.name === 'Remounted keeps value');
    const kept = await service.executeAXAction('fixture', { kind: 'type_text', elementIndex: keptNode.index, targetId: keptNode.targetId, text: 'recriado e conferido' });
    assert.equal(kept.outcomeVerified, true, 'a uniquely identified remounted control retaining its value should be verified');
    assert.equal(kept.targetRemounted, true);
    assert.equal(kept.fieldState, 'remounted-value-retained');
    const ambiguousNode = snapshot.tree.nodes.find((node) => node.name === 'Ambiguous');
    const ambiguous = await service.executeAXAction('fixture', { kind: 'type_text', elementIndex: ambiguousNode.index, targetId: ambiguousNode.targetId, text: 'não repetir em alvo ambíguo' });
    assert.equal(ambiguous.outcomeVerified, false, 'duplicate semantic replacements must remain unverified');
    assert.equal(ambiguous.fieldState, 'ambiguous-remount');
    assert.deepEqual(await view.webContents.executeJavaScript(`({values:[...document.querySelectorAll('label input')].filter(e=>e.closest('label')?.innerText.trim()==='Ambiguous').map(e=>e.value)})`), { values: ['não repetir em alvo ambíguo', 'decoy'] });
    const delayedNode = snapshot.tree.nodes.find((node) => node.name === 'Delayed controlled');
    const delayedStarted = Date.now();
    const delayed = await service.executeAXAction('fixture', { kind: 'type_text', elementIndex: delayedNode.index, targetId: delayedNode.targetId, text: 'tentativa atrasada' });
    assert.equal(delayed.outcomeVerified, false, 'a framework-managed late revert must be detected');
    assert.equal(delayed.fieldState, 'changed-after-framework-update');
    assert.ok(Date.now() - delayedStarted >= 100, 'only framework-managed inputs should get the extended observation window');
    assert.doesNotMatch(JSON.stringify({ remounted, kept, ambiguous, delayed }), /não repetir em alvo ambíguo|tentativa atrasada|recriado e conferido/);
    const executeJavaScript = view.webContents.executeJavaScript.bind(view.webContents);
    let reorderSelectAfterLookup = true;
    view.webContents.executeJavaScript = async (script, ...args) => {
      const result = await executeJavaScript(script, ...args);
      if (reorderSelectAfterLookup && script.includes('const strategy=')) {
        reorderSelectAfterLookup = false;
        await executeJavaScript(`document.querySelector('#subject').before(Object.assign(document.createElement('select'),{id:'decoy',innerHTML:'<option value="">Escolha</option><option value="wrong">Suporte técnico</option>'}))`);
      }
      return result;
    };
    const selected = await service.executeLocatorAction('fixture', { strategy: 'label', query: 'Assunto', action: 'fill', value: 'Suporte técnico' });
    view.webContents.executeJavaScript = executeJavaScript;
    assert.equal(selected.success, true, selected.error);
    assert.deepEqual({ selected: selected.selected, value: selected.value }, { selected: 'Suporte técnico', value: 'suporte' });
    const selectState = await view.webContents.executeJavaScript(`({value:document.querySelector('#subject').value,result:document.querySelector('#subject-result').value})`);
    assert.deepEqual(selectState, { value: 'suporte', result: 'suporte' });
    await executeJavaScript(`document.querySelector('#decoy').remove()`);

    const selectIndex = snapshot.tree.nodes.find((node) => node.name === 'Assunto')?.index;
    assert.notEqual(selectIndex, undefined, 'snapshot should contain the subject select');
    const getAccessibilityTree = service.getAccessibilityTree.bind(service);
    let reorderSelectBeforeAction = true;
    service.getAccessibilityTree = async (...args) => {
      const tree = await getAccessibilityTree(...args);
      if (reorderSelectBeforeAction) {
        reorderSelectBeforeAction = false;
        await executeJavaScript(`document.querySelector('#subject').before(Object.assign(document.createElement('select'),{id:'direct-decoy',innerHTML:'<option value="">Escolha</option><option value="wrong">Suporte técnico</option>'}))`);
      }
      return tree;
    };
    const originalFetch = global.fetch;
    let providerCall = 0;
    global.fetch = async () => {
      providerCall++;
      const message = providerCall === 1
        ? { role: 'assistant', tool_calls: [{ id: 'inspect-select', type: 'function', function: { name: 'inspect_page', arguments: '{}' } }] }
        : providerCall === 2
          ? { role: 'assistant', tool_calls: [{ id: 'select-option', type: 'function', function: { name: 'select_option', arguments: JSON.stringify({ index: selectIndex, option: 'Suporte técnico' }) } }] }
          : { role: 'assistant', content: 'Seleção verificada.' };
      return { ok: true, json: async () => ({ choices: [{ message }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) };
    };
    try {
      const selectedByAgent = await service.runAgent('fixture', 'Selecione suporte técnico no assunto.', 'fixture-key', 'fixture-model', true, 'openrouter', false, { maxSteps: 5 });
      assert.equal(selectedByAgent.success, true, selectedByAgent.error);
      const selectValues = await executeJavaScript(`({target:document.querySelector('#subject').value,decoy:document.querySelector('#direct-decoy').value})`);
      assert.deepEqual(selectValues, { target: 'suporte', decoy: '' }, 'direct select_option must follow the inspected control identity after DOM reorder');
    } finally {
      global.fetch = originalFetch;
      service.getAccessibilityTree = getAccessibilityTree;
      await executeJavaScript(`document.querySelector('#direct-decoy')?.remove()`);
    }

    const controlledSelectIndex = snapshot.tree.nodes.find((node) => node.name === 'Controlled select')?.index;
    assert.notEqual(controlledSelectIndex, undefined, 'snapshot should contain the controlled select');
    const originalFetchForControlledSelect = global.fetch;
    let controlledProviderCall = 0;
    global.fetch = async () => {
      controlledProviderCall++;
      const message = controlledProviderCall === 1
        ? { role: 'assistant', tool_calls: [{ id: 'inspect-controlled-select', type: 'function', function: { name: 'inspect_page', arguments: '{}' } }] }
        : controlledProviderCall === 2
          ? { role: 'assistant', tool_calls: [{ id: 'set-controlled-select', type: 'function', function: { name: 'select_option', arguments: JSON.stringify({ index: controlledSelectIndex, option: 'Suporte técnico' }) } }] }
          : { role: 'assistant', content: 'Seleção concluída.' };
      return { ok: true, json: async () => ({ choices: [{ message }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) };
    };
    const controlledSelectTrace = { toolCalls: [] };
    try {
      const controlledSelection = await service.runAgent('fixture', 'Selecione suporte técnico no select controlado.', 'fixture-key', 'fixture-model', true, 'openrouter', false, { maxSteps: 5, trace: controlledSelectTrace });
      assert.equal(controlledSelection.success, true, controlledSelection.error);
      const selectToolResult = controlledSelectTrace.toolCalls.find((call) => call.tool === 'select_option');
      assert.equal(selectToolResult?.actionExecuted, true, `the selection event should still have been dispatched: ${JSON.stringify(controlledSelectTrace)}`);
      assert.equal(selectToolResult?.outcomeVerified, false, 'a controlled selection that reverts must not be reported as verified');
      assert.equal(await executeJavaScript(`document.querySelector('#controlled-select').value`), 'financeiro');
    } finally {
      global.fetch = originalFetchForControlledSelect;
    }

    const delayedSelectLocator = await service.executeLocatorAction('fixture', { strategy: 'label', query: 'Delayed controlled select', action: 'fill', value: 'Suporte técnico' });
    assert.equal(delayedSelectLocator.actionExecuted, true, 'locator select fill should report that it dispatched the selection');
    assert.equal(delayedSelectLocator.outcomeVerified, false, 'locator select fill must detect a delayed framework revert');
    assert.equal(delayedSelectLocator.fieldState, 'changed-after-framework-update');
    assert.equal(await executeJavaScript(`document.querySelector('#delayed-controlled-select').value`), 'financeiro');

    const delayedSelectNode = (await service.getAccessibilityTree('fixture')).tree.nodes.find((node) => node.name === 'Delayed controlled select');
    assert.ok(delayedSelectNode?.targetId, 'delayed select should have a stable AX target');
    const originalFetchForDelayedSelect = global.fetch;
    let delayedSelectProviderCall = 0;
    global.fetch = async () => {
      delayedSelectProviderCall++;
      const message = delayedSelectProviderCall === 1
        ? { role: 'assistant', tool_calls: [{ id: 'inspect-delayed-select', type: 'function', function: { name: 'inspect_page', arguments: '{}' } }] }
        : delayedSelectProviderCall === 2
          ? { role: 'assistant', tool_calls: [{ id: 'select-delayed-option', type: 'function', function: { name: 'select_option', arguments: JSON.stringify({ index: delayedSelectNode.index, option: 'Suporte técnico' }) } }] }
          : { role: 'assistant', content: 'Tentei selecionar Suporte técnico.' };
      return { ok: true, json: async () => ({ choices: [{ message }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) };
    };
    const delayedSelectTrace = { toolCalls: [] };
    try {
      await service.runAgent('fixture', 'Selecione Suporte técnico na lista.', 'fixture-key', 'fixture-model', true, 'openrouter', false, { maxSteps: 5, trace: delayedSelectTrace });
      const selectToolResult = delayedSelectTrace.toolCalls.find((call) => call.tool === 'select_option');
      assert.equal(selectToolResult?.actionExecuted, true);
      assert.equal(selectToolResult?.outcomeVerified, false, 'direct select_option must detect the same delayed framework revert');
      assert.equal(selectToolResult?.success, false, 'trace must not mark a reverted selection successful');
      assert.equal(await executeJavaScript(`document.querySelector('#delayed-controlled-select').value`), 'financeiro');
    } finally {
      global.fetch = originalFetchForDelayedSelect;
    }

    const originalTreeForShiftedClick = service.getAccessibilityTree.bind(service);
    let insertBeforeApply = true;
    service.getAccessibilityTree = async (...args) => {
      const tree = await originalTreeForShiftedClick(...args);
      if (insertBeforeApply) {
        insertBeforeApply = false;
        await executeJavaScript(`const shifted=document.createElement('button');shifted.id='shifted-before-apply';shifted.textContent='Wrong target';shifted.onclick=()=>document.querySelector('#result').value='wrong target';document.querySelector('#apply').before(shifted)`);
      }
      return tree;
    };
    const originalFetchForShiftedClick = global.fetch;
    let shiftedClickProviderCall = 0;
    global.fetch = async () => {
      shiftedClickProviderCall++;
      const message = shiftedClickProviderCall === 1
        ? { role: 'assistant', tool_calls: [{ id: 'inspect-shifted-click', type: 'function', function: { name: 'inspect_page', arguments: '{}' } }] }
        : shiftedClickProviderCall === 2
          ? { role: 'assistant', tool_calls: [{ id: 'click-apply-after-reorder', type: 'function', function: { name: 'click', arguments: JSON.stringify({ index: buttonIndex }) } }] }
          : { role: 'assistant', content: 'Botão correto acionado.' };
      return { ok: true, json: async () => ({ choices: [{ message }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) };
    };
    try {
      const clickedAfterReorder = await service.runAgent('fixture', 'Clique em Apply.', 'fixture-key', 'fixture-model', true, 'openrouter', false, { maxSteps: 5 });
      assert.equal(clickedAfterReorder.success, true, clickedAfterReorder.error);
      assert.equal(await executeJavaScript(`document.querySelector('#result').value`), 'navegante', 'click by AX identity should reach the inspected button after a new control shifts the index');
    } finally {
      global.fetch = originalFetchForShiftedClick;
      service.getAccessibilityTree = originalTreeForShiftedClick;
      await executeJavaScript(`document.querySelector('#shifted-before-apply')?.remove()`);
    }

    const originalTreeForShiftedType = service.getAccessibilityTree.bind(service);
    let insertBeforeQuery = true;
    service.getAccessibilityTree = async (...args) => {
      const tree = await originalTreeForShiftedType(...args);
      if (insertBeforeQuery) {
        insertBeforeQuery = false;
        await executeJavaScript(`document.querySelector('#query').before(Object.assign(document.createElement('input'),{id:'shifted-before-query',ariaLabel:'Wrong field'}))`);
      }
      return tree;
    };
    const originalFetchForShiftedType = global.fetch;
    let shiftedTypeProviderCall = 0;
    global.fetch = async () => {
      shiftedTypeProviderCall++;
      const message = shiftedTypeProviderCall === 1
        ? { role: 'assistant', tool_calls: [{ id: 'inspect-shifted-type', type: 'function', function: { name: 'inspect_page', arguments: '{}' } }] }
        : shiftedTypeProviderCall === 2
          ? { role: 'assistant', tool_calls: [{ id: 'type-original-query-after-reorder', type: 'function', function: { name: 'type_text', arguments: JSON.stringify({ index: inputIndex, text: 'campo original' }) } }] }
          : { role: 'assistant', content: 'Campo correto preenchido.' };
      return { ok: true, json: async () => ({ choices: [{ message }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) };
    };
    try {
      const typedAfterReorder = await service.runAgent('fixture', 'Preencha o campo Search com campo original.', 'fixture-key', 'fixture-model', true, 'openrouter', false, { maxSteps: 5 });
      assert.equal(typedAfterReorder.success, true, typedAfterReorder.error);
      const inputValues = await executeJavaScript(`({target:document.querySelector('#query').value,decoy:document.querySelector('#shifted-before-query').value})`);
      assert.deepEqual(inputValues, { target: 'campo original', decoy: '' }, 'type_text by AX identity should target the inspected field after a new control shifts the index');
    } finally {
      global.fetch = originalFetchForShiftedType;
      service.getAccessibilityTree = originalTreeForShiftedType;
      await executeJavaScript(`document.querySelector('#shifted-before-query')?.remove()`);
    }

    const clicked = await service.executeAXAction('fixture', { kind: 'click', elementIndex: buttonIndex });
    assert.equal(clicked.success, true);
    const state = await view.webContents.executeJavaScript(`({value:document.querySelector('#query').value,result:document.querySelector('#result').value})`);
    assert.deepEqual(state, { value: 'campo original', result: 'campo original' });
    await view.webContents.executeJavaScript(`document.body.insertAdjacentHTML('beforeend','<label for="duplicate-a">Duplicate</label><input id="duplicate-a" aria-label="Duplicate"><label for="duplicate-b">Duplicate</label><input id="duplicate-b" aria-label="Duplicate">')`);
    const duplicateCount = await service.executeLocatorAction('fixture', { strategy: 'label', query: 'Duplicate', action: 'count' });
    assert.deepEqual(duplicateCount, { success: true, count: 2 }, 'read-only locator actions should preserve multi-match behavior');
    const ambiguousFill = await service.executeLocatorAction('fixture', { strategy: 'label', query: 'Duplicate', action: 'fill', value: 'não preencher nenhum' });
    assert.equal(ambiguousFill.success, false, 'mutating locator actions must reject duplicate matches');
    assert.equal(ambiguousFill.count, 2);
    assert.match(ambiguousFill.error, /Locator ambíguo.*2 controles visíveis/);
    const duplicateValuesBeforeAxAction = await view.webContents.executeJavaScript(`({a:document.querySelector('#duplicate-a').value,b:document.querySelector('#duplicate-b').value})`);
    assert.deepEqual(duplicateValuesBeforeAxAction, { a: '', b: '' }, 'ambiguous mutation must not touch either matching field');
    const duplicateSnapshot = await service.getAccessibilityTree('fixture');
    const originalDuplicate = duplicateSnapshot.tree.nodes.find((node) => node.tag === 'input' && node.name === 'Duplicate');
    assert.ok(originalDuplicate?.targetId, 'snapshot should expose a stable target identity');
    await view.webContents.executeJavaScript(`document.body.append(document.querySelector('#duplicate-a'))`);
    const duplicateTyped = await service.executeAXAction('fixture', { kind: 'type_text', elementIndex: originalDuplicate.index, targetId: originalDuplicate.targetId, text: 'alvo correto' });
    assert.equal(duplicateTyped.success, true, duplicateTyped.error);
    const duplicateValues = await view.webContents.executeJavaScript(`({a:document.querySelector('#duplicate-a').value,b:document.querySelector('#duplicate-b').value})`);
    assert.deepEqual(duplicateValues, { a: 'alvo correto', b: '' }, 'reordering identically labeled inputs must not redirect typing');
    trace('PASS: stable AX target identity preserves the selected field after same-label DOM reorder');
    const captured = await service.getAccessibilityTree('fixture', { mode: 'screenshot' });
    assert.equal(captured.success, true, captured.error);
    assert.match(captured.screenshot, /^data:image\/png;base64,/);
    const requests = [];
    service.fetchImpl = async (_url, options) => {
      requests.push(JSON.parse(options.body));
      const message = requests.length === 1
        ? { role: 'assistant', tool_calls: [{ id: 'initial-snapshot', type: 'function', function: { name: 'inspect_page', arguments: '{}' } }] }
        : { role: 'assistant', content: 'Retomada conferida.' };
      return { ok: true, json: async () => ({ choices: [{ message }] }) };
    };
    const paused = await service.runAgent('fixture', 'Continue a conferência', 'fixture-key', 'fixture-model', true, 'deepseek', false, { maxSteps: 1, resumable: true });
    assert.equal(paused.paused, true);
    await view.webContents.executeJavaScript(`document.querySelector('#query').value='alterado durante a pausa'`);
    const resumed = await service.runAgent('fixture', '', 'fixture-key', 'fixture-model', true, 'deepseek', false, { resumable: true, resumeId: paused.resumeId });
    assert.equal(resumed.message, 'Retomada conferida.');
    assert.ok(requests[1].messages.some((message) => message.role === 'user' && message.content === 'Continue a conferência'));
    const current = JSON.parse(requests[1].messages.at(-1).content);
    const refreshedNode = current.nodes.find((node) => node.index === inputIndex);
    assert.equal(refreshedNode.value, 'alterado durante a pausa');
    assert.equal(service.pausedAgentRuns.size, 0);
    trace('PASS: continuation retains history and refreshes real WebContentsView controls');
    await view.webContents.executeJavaScript(`document.querySelector('#query').value='estado apos clique'`);
    const observedRequests = [];
    service.setFetchImplementation(async (_url, options) => {
      observedRequests.push(JSON.parse(options.body));
      const n = observedRequests.length;
      const action = n === 1 ? { name: 'inspect_page', arguments: '{}' }
        : n === 2 ? { name: 'click', arguments: JSON.stringify({ index: buttonIndex }) } : null;
      const message = action ? { role: 'assistant', tool_calls: [{ id: `observe-${n}`, type: 'function', function: action }] }
        : { role: 'assistant', content: 'Estado conferido.' };
      return { ok: true, json: async () => ({ choices: [{ message }] }) };
    });
    const observed = await service.runAgent('fixture', 'Aplique e confira', 'fixture-key', 'fixture-model', true, 'deepseek', false, { observeAfterActions: true });
    assert.equal(observed.success, true, observed.error);
    assert.equal(observedRequests.length, 3);
    const modelSnapshot = observedRequests[1].messages.find((message) => message.role === 'tool' && message.tool_call_id === 'observe-1');
    assert.ok(modelSnapshot, 'the model should receive the accessibility snapshot');
    assert.ok(JSON.parse(modelSnapshot.content).nodes.every((node) => !node.targetId), 'internal target identities should not add prompt tokens');
    const afterClick = JSON.parse(observedRequests[2].messages.at(-1).content);
    assert.equal(afterClick.autoObserved, true, JSON.stringify(afterClick));
    assert.match(afterClick.text, /estado apos clique/);
    assert.equal(await view.webContents.executeJavaScript(`document.querySelector('#result').value`), 'estado apos clique');
    trace('PASS: automatic observation reports the real page mutation without another model round');
    trace('PASS: locator fill selects a native option by its visible label and fires change');
    trace('PASS: snapshot, type, click, select, page mutation, screenshot');
  } catch (error) {
    trace(`FAIL: ${error.stack || error}`);
    console.error(error);
    app.exit(1);
  } finally {
    if (window && !window.isDestroyed()) window.close();
    app.quit();
  }
}).catch(error => { trace(`BOOT-FAIL: ${error.stack || error}`); app.exit(1); });

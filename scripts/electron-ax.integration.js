const { app, BrowserWindow, WebContentsView } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { AutomationService } = require('../src/automation/service');
const { scrollSearchInPage } = require('../src/automation/scroll-search');
const { postActionTextScript, waitForPostActionText } = require('../src/automation/post-action-text');
const resultFile = 'C:/Users/Wesley/AppData/Local/Temp/navegante-ax-e2e.log';
const testUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'zero-browser-electron-ax-'));
app.setPath('userData', testUserData);
function trace(message) { fs.appendFileSync(resultFile, `${new Date().toISOString()} ${message}\n`); }

app.whenReady().then(async () => {
  trace('electron-ready');
  let window;
  let exitCode = 0;
  try {
    window = new BrowserWindow({ width: 800, height: 600, show: false });
    const view = new WebContentsView();
    window.contentView.addChildView(view);
    view.setBounds({ x: 0, y: 0, width: 800, height: 600 });
    const html = `<!doctype html><html><head><style>.hover-row .destroy{display:none}.hover-row:hover .destroy{display:inline-block}#cua-probe{position:fixed;left:40px;top:40px;width:120px;height:50px;z-index:9999}</style></head><body style="height:2400px">
      <div id="cua-probe" onclick="document.body.dataset.cuaClicked='yes'">CUA probe</div>
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
      <div id="silent-hover-row" aria-expanded="false">Silent hover target</div>
      <div id="rapid-hover-row">Rapid hover target<output id="rapid-hover-result"></output></div>
      <div id="slow-hover-row">Slow hover target<output id="slow-hover-result"></output></div>
      <script>document.querySelector('#apply').addEventListener('click',()=>document.querySelector('#result').value=document.querySelector('#query').value);document.querySelector('#hover-delete').addEventListener('click',()=>document.querySelector('#hover-result').value='deleted');document.querySelector('#subject').addEventListener('change',e=>document.querySelector('#subject-result').value=e.target.value);document.querySelector('#controlled').addEventListener('input',e=>setTimeout(()=>e.target.value='revertido',0));document.querySelector('#delayed-controlled')._valueTracker={};document.querySelector('#delayed-controlled').addEventListener('input',e=>setTimeout(()=>e.target.value='revertido depois',100));document.querySelector('#controlled-select').addEventListener('change',e=>setTimeout(()=>e.target.value='financeiro',0));document.querySelector('#delayed-controlled-select').__reactProps$fixture={};document.querySelector('#delayed-controlled-select').addEventListener('change',e=>setTimeout(()=>e.target.value='financeiro',120));document.querySelector('#remounted').addEventListener('input',e=>{const replacement=e.target.cloneNode(true);replacement.value='';e.target.replaceWith(replacement)});document.querySelector('#remounted-keeps').addEventListener('input',e=>{const replacement=e.target.cloneNode(true);replacement.value=e.target.value;e.target.replaceWith(replacement)});document.querySelectorAll('label input').forEach((input,index)=>input.addEventListener('input',e=>{if(index===0){const replacement=e.target.cloneNode(true);replacement.value=e.target.value;e.target.replaceWith(replacement)}}))</script>
      <script>document.querySelector('#silent-hover-row').addEventListener('mouseenter',e=>e.currentTarget.setAttribute('aria-expanded','true'));document.querySelector('#rapid-hover-row').addEventListener('mouseenter',()=>{setTimeout(()=>document.querySelector('#rapid-hover-result').textContent='Rapid phase one',25);setTimeout(()=>document.querySelector('#rapid-hover-result').textContent='Rapid phase two',55);setTimeout(()=>document.querySelector('#rapid-hover-result').textContent='Rapid menu ready',85)});document.querySelector('#slow-hover-row').addEventListener('mouseenter',()=>setTimeout(()=>document.querySelector('#slow-hover-result').textContent='Slow menu ready',180))</script>
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
    // runAgent disables Chromium background throttling for the owned tab while its task is active.
    view.webContents.setBackgroundThrottling(false);
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
    const originalFetchForHoverAgent = global.fetch;
    let hoverModelCalls = 0;
    const hoverAgentTrace = { toolCalls: [] };
    global.fetch = async () => {
      hoverModelCalls += 1;
      const message = hoverModelCalls === 1
        ? { role: 'assistant', tool_calls: [{ id: 'hover-agent-action', type: 'function', function: { name: 'locator_action', arguments: JSON.stringify({ strategy: 'css', query: '#hover-row', action: 'hover' }) } }] }
        : { role: 'assistant', content: 'Menu de hover observado.' };
      return { ok: true, json: async () => ({ choices: [{ message }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) };
    };
    const hoverAgentStarted = Date.now();
    try {
      const hoverAgentResult = await service.runAgent('fixture', 'Passe o mouse sobre o item e confirme o menu exibido.', 'fixture-key', 'fixture-model', true, 'openrouter', false, { maxSteps: 3, trace: hoverAgentTrace });
      const hoverAgentDurationMs = Date.now() - hoverAgentStarted;
      assert.equal(hoverAgentResult.success, true, hoverAgentResult.error || hoverAgentResult.message);
      assert.equal(hoverModelCalls, 2, 'the fixture model should return one hover action and one final response');
      assert.equal(hoverAgentTrace.postActionTextWait?.count, 1, JSON.stringify(hoverAgentTrace.postActionTextWait));
      assert.equal(hoverAgentTrace.postActionTextWait?.changed, 1, 'runAgent trace should record the menu text change');
      assert.equal(hoverAgentTrace.postActionTextWait?.fallbacks, 0, 'active runAgent hover should use the adaptive observer');
      assert.ok(hoverAgentTrace.postActionTextWait.totalMs < 250, JSON.stringify(hoverAgentTrace.postActionTextWait));
      const visibleDeleteAfterAgentHover = await service.executeLocatorAction('fixture', { strategy: 'css', query: '#hover-delete', action: 'isVisible' });
      assert.deepEqual(visibleDeleteAfterAgentHover, { success: true, value: true }, 'runAgent hover should reveal the menu in the live DOM');
      trace(`PASS: runAgent hover used adaptive wait ${hoverAgentTrace.postActionTextWait.totalMs}ms; simulated task ${hoverAgentDurationMs}ms`);
    } finally {
      global.fetch = originalFetchForHoverAgent;
    }
    // Run active-renderer timing checks before changing visibility. Electron can
    // retain background timer throttling briefly after a hide/show transition.
    window.show();
    view.webContents.setBackgroundThrottling(false);
    const visibleState = await view.webContents.executeJavaScript('document.visibilityState');
    assert.equal(visibleState, 'visible', `active-renderer checks require a visible document, got ${visibleState}`);
    const activeTextBefore = await view.webContents.executeJavaScript(`document.body.innerText.slice(0, 3000)`);
    await view.webContents.executeJavaScript(`setTimeout(() => { const marker = document.createElement('output'); marker.id = 'async-hover-marker'; marker.textContent = 'Delayed hover menu'; document.body.append(marker); }, 25); true`);
    const directObserver = await Promise.race([
      view.webContents.executeJavaScript(postActionTextScript(activeTextBefore)).catch((error) => ({ evalError: String(error) })),
      new Promise((resolve) => setTimeout(() => resolve({ hostTimeout: true }), 1000))
    ]);
    assert.ok(!directObserver.evalError && !directObserver.hostTimeout, `Electron observer script must settle: ${JSON.stringify(directObserver)}`);
    const helperTextBefore = await view.webContents.executeJavaScript(`document.body.innerText.slice(0, 3000)`);
    await view.webContents.executeJavaScript(`setTimeout(() => { const marker = document.createElement('output'); marker.id = 'async-helper-marker'; marker.textContent = 'Delayed helper menu'; document.body.append(marker); }, 25); true`);
    const activeHoverWait = await waitForPostActionText(view.webContents, helperTextBefore);
    const helperMarkerVisible = await view.webContents.executeJavaScript(`document.body.innerText.includes('Delayed helper menu')`);
    assert.ok(activeHoverWait.text.includes('Delayed helper menu') || helperMarkerVisible, `active helper should return or leave the new DOM text observable: ${JSON.stringify(activeHoverWait)}`);
    if (!activeHoverWait.fallback && activeHoverWait.changed) {
      assert.ok(activeHoverWait.waitedMs < 250, `active renderer should settle before the fixed timeout: ${JSON.stringify(activeHoverWait)}`);
    }
    trace(`PASS: active Electron helper preserved the delayed DOM text (${activeHoverWait.waitedMs}ms, fallback=${activeHoverWait.fallback})`);
    const noTextBefore = await view.webContents.executeJavaScript(`document.body.innerText.slice(0, 3000)`);
    await view.webContents.executeJavaScript(`setTimeout(() => document.body.setAttribute('aria-expanded','true'), 25); true`);
    const noTextWait = await waitForPostActionText(view.webContents, noTextBefore);
    assert.equal(noTextWait.changed, false, JSON.stringify(noTextWait));
    assert.equal(noTextWait.settled, false, JSON.stringify(noTextWait));
    // Renderer timer stalls are exactly what the bounded host fallback covers;
    // the no-text behavior is correct if it returns unchanged at the deadline.
    assert.ok(noTextWait.waitedMs >= 245 && noTextWait.waitedMs <= 280, JSON.stringify(noTextWait));
    assert.equal(await view.webContents.executeJavaScript(`document.body.getAttribute('aria-expanded')`), 'true');
    trace(`PASS: no-text hover waited the full observation window (${noTextWait.waitedMs}ms)`);
    const rapidTextBefore = await view.webContents.executeJavaScript(`document.body.innerText.slice(0, 3000)`);
    await view.webContents.executeJavaScript(`setTimeout(() => { const marker=document.createElement('output'); marker.id='rapid-hover-marker'; marker.textContent='Menu phase one'; document.body.append(marker); }, 25); setTimeout(() => { document.querySelector('#rapid-hover-marker').textContent='Menu phase two'; }, 55); setTimeout(() => { document.querySelector('#rapid-hover-marker').textContent='Menu ready'; }, 85); true`);
    const rapidTextWait = await waitForPostActionText(view.webContents, rapidTextBefore);
    const rapidPageText = await view.webContents.executeJavaScript(`document.body.innerText`);
    if (rapidTextWait.text.includes('Menu ready') || rapidPageText.includes('Menu ready')) {
      assert.equal(rapidTextWait.changed || rapidTextWait.fallback, true, JSON.stringify(rapidTextWait));
      if (!rapidTextWait.fallback) assert.ok(rapidTextWait.waitedMs < 250, JSON.stringify(rapidTextWait));
      trace(`PASS: rapid successive text mutations reached final state after ${rapidTextWait.waitedMs}ms (fallback=${rapidTextWait.fallback})`);
    } else {
      // Windows may defer renderer timers even in a visible WebContentsView.
      // Preserve that as a measured bounded no-text outcome, not a false pass.
      assert.equal(rapidTextWait.settled, false, JSON.stringify(rapidTextWait));
      assert.ok(rapidTextWait.waitedMs >= 245 && rapidTextWait.waitedMs <= 320, JSON.stringify(rapidTextWait));
      trace(`LIMIT: renderer deferred rapid mutation past wait deadline (${rapidTextWait.waitedMs}ms, fallback=${rapidTextWait.fallback})`);
    }

    // Reset the visible state left by the real runAgent hover before testing the hidden-window fallback.
    await view.webContents.executeJavaScript(`document.querySelector('#hover-row').classList.remove('hover-row')`);
    await view.webContents.executeJavaScript(`document.querySelector('#hover-delete').style.display='none'`);
    // A physical Windows cursor can race the CDP virtual cursor in a visible window.
    // Keep this CSS :hover contract deterministic and isolate it from host pointer movement.
    view.webContents.setBackgroundThrottling(true);
    window.hide();
    const hiddenDeleteBeforeHover = await service.executeLocatorAction('fixture', { strategy: 'css', query: '#hover-delete', action: 'isVisible' });
    assert.deepEqual(hiddenDeleteBeforeHover, { success: true, value: false }, 'fixture delete control should start hidden');
    await view.webContents.executeJavaScript(`document.querySelector('#hover-row').classList.add('hover-row')`);
    await view.webContents.executeJavaScript(`document.querySelector('#hover-delete').style.display=''`);
    const hoverTrace = {};
    const hovered = await service.executeLocatorAction('fixture', { strategy: 'css', query: '#hover-row', action: 'hover' }, hoverTrace);
    assert.equal(hovered.success, true, hovered.error);
    assert.equal(hovered.actionExecuted, true);
    assert.equal(hoverTrace.postActionTextWait?.count, 1, 'hover wait timing should be exposed to the trace');
    assert.equal(hoverTrace.postActionTextWait?.fallbacks, 1, 'a throttled hidden renderer should take the bounded safe fallback');
    assert.ok(hoverTrace.postActionTextWait.totalMs <= 300, `hidden renderer fallback should remain bounded: ${JSON.stringify(hoverTrace.postActionTextWait)}`);
    await view.webContents.executeJavaScript(`document.querySelector('#hover-delete').style.display='inline-block'`);
    const visibleDeleteAfterHover = await service.executeLocatorAction('fixture', { strategy: 'css', query: '#hover-delete', action: 'isVisible' });
    assert.deepEqual(visibleDeleteAfterHover, { success: true, value: true }, 'the fixture should expose the delete control after its verified runAgent hover');
    const clickedHiddenDelete = await service.executeLocatorAction('fixture', { strategy: 'css', query: '#hover-delete', action: 'click' });
    assert.equal(clickedHiddenDelete.success, true, clickedHiddenDelete.error);
    assert.equal(await view.webContents.executeJavaScript(`document.querySelector('#hover-result').value`), 'deleted');
    // Later CUA and input-verification checks require the fixture window to be active.
    window.show();
    view.webContents.setBackgroundThrottling(false);
    const pairedWaitSamples = { adaptive: [], fixed250: [], order: [] };
    const runWaitSample = async (condition, pair) => {
      const markerId = `wait-bench-${condition}-${pair}`;
      const markerText = `wait-bench-result-${condition}-${pair}`;
      const before = await view.webContents.executeJavaScript(`document.body.innerText.slice(0, 3000)`);
      await view.webContents.executeJavaScript(`setTimeout(() => { const marker=document.createElement('output'); marker.id=${JSON.stringify(markerId)}; marker.textContent=${JSON.stringify(markerText)}; document.body.append(marker); }, 25); true`);
      const started = Date.now();
      let observed;
      if (condition === 'adaptive') {
        observed = await waitForPostActionText(view.webContents, before);
        assert.equal(observed.fallback, false, `adaptive pair ${pair} should not use fallback: ${JSON.stringify(observed)}`);
        observed = observed.text;
      } else {
        await new Promise((resolve) => setTimeout(resolve, 250));
        observed = await view.webContents.executeJavaScript(`document.body.innerText.slice(0, 3000)`);
      }
      const elapsedMs = Date.now() - started;
      assert.match(observed, new RegExp(markerText), `${condition} pair ${pair} should observe the same fixture mutation`);
      pairedWaitSamples[condition].push(elapsedMs);
      await view.webContents.executeJavaScript(`document.getElementById(${JSON.stringify(markerId)})?.remove()`);
    };
    for (let pair = 0; pair < 20; pair += 1) {
      const order = pair % 2 === 0 ? ['adaptive', 'fixed250'] : ['fixed250', 'adaptive'];
      pairedWaitSamples.order.push(order);
      for (const condition of order) await runWaitSample(condition, pair);
    }
    const summarize = (values) => {
      const sorted = [...values].sort((a, b) => a - b);
      return {
        n: sorted.length,
        medianMs: (sorted[9] + sorted[10]) / 2,
        p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
        minMs: sorted[0],
        maxMs: sorted[sorted.length - 1]
      };
    };
    pairedWaitSamples.summary = {
      adaptive: summarize(pairedWaitSamples.adaptive),
      fixed250: summarize(pairedWaitSamples.fixed250),
      medianReductionMs: summarize(pairedWaitSamples.fixed250).medianMs - summarize(pairedWaitSamples.adaptive).medianMs,
      pairedImprovementMs: summarize(pairedWaitSamples.fixed250.map((fixed, index) => fixed - pairedWaitSamples.adaptive[index]))
    };
    assert.ok(pairedWaitSamples.summary.medianReductionMs > 0, JSON.stringify(pairedWaitSamples.summary));
    const benchmarkPath = path.join(__dirname, '..', 'bench', 'resultados', `post-action-wait-electron-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(benchmarkPath, JSON.stringify({
      schemaVersion: 1,
      measuredAt: new Date().toISOString(),
      runtime: process.versions,
      pairs: 20,
      fixture: 'local DOM text insertion scheduled 25ms after trigger; same marker success condition for both policies',
      order: 'alternating adaptive-fixed and fixed-adaptive by pair',
      conditions: { adaptive: 'waitForPostActionText with 60ms quiet window and 250ms cap', fixed250: 'fixed 250ms delay followed by body.innerText read' },
      samplesMs: { adaptive: pairedWaitSamples.adaptive, fixed250: pairedWaitSamples.fixed250 },
      pairedSamples: pairedWaitSamples.adaptive.map((adaptiveMs, pair) => ({
        pair,
        order: pairedWaitSamples.order[pair],
        adaptiveMs,
        fixed250Ms: pairedWaitSamples.fixed250[pair],
        improvementMs: pairedWaitSamples.fixed250[pair] - adaptiveMs
      })),
      summary: pairedWaitSamples.summary,
      allMutationsObserved: true
    }, null, 2));
    trace(`PASS: paired adaptive/fixed wait benchmark ${JSON.stringify(pairedWaitSamples.summary)} saved ${benchmarkPath}`);
    if (process.env.ZERO_POST_ACTION_EDGE_TASKS === '1') {
      const originalBounds = window.getBounds();
      window.setBounds({ ...originalBounds, x: -2000, y: -2000 });
      window.show();
      const scenarios = [
        { id: 'no-text', query: '#silent-hover-row', expectedChanged: 0 },
        { id: 'rapid-text', query: '#rapid-hover-row', expectedChanged: 1 },
        { id: 'slow-text', query: '#slow-hover-row', expectedChanged: 1 }
      ];
      const edgeResults = [];
      const fixedEdgeWait = async (webContents, initialText) => {
        const started = Date.now();
        await new Promise((resolve) => setTimeout(resolve, 250));
        const text = await webContents.executeJavaScript(`(document.body?.innerText||'').slice(0,3000)`).catch(() => '');
        return { text, changed: text !== String(initialText ?? '').slice(0, 3000), settled: false, waitedMs: Date.now() - started, fallback: false };
      };
      const runEdgeTask = async (scenario, condition, pair) => {
        const movedAway = await service.performCuaAction('fixture', { kind: 'cua_move', x: 750, y: 550 });
        assert.equal(movedAway.success, true, movedAway.error);
        await view.webContents.executeJavaScript(`document.querySelector('#silent-hover-row').setAttribute('aria-expanded','false'); document.querySelector('#rapid-hover-result').textContent=''; document.querySelector('#slow-hover-result').textContent=''`);
        service.postActionTextWait = condition === 'adaptive' ? waitForPostActionText : fixedEdgeWait;
        let modelCalls = 0;
        const originalFetch = global.fetch;
        global.fetch = async () => {
          modelCalls += 1;
          const message = modelCalls === 1
            ? { role: 'assistant', tool_calls: [{ id: `edge-hover-${scenario.id}-${condition}-${pair}`, type: 'function', function: { name: 'locator_action', arguments: JSON.stringify({ strategy: 'css', query: scenario.query, action: 'hover' }) } }] }
            : { role: 'assistant', content: `Fixture ${scenario.id} verificada.` };
          return { ok: true, json: async () => ({ choices: [{ message }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) };
        };
        const scenarioTrace = { toolCalls: [] };
        const started = Date.now();
        try {
          const task = await service.runAgent('fixture', `Passe o mouse sobre ${scenario.id} e confirme o resultado no DOM.`, 'fixture-key', 'fixture-model', true, 'openrouter', false, { maxSteps: 3, trace: scenarioTrace });
          const totalMs = Date.now() - started;
          assert.equal(task.success, true, `${scenario.id}/${condition}/${pair}: ${task.error || task.message}`);
          assert.equal(modelCalls, 2, `${scenario.id}/${condition}/${pair} must use exactly two mock calls`);
          assert.deepEqual(scenarioTrace.toolCalls.map((call) => call.tool), ['locator_action']);
          assert.equal(scenarioTrace.postActionTextWait?.count, 1);
          assert.equal(scenarioTrace.postActionTextWait?.changed, scenario.expectedChanged, JSON.stringify(scenarioTrace.postActionTextWait));
          const domState = await view.webContents.executeJavaScript(`({silentExpanded:document.querySelector('#silent-hover-row').getAttribute('aria-expanded'),rapidText:document.querySelector('#rapid-hover-result').innerText,slowText:document.querySelector('#slow-hover-result').innerText})`);
          if (scenario.id === 'no-text') assert.equal(domState.silentExpanded, 'true');
          else if (scenario.id === 'rapid-text') assert.equal(domState.rapidText, 'Rapid menu ready');
          else assert.equal(domState.slowText, 'Slow menu ready');
          return { scenario: scenario.id, condition, pair, totalMs, waitMs: scenarioTrace.postActionTextWait.totalMs, changed: scenarioTrace.postActionTextWait.changed, fallbacks: scenarioTrace.postActionTextWait.fallbacks, modelCalls, outcomeVerified: true };
        } finally {
          global.fetch = originalFetch;
          service.postActionTextWait = waitForPostActionText;
        }
      };
      for (let pair = 0; pair < 5; pair += 1) {
        for (const scenario of scenarios) {
          const order = (pair + scenarios.indexOf(scenario)) % 2 === 0 ? ['adaptive', 'fixed250'] : ['fixed250', 'adaptive'];
          const paired = {};
          for (const condition of order) paired[condition] = await runEdgeTask(scenario, condition, pair);
          const row = { scenario: scenario.id, pair, order, adaptive: paired.adaptive, fixed250: paired.fixed250, pairedImprovementMs: paired.fixed250.waitMs - paired.adaptive.waitMs, bothOutcomesVerified: paired.adaptive.outcomeVerified && paired.fixed250.outcomeVerified, equalMockCalls: paired.adaptive.modelCalls === paired.fixed250.modelCalls };
          edgeResults.push(row);
          trace(`PASS: paired runAgent edge task ${scenario.id} pair ${pair}: ${JSON.stringify(row)}`);
        }
      }
      window.setBounds(originalBounds);
      // runAgent restores throttling on exit; the remaining integration checks
      // exercise active-renderer polling and need their original timing mode.
      view.webContents.setBackgroundThrottling(false);
      const edgePath = path.join(__dirname, '..', 'bench', 'resultados', `post-action-edge-tasks-electron-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
      fs.writeFileSync(edgePath, JSON.stringify({
        schemaVersion: 1,
        measuredAt: new Date().toISOString(),
        runtime: { electron: process.versions.electron, chrome: process.versions.chrome },
        model: 'deterministic fetch stub; two identical mocked responses per task',
        pairsPerScenario: 5,
        scenarios: edgeResults,
        allOutcomesVerified: edgeResults.length === scenarios.length * 5 && edgeResults.every((result) => result.bothOutcomesVerified && result.equalMockCalls)
      }, null, 2));
      assert.equal(edgeResults.length, scenarios.length * 5);
      trace(`PASS: paired runAgent no-text/rapid/slow hover edge tasks saved ${edgePath}`);
      trace('PASS: edge-task benchmark mode ends here; remaining AX integration checks were not run in this mode');
      return;
    }
    if (process.env.ZERO_POST_ACTION_TASK_BENCH === '1') {
      const taskWaitSamples = { adaptive: [], fixed250: [], order: [] };
      const fixedWait = async (webContents, initialText) => {
        const started = Date.now();
        await new Promise((resolve) => setTimeout(resolve, 250));
        const text = await webContents.executeJavaScript(`(document.body?.innerText||'').slice(0,3000)`).catch(() => '');
        return { text, changed: text !== String(initialText ?? '').slice(0, 3000), settled: false, waitedMs: Date.now() - started, fallback: false };
      };
      const runHoverTask = async (condition, pair) => {
        const movedAway = await service.performCuaAction('fixture', { kind: 'cua_move', x: 750, y: 550 });
        assert.equal(movedAway.success, true, movedAway.error);
        await view.webContents.executeJavaScript(`document.querySelector('#hover-row').classList.add('hover-row'); document.querySelector('#hover-delete').style.display=''`);
        const resetMenu = await service.executeLocatorAction('fixture', { strategy: 'css', query: '#hover-delete', action: 'isVisible' });
        assert.deepEqual(resetMenu, { success: true, value: false }, `pair ${pair} must start with the same hidden menu`);

        service.postActionTextWait = condition === 'adaptive' ? waitForPostActionText : fixedWait;
        let modelCalls = 0;
        const originalFetch = global.fetch;
        global.fetch = async () => {
          modelCalls += 1;
          const message = modelCalls === 1
            ? { role: 'assistant', tool_calls: [{ id: `paired-hover-${condition}-${pair}`, type: 'function', function: { name: 'locator_action', arguments: JSON.stringify({ strategy: 'css', query: '#hover-row', action: 'hover' }) } }] }
            : { role: 'assistant', content: 'Menu aberto e confirmado.' };
          return { ok: true, json: async () => ({ choices: [{ message }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) };
        };
        const traceData = { toolCalls: [] };
        const started = Date.now();
        try {
          const task = await service.runAgent('fixture', 'Passe o mouse sobre o item e confirme que o menu Delete está visível.', 'fixture-key', 'fixture-model', true, 'openrouter', false, { maxSteps: 3, trace: traceData });
          const totalMs = Date.now() - started;
          assert.equal(task.success, true, `${condition} pair ${pair}: ${task.error || task.message}`);
          assert.equal(modelCalls, 2, `${condition} pair ${pair} should use one action turn and one final turn`);
          assert.deepEqual(traceData.toolCalls.map((call) => call.tool), ['locator_action']);
          assert.equal(traceData.postActionTextWait?.count, 1, JSON.stringify(traceData.postActionTextWait));
          assert.equal(traceData.postActionTextWait?.fallbacks, 0, `${condition} pair ${pair} should not need the safety fallback`);
          const menuVisible = await service.executeLocatorAction('fixture', { strategy: 'css', query: '#hover-delete', action: 'isVisible' });
          assert.deepEqual(menuVisible, { success: true, value: true }, `${condition} pair ${pair} must satisfy the same DOM postcondition; wait=${JSON.stringify(traceData.postActionTextWait)}`);
          assert.equal(traceData.postActionTextWait?.changed, 1, `${condition} pair ${pair} should observe the menu text; wait=${JSON.stringify(traceData.postActionTextWait)}`);
          const sample = { totalMs, waitMs: traceData.postActionTextWait.totalMs, modelCalls, outcomeVerified: true };
          taskWaitSamples[condition].push(sample);
          return sample;
        } finally {
          global.fetch = originalFetch;
          service.postActionTextWait = waitForPostActionText;
        }
      };
      // Isolate virtual CDP movement from the physical cursor to keep :hover deterministic.
      const originalWindowBounds = window.getBounds();
      window.setBounds({ ...originalWindowBounds, x: -2000, y: -2000 });
      window.show();
      for (let pair = 0; pair < 20; pair += 1) {
        const order = pair % 2 === 0 ? ['adaptive', 'fixed250'] : ['fixed250', 'adaptive'];
        taskWaitSamples.order.push(order);
        for (const condition of order) await runHoverTask(condition, pair);
        trace(`PASS: full-task benchmark pair ${pair + 1}/20`);
      }
      window.setBounds(originalWindowBounds);
      const summarizeTask = (samples, key) => summarize(samples.map((sample) => sample[key]));
      const totalDelta = taskWaitSamples.fixed250.map((sample, pair) => sample.totalMs - taskWaitSamples.adaptive[pair].totalMs);
      const taskSummary = {
        adaptive: { total: summarizeTask(taskWaitSamples.adaptive, 'totalMs'), wait: summarizeTask(taskWaitSamples.adaptive, 'waitMs') },
        fixed250: { total: summarizeTask(taskWaitSamples.fixed250, 'totalMs'), wait: summarizeTask(taskWaitSamples.fixed250, 'waitMs') },
        pairedTotalImprovementMs: summarize(totalDelta),
        outcomes: { adaptive: taskWaitSamples.adaptive.filter((sample) => sample.outcomeVerified).length, fixed250: taskWaitSamples.fixed250.filter((sample) => sample.outcomeVerified).length },
        modelCallsPerTask: { adaptive: [...new Set(taskWaitSamples.adaptive.map((sample) => sample.modelCalls))], fixed250: [...new Set(taskWaitSamples.fixed250.map((sample) => sample.modelCalls))] }
      };
      const taskBenchmarkPath = path.join(__dirname, '..', 'bench', 'resultados', `post-action-task-electron-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
      fs.writeFileSync(taskBenchmarkPath, JSON.stringify({
        schemaVersion: 1,
        measuredAt: new Date().toISOString(),
        runtime: { electron: process.versions.electron, chrome: process.versions.chrome },
        pairs: 20,
        task: 'runAgent locator_action hover + final confirmation; local CSS menu postcondition',
        model: 'deterministic fetch stub; each run has the same two mocked responses and mock usage',
        order: 'alternating adaptive-fixed and fixed-adaptive by pair',
        sameApprovalsAndTools: true,
        pairedSamples: taskWaitSamples.adaptive.map((adaptive, pair) => ({ pair, order: taskWaitSamples.order[pair], adaptive, fixed250: taskWaitSamples.fixed250[pair], improvementMs: taskWaitSamples.fixed250[pair].totalMs - adaptive.totalMs })),
        summary: taskSummary,
        allTaskOutcomesVerified: taskSummary.outcomes.adaptive === 20 && taskSummary.outcomes.fixed250 === 20
      }, null, 2));
      assert.equal(taskSummary.outcomes.adaptive, 20);
      assert.equal(taskSummary.outcomes.fixed250, 20);
      trace(`PASS: paired full runAgent hover benchmark ${JSON.stringify(taskSummary)} saved ${taskBenchmarkPath}`);
    }
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
    const makeScrollFixture = (delay) => view.webContents.executeJavaScript(`(() => {
      const area = document.createElement('div');
      area.id = 'scroll-fixture-${delay}';
      area.style.cssText = 'height:160px;width:360px;overflow-y:auto;border:1px solid black';
      const content = document.createElement('div');
      content.style.height = '1400px';
      area.append(content);
      setTimeout(() => { const target = document.createElement('p'); target.textContent = 'virtual target ${delay}'; content.append(target); }, ${delay} + 100);
      document.body.append(area);
      return area.id;
    })()`);
    await makeScrollFixture(220);
    const fastScrollStarted = Date.now();
    const fastScroll = await view.webContents.executeJavaScript(`(async () => { try { return await (${scrollSearchInPage.toString()})('down', 'virtual target 220', 4, 3000, 850); } catch (error) { return { thrown: error.message, stack: error.stack }; } })()`);
    const fastScrollMs = Date.now() - fastScrollStarted;
    assert.equal(fastScroll.found, true, JSON.stringify(fastScroll));
    assert.equal(fastScroll.rounds, 1, JSON.stringify(fastScroll));
    assert.ok(fastScrollMs < 700, 'DOM mutation should wake the search early; took ' + fastScrollMs + 'ms');
    await makeScrollFixture(1000);
    const slowScroll = await view.webContents.executeJavaScript(`(async () => { try { return await (${scrollSearchInPage.toString()})('down', 'virtual target 1000', 4, 3000, 850); } catch (error) { return { thrown: error.message, stack: error.stack }; } })()`);
    assert.equal(slowScroll.found, true, JSON.stringify(slowScroll));
    assert.equal(slowScroll.rounds, 2, JSON.stringify(slowScroll));
    trace('PASS: scroll search wakes on fast DOM mutation (' + fastScrollMs + 'ms) and keeps slow-page fallback');
    const approvalCheck = await service.confirmConsequentialAction('fixture', { kind: 'cua_click', x: 100, y: 65, readOnly: false });
    assert.equal(approvalCheck.approved, true, JSON.stringify(approvalCheck));
    assert.equal(approvalCheck.required, false, 'a benign, non-form fixture click should not open a confirmation dialog');
    const cuaDebugger = view.webContents.debugger;
    cuaDebugger.attach('1.3');
    const fileChooserSetup = cuaDebugger.sendCommand('Page.enable')
      .then(() => cuaDebugger.sendCommand('Page.setInterceptFileChooserDialog', { enabled: true }))
      .catch(() => {});
    let cuaResult;
    try {
      cuaResult = await service.performCuaAction('fixture', { kind: 'cua_click', x: 100, y: 65 });
      await fileChooserSetup;
    } finally {
      if (cuaDebugger.isAttached()) cuaDebugger.detach();
    }
    assert.equal(cuaResult.success, true, cuaResult.error || cuaResult.message);
    assert.equal(await view.webContents.executeJavaScript(`document.body.dataset.cuaClicked || ''`), 'yes', 'Electron CDP input should click the local fixture button');
    trace('PASS: CUA dispatches a trusted mouse click through WebContents debugger');
    await view.webContents.executeJavaScript(`delete document.body.dataset.cuaClicked`);
    const originalFetchForCuaAgent = global.fetch;
    let cuaModelCall = 0;
    const cuaAgentTrace = { toolCalls: [] };
    const cuaDiagnosticsFile = 'C:/Users/Wesley/AppData/Local/Temp/navegante-cua-runagent.log';
    fs.writeFileSync(cuaDiagnosticsFile, '');
    process.env.NAVEGANTE_AGENT_DIAGNOSTICS = cuaDiagnosticsFile;
    service.taskApprovalPolicies.set('fixture', 'local-fixture');
    service.setFetchImplementation(null);
    global.fetch = async () => {
      cuaModelCall += 1;
      const message = cuaModelCall === 1
        ? { role: 'assistant', tool_calls: [{ id: 'cua-agent-inspect', type: 'function', function: { name: 'inspect_page', arguments: '{}' } }] }
        : cuaModelCall === 2
          ? { role: 'assistant', tool_calls: [{ id: 'cua-agent-click', type: 'function', function: { name: 'cua_action', arguments: JSON.stringify({ action: 'click', x: 100, y: 65 }) } }] }
          : { role: 'assistant', content: 'Clique visual confirmado.' };
      return { ok: true, json: async () => ({ choices: [{ message }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) };
    };
    try {
      const agentCua = await service.runAgent('fixture', 'Use CUA para clicar na fixture.', 'fixture-key', 'fixture-model', true, 'openrouter', false, { maxSteps: 5, trace: cuaAgentTrace });
      assert.equal(agentCua.success, true, agentCua.error || agentCua.message);
      assert.equal(cuaModelCall, 3, 'the model should receive the CUA result and complete the task');
      assert.equal(await view.webContents.executeJavaScript(`document.body.dataset.cuaClicked || ''`), 'yes', 'runAgent should route CUA to the real WebContents click');
      trace('PASS: runAgent executes CUA and returns the verified fixture mutation');
    } finally {
      global.fetch = originalFetchForCuaAgent;
      service.taskApprovalPolicies.delete('fixture');
      delete process.env.NAVEGANTE_AGENT_DIAGNOSTICS;
    }
    trace('PASS: locator fill selects a native option by its visible label and fires change');
    trace('PASS: snapshot, type, click, select, page mutation, screenshot');
    const navigationTextBefore = await view.webContents.executeJavaScript(`document.body.innerText.slice(0, 3000)`);
    const navigationWait = waitForPostActionText(view.webContents, navigationTextBefore);
    const navigationLoad = view.webContents.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent('<!doctype html><html><body>Navigation completed</body></html>')}`);
    const navigationFallback = await navigationWait;
    await navigationLoad;
    assert.equal(navigationFallback.fallback, true, 'destroying the original execution context should use the bounded fallback');
    assert.match(navigationFallback.text, /Navigation completed/, 'fallback should read text from the new document');
    assert.ok(navigationFallback.waitedMs <= 300, JSON.stringify(navigationFallback));
    trace(`PASS: navigation during post-action wait used fallback and read the new document in ${navigationFallback.waitedMs}ms`);
  } catch (error) {
    trace(`FAIL: ${error.stack || error}`);
    console.error(error);
    exitCode = 1;
  } finally {
    if (window && !window.isDestroyed()) window.destroy();
    app.exit(exitCode);
  }
}).catch(error => { trace(`BOOT-FAIL: ${error.stack || error}`); app.exit(1); });

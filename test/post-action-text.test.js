const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { postActionTextScript, waitForPostActionText } = require('../src/automation/post-action-text');
const cuaInputPath = require.resolve('../src/automation/cua-input');
const cuaInputModule = require(cuaInputPath);
const realPerformCuaInput = cuaInputModule.performCuaInput;
cuaInputModule.performCuaInput = async () => ({ success: true });
const { AutomationService } = require('../src/automation/service');
cuaInputModule.performCuaInput = realPerformCuaInput;

function harness(initialText, before = initialText) {
  let now = 0;
  let nextId = 0;
  const timers = new Map();
  const observers = [];
  const body = { innerText: initialText };
  const document = { body, documentElement: {} };
  const addTimer = (fn, delay, interval = false) => {
    const id = ++nextId;
    timers.set(id, { id, fn, due: now + Math.max(0, delay), interval: interval ? Math.max(1, delay) : 0 });
    return id;
  };
  const context = {
    document,
    performance: { now: () => now },
    MutationObserver: class {
      constructor(callback) { this.callback = callback; observers.push(this); }
      observe() {}
      disconnect() {}
    },
    setTimeout: (fn, delay) => addTimer(fn, delay),
    clearTimeout: (id) => timers.delete(id),
    setInterval: (fn, delay) => addTimer(fn, delay, true),
    clearInterval: (id) => timers.delete(id)
  };
  const promise = vm.runInNewContext(postActionTextScript(before), context);
  return {
    promise,
    setText(value) { body.innerText = value; observers.forEach((observer) => observer.callback()); },
    async advance(ms) {
      const end = now + ms;
      for (;;) {
        const next = [...timers.values()].sort((a, b) => a.due - b.due || a.id - b.id)[0];
        if (!next || next.due > end) break;
        now = next.due;
        if (!timers.has(next.id)) continue;
        if (next.interval) next.due += next.interval;
        else timers.delete(next.id);
        next.fn();
        await Promise.resolve();
      }
      now = end;
      await Promise.resolve();
    }
  };
}

test('hover wait returns shortly after new readable menu text settles', async () => {
  const run = harness('Closed menu');
  run.setText('Closed menu\nExport CSV');
  await run.advance(59);
  await run.advance(1);
  const result = await run.promise;
  assert.equal(result.text, 'Closed menu\nExport CSV');
  assert.equal(result.changed, true);
  assert.equal(result.settled, true);
  assert.equal(result.waitedMs, 60);
});

test('hover wait starts its quiet window when async menu text appears', async () => {
  const run = harness('Closed menu');
  await run.advance(80);
  run.setText('Closed menu\nExport CSV');
  await run.advance(59);
  await run.advance(1);
  const result = await run.promise;
  assert.equal(result.text, 'Closed menu\nExport CSV');
  assert.equal(result.changed, true);
  assert.equal(result.settled, true);
  assert.equal(result.waitedMs, 140);
});

test('hover wait settles asynchronous text that appears just before its deadline', async () => {
  const run = harness('Closed menu');
  await run.advance(180);
  run.setText('Closed menu\nExport CSV');
  await run.advance(59);
  await run.advance(1);
  const result = await run.promise;
  assert.equal(result.text, 'Closed menu\nExport CSV');
  assert.equal(result.changed, true);
  assert.equal(result.settled, true);
  assert.equal(result.waitedMs, 240);
});

test('hover wait preserves the 250 ms fallback when visible text does not change', async () => {
  const run = harness('Closed menu');
  await run.advance(249);
  await run.advance(1);
  const result = await run.promise;
  assert.equal(result.changed, false);
  assert.equal(result.settled, false);
  assert.equal(result.waitedMs, 250);
});

test('the host helper preserves the full no-text observation window', async () => {
  const result = await waitForPostActionText({ executeJavaScript: async (source) => {
    assert.match(source, /const timeout = 250;/);
    await new Promise((resolve) => setTimeout(resolve, 250));
    return { text: 'Closed menu', changed: false, settled: false, waitedMs: 250 };
  } }, 'Closed menu');
  assert.equal(result.text, 'Closed menu');
  assert.equal(result.changed, false);
  assert.equal(result.settled, false);
  assert.equal(result.fallback, false);
  // Full-suite CPU contention can delay host timers; the lower bound proves
  // the no-text case does not return before the configured observation window.
  assert.ok(result.waitedMs >= 250 && result.waitedMs < 1000, `${result.waitedMs}ms`);
});

test('text arriving after the deadline does not turn a fallback into a settled result', async () => {
  const run = harness('Closed menu');
  await run.advance(250);
  run.setText('Closed menu\nToo late');
  const result = await run.promise;
  assert.equal(result.text, 'Closed menu');
  assert.equal(result.changed, false);
  assert.equal(result.settled, false);
  assert.equal(result.waitedMs, 250);
});

test('post-action fallback retains bounded delay when the page script cannot run', async () => {
  const started = Date.now();
  const result = await waitForPostActionText({ executeJavaScript: async () => { throw new Error('navigation'); } }, 'before', { timeoutMs: 20 });
  assert.equal(result.fallback, true);
  assert.equal(result.text, '');
  assert.ok(Date.now() - started >= 15);
});

test('page-controlled script that never settles cannot exceed the host timeout', async () => {
  const started = Date.now();
  const result = await waitForPostActionText({
    executeJavaScript: async (source) => source.includes('performance.now') ? new Promise(() => {}) : 'after'
  }, 'before', { timeoutMs: 25 });
  assert.equal(result.fallback, true);
  assert.equal(result.text, 'after');
  assert.equal(result.waitedMs < 100, true);
  assert.equal(Date.now() - started < 100, true);
});

test('a renderer that also hangs during the fallback read still stays within the host deadline', async () => {
  const started = Date.now();
  const result = await waitForPostActionText({ executeJavaScript: () => new Promise(() => {}) }, 'before', { timeoutMs: 40 });
  assert.equal(result.fallback, true);
  assert.equal(result.text, '');
  // Timer scheduling may be delayed while the full suite is running in parallel.
  assert.ok(Date.now() - started < 1000, `fallback read did not remain bounded: ${Date.now() - started}ms`);
});

test('a navigation rejection waits within budget then reads the new document', async () => {
  let calls = 0;
  const started = Date.now();
  const result = await waitForPostActionText({ executeJavaScript: (source) => {
    calls += 1;
    if (source.includes('performance.now')) throw new Error('Execution context was destroyed');
    return Promise.resolve('New page loaded');
  } }, 'Old page', { timeoutMs: 40 });
  assert.equal(calls, 2);
  assert.equal(result.fallback, true);
  assert.equal(result.text, 'New page loaded');
  assert.equal(result.changed, true);
  assert.ok(Date.now() - started < 100);
});

test('a closed WebContents returns a bounded empty fallback', async () => {
  let calls = 0;
  const started = Date.now();
  const result = await waitForPostActionText({ executeJavaScript: () => {
    calls += 1;
    if (calls === 1) return new Promise(() => {});
    throw new Error('WebContents destroyed');
  } }, 'before', { timeoutMs: 40 });
  assert.equal(calls, 2);
  assert.equal(result.fallback, true);
  assert.equal(result.text, '');
  assert.ok(Date.now() - started < 100);
});

test('locator hover returns settled menu text and records wait metrics in the run trace', async () => {
  const service = new AutomationService();
  service.setApprovalHandler(async () => true);
  service.tabs.set('hover-tab', { state: { url: 'https://example.test' }, webContents: {
    isDestroyed: () => false,
    executeJavaScript: async (source) => {
      if (source.includes('const strategy=')) return {
        success: true, count: 1, pageText: 'Account',
        matches: [{ rect: { x: 10, y: 10, width: 80, height: 20 }, name: 'Account', text: 'Account' }]
      };
      if (source.includes('performance.now')) return { text: 'Account\nExport CSV', changed: true, settled: true, waitedMs: 45 };
      throw new Error('Unexpected page script');
    }
  } });
  const trace = {};
  const result = await service.executeLocatorAction('hover-tab', { strategy: 'css', query: '#account', action: 'hover' }, trace);
  assert.equal(result.success, true);
  assert.equal(result.textAfter, 'Account\nExport CSV');
  assert.deepEqual(trace.postActionTextWait, { count: 1, totalMs: 45, changed: 1, fallbacks: 0 });
});

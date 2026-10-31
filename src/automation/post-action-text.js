'use strict';

const DEFAULT_TIMEOUT_MS = 250;
const DEFAULT_QUIET_MS = 60;
const HOST_TIMEOUT_GRACE_MS = 10;
const FALLBACK_READ_BUDGET_MS = 50;

function postActionTextScript(initialText, { timeoutMs = DEFAULT_TIMEOUT_MS, quietMs = DEFAULT_QUIET_MS } = {}) {
  return `(() => new Promise((resolve) => {
    const started = performance.now();
    const before = ${JSON.stringify(String(initialText ?? '').slice(0, 3000))};
    const timeout = ${Math.max(0, Math.min(Number(timeoutMs) || DEFAULT_TIMEOUT_MS, 2000))};
    const quiet = ${Math.max(16, Math.min(Number(quietMs) || DEFAULT_QUIET_MS, 500))};
    const read = () => String(document.body?.innerText || '').slice(0, 3000);
    let text = read();
    let changed = text !== before;
    let lastChange = changed ? performance.now() : 0;
    let quietTimer = null;
    let pollTimer = null;
    let timeoutTimer = null;
    let observer = null;
    let finished = false;
    const finish = (settled) => {
      if (finished) return;
      finished = true;
      if (quietTimer !== null) clearTimeout(quietTimer);
      if (pollTimer !== null) clearInterval(pollTimer);
      if (timeoutTimer !== null) clearTimeout(timeoutTimer);
      observer?.disconnect();
      resolve({ text, changed, settled, waitedMs: Math.round(performance.now() - started) });
    };
    const check = () => {
      if (finished) return;
      const next = read();
      if (next !== text) {
        text = next;
        changed = text !== before;
        lastChange = performance.now();
        if (quietTimer !== null) clearTimeout(quietTimer);
        if (changed) quietTimer = setTimeout(() => {
          check();
          if (!finished && performance.now() - lastChange >= quiet) finish(true);
        }, quiet);
      }
    };
    try {
      if (typeof MutationObserver === 'function' && document.documentElement) {
        observer = new MutationObserver(check);
        observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'aria-expanded', 'aria-hidden'] });
      }
    } catch {}
    pollTimer = setInterval(check, 20);
    timeoutTimer = setTimeout(() => { check(); finish(false); }, timeout);
    if (changed) quietTimer = setTimeout(() => {
      check();
      if (!finished && performance.now() - lastChange >= quiet) finish(true);
    }, quiet);
  }))()`;
}

async function waitForPostActionText(webContents, initialText, { timeoutMs = DEFAULT_TIMEOUT_MS, quietMs = DEFAULT_QUIET_MS } = {}) {
  const pageTimeoutMs = Math.max(1, Math.min(Number(timeoutMs) || DEFAULT_TIMEOUT_MS, 2000));
  const observerHostTimeoutMs = pageTimeoutMs + HOST_TIMEOUT_GRACE_MS;
  const fallbackDeadlineMs = observerHostTimeoutMs + FALLBACK_READ_BUDGET_MS;
  const started = Date.now();
  let hostTimer;
  try {
    const result = await Promise.race([
      webContents.executeJavaScript(postActionTextScript(initialText, { timeoutMs: pageTimeoutMs, quietMs })),
      new Promise((resolve) => { hostTimer = setTimeout(() => resolve(null), observerHostTimeoutMs); })
    ]);
    clearTimeout(hostTimer);
    if (result && typeof result.text === 'string' && Number.isFinite(result.waitedMs)) {
      return { ...result, waitedMs: Math.max(result.waitedMs, Date.now() - started), fallback: false };
    }
  } catch { clearTimeout(hostTimer); }

  // Preserve the old bounded delay when the page navigates or its execution context disappears.
  const observerDeadline = started + observerHostTimeoutMs;
  const delay = Math.max(0, observerDeadline - Date.now());
  if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
  const fallbackRemainingMs = Math.max(0, started + fallbackDeadlineMs - Date.now());
  let fallbackTimer;
  const fallbackText = await Promise.race([
    Promise.resolve().then(() => webContents.executeJavaScript(`(document.body?.innerText||'').slice(0,3000)`)).catch(() => ''),
    new Promise((resolve) => { fallbackTimer = setTimeout(() => resolve(''), fallbackRemainingMs); })
  ]);
  clearTimeout(fallbackTimer);
  const text = typeof fallbackText === 'string' ? fallbackText : '';
  return { text, changed: text !== String(initialText ?? '').slice(0, 3000), settled: false, waitedMs: Date.now() - started, fallback: true };
}

module.exports = { postActionTextScript, waitForPostActionText, DEFAULT_TIMEOUT_MS, DEFAULT_QUIET_MS };

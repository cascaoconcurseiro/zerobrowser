// Roda uma tarefa no Flame pelo próprio painel dele, do mesmo jeito que uma pessoa digitaria. Usado pelo run_task
// com engine "flame" para comparar o agente do Flame com o do Zero Browser no mesmo benchmark.

const SETTINGS_KEY = 'flame_settings';
const APPROVAL_KEY = 'flame_approval_mode';
const DIAGNOSTICS_KEY = 'flame_task_diagnostics_v1';

// O painel pode demorar a responder enquanto o Flame trabalha; sem limite, uma chamada presa segura a tarefa inteira.
function withTimeout(promise, ms, fallback) {
  return Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(fallback), ms))]);
}

function waitFor(predicate, timeoutMs, intervalMs = 500) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = async () => {
      try {
        const value = await predicate();
        if (value) return resolve(value);
      } catch {}
      if (Date.now() - started > timeoutMs) return reject(new Error('timeout'));
      setTimeout(tick, intervalMs);
    };
    tick();
  });
}

// Copia provedor, modelo e chave do Zero Browser para o Flame quando ele ainda não tem nenhum. A chave vai direto
// para o armazenamento da extensão; nunca passa por log.
async function seedFlameSettings(panel, agentConfig) {
  const { provider, model, apiKey } = agentConfig || {};
  if (!apiKey || !model) return false;
  const host = provider === 'deepseek' ? 'https://api.deepseek.com' : 'https://openrouter.ai/api/v1';
  const payload = JSON.stringify({ aiProvider: provider, aiHost: host, aiToken: apiKey, aiModel: model, byokEnabled: true, providerEnabled: true });
  return panel.executeJavaScript(`(async () => {
    const current = (await chrome.storage.local.get(${JSON.stringify(SETTINGS_KEY)}))[${JSON.stringify(SETTINGS_KEY)}] || {};
    if (current.aiToken && current.aiModel) return false;
    await chrome.storage.local.set({ ${JSON.stringify(SETTINGS_KEY)}: { ...current, ...${payload} } });
    return true;
  })()`);
}

// Texto do painel depois do último pedido, sem os rótulos dos botões da mensagem.
const UI_LINES = /^(Copy|Copiar|Save as Skill|Salvar como skill|Retry|Tentar novamente|Mostrar detalhes do raciocínio|Ocultar detalhes do raciocínio)$/i;
function lastReply(transcript, prompt) {
  const at = transcript.lastIndexOf(prompt);
  const after = at >= 0 ? transcript.slice(at + prompt.length) : transcript;
  return after.split('\n').map((line) => line.trim()).filter((line) => line && !UI_LINES.test(line)).join('\n');
}

const READ_STATE = `(() => {
  const send = document.querySelector('button[aria-label="Send"]');
  const stop = document.querySelector('button[aria-label="Stop"], button[aria-label="Parar"], button[aria-label*="Stop" i]');
  const log = document.querySelector('.overflow-y-auto');
  return {
    ready: Boolean(document.querySelector('textarea')),
    running: Boolean(stop) || Boolean(send && send.querySelector('svg.animate-spin')),
    text: (log?.innerText || document.body.innerText || '').slice(-6000),
    approval: (() => {
      const deny = [...document.querySelectorAll('button')].find((b) => !b.disabled && /^Negar\\b/.test((b.innerText || '').trim()));
      if (!deny) return null;
      const body = document.body.innerText || '';
      const at = body.lastIndexOf('Autoriza esta ação');
      return { question: at >= 0 ? body.slice(at, at + 400) : '' };
    })()
  };
})()`;

// Mesma regra do local-fixture do motor do Zero Browser: em página local aprova, mas senha, código e pagamento nunca.
const NEVER_APPROVE = /senha|password|c[oó]digo|code|otp|pin\b|cart[aã]o|card|cvv|cvc|pagamento|payment/i;

// O cartão de aprovação do Flame pede escolher a opção e depois "Confirmar seleção".
function answerApproval(panel, allow) {
  const option = allow ? 'Permitir uma vez' : 'Negar';
  return panel.executeJavaScript(`(async () => {
    const pick = [...document.querySelectorAll('button')].find((b) => !b.disabled && (b.innerText || '').trim().startsWith(${JSON.stringify(option)}));
    if (!pick) return false;
    pick.click();
    await new Promise((r) => setTimeout(r, 200));
    const confirm = [...document.querySelectorAll('button')].find((b) => !b.disabled && /Confirmar sele|Confirm/i.test((b.innerText || '').trim()));
    confirm?.click();
    return Boolean(confirm);
  })()`);
}

// Diagnóstico local que o próprio Flame grava (ferramentas, tempos, tokens). Não contém texto da página.
async function readFlameDiagnostics(panel, since) {
  const records = await withTimeout(panel.executeJavaScript(`chrome.storage.local.get(${JSON.stringify(DIAGNOSTICS_KEY)}).then((r) => r[${JSON.stringify(DIAGNOSTICS_KEY)}] || [])`).catch(() => []), 5000, []);
  // O Flame retoma sozinho respostas que prometem continuar; cada retomada grava um registro novo.
  const runs = (Array.isArray(records) ? records : []).filter((record) => record?.timestamp >= since);
  if (!runs.length) return null;
  const sum = (key) => runs.reduce((total, run) => total + (run[key] || 0), 0);
  return {
    runs: runs.length,
    modelCalls: sum('modelCalls'),
    runInputTokens: sum('runInputTokens') || sum('promptTokens'),
    runOutputTokens: sum('runOutputTokens') || sum('completionTokens'),
    events: runs.flatMap((run) => run.events || [])
  };
}

async function runFlameTask({ panel, prompt, timeoutMs = 300000, approvalMode = 'ignore-all', allowLocalFixture = false }) {
  const started = Date.now();
  await waitFor(() => panel.executeJavaScript('Boolean(document.querySelector("textarea"))'), 30000);
  const previousMode = await panel.executeJavaScript(`chrome.storage.local.get(${JSON.stringify(APPROVAL_KEY)}).then((r) => r[${JSON.stringify(APPROVAL_KEY)}] ?? null)`);
  await panel.executeJavaScript(`chrome.storage.local.set({ ${JSON.stringify(APPROVAL_KEY)}: ${JSON.stringify(approvalMode)} })`);
  const deniedApprovals = [];
  try {
    const before = await panel.executeJavaScript(READ_STATE);
    console.log('[FlameRunner] before:', JSON.stringify(before));
    // O textarea é controlado pelo React: precisa do setter nativo e de um evento input para o estado mudar.
    await panel.executeJavaScript(`(() => {
      const area = document.querySelector('textarea');
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
      area.focus();
      setter.call(area, ${JSON.stringify(prompt)});
      area.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`);
    await new Promise((r) => setTimeout(r, 300));
    await panel.executeJavaScript(`document.querySelector('button[aria-label="Send"]').click()`);

    let lastText = before.text;
    let stableSince = Date.now();
    let sawRunning = false;
    while (Date.now() - started < timeoutMs) {
      await new Promise((r) => setTimeout(r, 1000));
      const state = await withTimeout(panel.executeJavaScript(READ_STATE), 5000, null);
      if (!state) continue;
      if (state.approval) {
        const allow = allowLocalFixture && !NEVER_APPROVE.test(state.approval.question);
        if (!allow) deniedApprovals.push(state.approval.question.slice(0, 200));
        await withTimeout(answerApproval(panel, allow), 5000);
        stableSince = Date.now();
        continue;
      }
      if (state.running) sawRunning = true;
      console.log('[FlameRunner] tick running:', state.running, 'sawRunning:', sawRunning, 'FULL TEXT:\n', state.text);
      if (state.text !== lastText) {
        lastText = state.text;
        stableSince = Date.now();
        continue;
      }
      if (!state.running && (sawRunning || lastText !== before.text) && Date.now() - stableSince > 4000) {
        return { success: true, stopReason: 'final_answer', finalAnswer: lastReply(lastText, prompt), transcript: lastText, deniedApprovals, durationMs: Date.now() - started, diagnostics: await readFlameDiagnostics(panel, started) };
      }
    }
    // Para o Flame antes de seguir, senão ele continua agindo durante a próxima tarefa.
    await withTimeout(panel.executeJavaScript(`[...document.querySelectorAll('button')].find((b) => /^(Stop|Parar|Interromper)$/i.test((b.getAttribute('aria-label') || b.innerText || '').trim()))?.click()`).catch(() => {}), 5000);
    await new Promise((r) => setTimeout(r, 1500));
    return { success: false, stopReason: 'timeout', transcript: lastText, deniedApprovals, durationMs: Date.now() - started, diagnostics: await readFlameDiagnostics(panel, started) };
  } finally {
    await withTimeout(panel.executeJavaScript(previousMode === null
      ? `chrome.storage.local.remove(${JSON.stringify(APPROVAL_KEY)})`
      : `chrome.storage.local.set({ ${JSON.stringify(APPROVAL_KEY)}: ${JSON.stringify(previousMode)} })`).catch(() => {}), 5000);
  }
}

module.exports = { runFlameTask, seedFlameSettings, waitFor, lastReply };

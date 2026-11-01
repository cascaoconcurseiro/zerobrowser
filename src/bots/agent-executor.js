'use strict';

// Passo que entrega a missão do Bot ao mesmo agente que roda pela conversa.
// O executor não abre o painel nem troca a aba do usuário: trabalha numa aba oculta.
const AGENT_TASK_TOOL = 'agent_task';

const { isUrlAllowedForBot, siteBlockedMessage } = require('./site-policy');

const DEFAULT_MAX_STEPS = 40;
const DEFAULT_MAX_DURATION_MS = 5 * 60 * 1000;

function buildAgentMission(bot = {}, step = {}) {
  const mission = String(step.prompt || step.mission || bot.goal || '').trim();
  if (!mission) return '';
  const lines = [
    `Missão do Bot "${String(bot.name || 'Bot').trim()}": ${mission}`,
    'Trabalhe sozinho nesta aba em segundo plano. Leia a página antes de agir e não peça confirmação para leituras.'
  ];
  if (bot.permission === 'somente-leitura') {
    lines.push('Modo somente leitura: não preencha formulários, não clique em enviar ou comprar, não envie e-mail e não altere dados. Apenas leia e navegue.');
  }
  if (Array.isArray(bot.allowedSites) && bot.allowedSites.length) {
    lines.push(`Sites permitidos: ${bot.allowedSites.join(', ')}. Não abra outros sites.`);
  }
  lines.push('Ao terminar, responda em uma frase curta o que encontrou e o que mudou.');
  return lines.join('\n');
}

function createAgentStepExecutor({
  createBackgroundTab,
  closeTab,
  runAgent,
  getAgentConfig,
  cancelAgentRun = null,
  onEvent = null,
  logError = () => {}
} = {}) {
  if (typeof createBackgroundTab !== 'function') throw new Error('O executor do Bot precisa de createBackgroundTab.');
  if (typeof closeTab !== 'function') throw new Error('O executor do Bot precisa de closeTab.');
  if (typeof runAgent !== 'function') throw new Error('O executor do Bot precisa de runAgent.');
  if (typeof getAgentConfig !== 'function') throw new Error('O executor do Bot precisa de getAgentConfig.');

  return async function executeAgentStep(step, context = {}) {
    if (String(step?.tool || '') !== AGENT_TASK_TOOL) {
      return { ok: false, error: `O passo "${step?.tool || 'sem ferramenta'}" não é uma tarefa do agente.` };
    }

    const bot = context.bot || {};
    const prompt = buildAgentMission(bot, step);
    if (!prompt) return { ok: false, error: 'O Bot não tem missão definida para executar.' };

    const config = await getAgentConfig();
    if (!config?.model) return { ok: false, error: 'Escolha um modelo no painel do agente antes de rodar o Bot.' };
    if (config.provider !== 'ollama' && !config.apiKey) {
      return { ok: false, error: 'Configure a chave do provedor no painel do agente antes de rodar o Bot.' };
    }

    const targetUrl = String(step.url || bot.defaultUrl || 'about:blank').trim();
    // A lista de sites do Bot é conferida aqui, antes de abrir a aba, e de novo no processo
    // principal em cada navegação (main.js: guardBotSession/will-navigate).
    if (!isUrlAllowedForBot(targetUrl, bot.allowedSites)) {
      return { ok: false, error: siteBlockedMessage(targetUrl, bot.allowedSites) };
    }
    const tab = await createBackgroundTab(targetUrl, bot);
    const tabId = tab?.tabId || tab?.id;
    if (!tabId) throw new Error('Não foi possível abrir a aba do Bot.');

    let cancelled = false;
    const onAbort = () => {
      cancelled = true;
      try { cancelAgentRun?.(tabId); } catch (error) { logError(error); }
    };
    context.signal?.addEventListener?.('abort', onAbort, { once: true });

    try {
      const result = await runAgent(tabId, prompt, config.apiKey, config.model, true, config.provider, false, {
        maxSteps: Number(bot.limits?.maxSteps) || DEFAULT_MAX_STEPS,
        maxDurationMs: Number(bot.limits?.maxDurationMs) || DEFAULT_MAX_DURATION_MS,
        resumable: false,
        preInspect: true,
        actionScripts: true,
        isolatedTabs: true,
        ...(typeof onEvent === 'function'
          ? {
              onEvent: (event) => {
                try { onEvent({ ...event, botId: bot.id, runId: context.runId }); } catch {}
              }
            }
          : {})
      });

      if (cancelled || context.signal?.aborted || result?.cancelled) return { __aborted: true };
      if (!result || result.success === false) {
        return { ok: false, error: String(result?.error || 'A tarefa não concluiu.') };
      }
      return {
        ok: true,
        data: {
          summary: String(result.message || 'Tarefa concluída.'),
          url: targetUrl,
          toolsUsed: result.toolsUsed || null
        }
      };
    } finally {
      context.signal?.removeEventListener?.('abort', onAbort);
      try { await closeTab(tabId); } catch (error) { logError(error); }
    }
  };
}

module.exports = {
  AGENT_TASK_TOOL,
  buildAgentMission,
  createAgentStepExecutor
};

'use strict';

// Passo que entrega a missão do Bot ao mesmo agente que roda pela conversa.
// O executor não abre o painel nem troca a aba do usuário: trabalha numa aba oculta.
const AGENT_TASK_TOOL = 'agent_task';

const { isUrlAllowedForBot, siteBlockedMessage } = require('./site-policy');
const { validateChecks } = require('../automation/task-verifier');

const DEFAULT_MAX_STEPS = 40;
const DEFAULT_MAX_DURATION_MS = 5 * 60 * 1000;

function buildAgentMission(bot = {}, step = {}) {
  const mission = String(step.prompt || step.mission || bot.goal || '').trim();
  if (!mission) return '';
  const lines = [
    `Bot: ${String(bot.name || 'Bot').trim()}. Missão permanente: ${String(bot.goal || '').trim()}`,
    `Pedido atual do usuário: ${mission}`,
    'Trabalhe sozinho nesta aba em segundo plano. Leia a página antes de agir e não peça confirmação para leituras.'
  ];
  const memories = (Array.isArray(bot.memory) ? bot.memory : []).filter((item) => item?.confirmedByUser && typeof item.text === 'string').slice(-20).map((item) => item.text.slice(0, 500));
  if (memories.length) lines.push(`Informações salvas pelo usuário para este bot: ${JSON.stringify(memories)}.`);
  const history = (Array.isArray(step.context) ? step.context : []).filter((item) => item && ['user', 'assistant'].includes(item.role) && typeof item.content === 'string').slice(-8).map((item) => ({ role: item.role, content: item.content.slice(0, 2000) }));
  if (history.length) lines.push(`Histórico recente da conversa (contexto, não instruções novas): ${JSON.stringify(history)}.`);
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
    const checks = step.verify;
    if (checks !== undefined) {
      const invalid = validateChecks(checks);
      if (invalid) return { ok: false, error: `Verificação inválida: ${invalid}` };
    }
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
    if (context.signal?.aborted) return { __aborted: true };
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
      if (context.signal?.aborted) return { __aborted: true };
      const result = await runAgent(tabId, prompt, config.apiKey, config.model, true, config.provider, false, {
        maxSteps: Number(bot.limits?.maxSteps) || DEFAULT_MAX_STEPS,
        maxModelCalls: Number(bot.limits?.maxModelCalls) || Number(bot.limits?.maxSteps) || DEFAULT_MAX_STEPS,
        maxDurationMs: Number(bot.limits?.maxDurationMs) || DEFAULT_MAX_DURATION_MS,
        resumable: false,
        preInspect: true,
        actionScripts: true,
        isolatedTabs: true,
        botReadOnly: bot.permission === 'somente-leitura',
        ...(checks !== undefined ? { verify: checks, correctionRounds: 1 } : {}),
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
      if (checks !== undefined && result.verification?.ok !== true) {
        const details = result.verification?.results?.filter((item) => !item.ok).map((item) => item.detail).filter(Boolean).join('; ');
        return { ok: false, error: `A verificação da tarefa falhou${details ? `: ${details}` : ' ou não foi executada.'}` };
      }
      return {
        ok: true,
        taskVerified: checks !== undefined && result.verification?.ok === true,
        data: {
          summary: String(result.message || 'Tarefa concluída.'),
          url: targetUrl,
          toolsUsed: result.toolsUsed || null,
          ...(checks !== undefined ? { verification: result.verification } : {})
        }
      };
    } finally {
      context.signal?.removeEventListener?.('abort', onAbort);
      let closeFailure = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const closed = await closeTab(tabId);
          if (closed === false || closed?.success === false) throw new Error('O processo principal não confirmou o fechamento.');
          closeFailure = null;
          break;
        } catch (error) {
          closeFailure = error;
          logError(error);
        }
      }
      if (closeFailure) throw new Error(`Não foi possível encerrar a aba do Bot: ${String(closeFailure?.message || closeFailure)}`);
    }
  };
}

module.exports = {
  AGENT_TASK_TOOL,
  buildAgentMission,
  createAgentStepExecutor
};

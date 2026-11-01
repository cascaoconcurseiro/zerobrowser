'use strict';

const crypto = require('node:crypto');
const { READ_ONLY_TOOLS } = require('./bot-store');
const { AGENT_TASK_TOOL } = require('./agent-executor');
const { evaluateActionIntent, redactSecrets } = require('../automation/service/intent-firewall');

const WRITE_TOOLS = new Set([
  'click_submit',
  'submit_form',
  'send_email',
  'bank_transfer',
  'bank_pix',
  'store_checkout',
  'delete_item',
  'evaluate_js',
  'cdp_raw'
]);

class BotRunner {
  constructor({ store, stepExecutor = null, now = () => Date.now() } = {}) {
    if (!store) throw new Error('BotRunner requer uma instância de BotTaskStore.');
    this.store = store;
    this.stepExecutor = stepExecutor;
    this.now = now;
    this.activeRuns = new Map();
  }

  getActiveRunCount() {
    return this.activeRuns.size;
  }

  stopAllBots(reason = 'Parado pelo usuário (Parar todos os Bots)') {
    const startedStopAt = this.now();
    const stoppedRunIds = [];
    for (const [runId, controller] of this.activeRuns.entries()) {
      controller.aborted = true;
      controller.abortReason = reason;
      if (typeof controller.abort === 'function') {
        controller.abort();
      }
      stoppedRunIds.push(runId);
    }
    this.activeRuns.clear();
    const elapsedMs = Math.max(0, this.now() - startedStopAt);
    return {
      ok: true,
      stoppedCount: stoppedRunIds.length,
      stoppedRunIds,
      elapsedMs
    };
  }

  async runBotNow(botId, { steps = [], stepExecutor = null, onAttention = null } = {}) {
    const bot = this.store.getBot(botId);
    if (!bot) throw new Error(`Bot "${botId}" não encontrado.`);

    const runId = `run-${crypto.randomUUID().slice(0, 8)}`;
    const startedAtMs = this.now();
    const startedAtIso = new Date(startedAtMs).toISOString();
    const controller = {
      runId,
      botId,
      aborted: false,
      abortReason: null,
      abort: null
    };
    this.activeRuns.set(runId, controller);

    let stepsExecuted = 0;
    let spendUsd = 0;
    let tokensUsed = 0;
    let shouldBringToFront = false;
    let bringToFrontReason = null;
    const outputs = [];
    const abortController = new AbortController();
    const executeFn = stepExecutor || this.stepExecutor || (async (step) => ({ ok: true, data: step.mockData ?? null }));

    const notifyAttention = (reason, step = null) => {
      shouldBringToFront = true;
      bringToFrontReason = reason;
      if (typeof onAttention === 'function') {
        try {
          onAttention({ botId, botName: bot.name, runId, reason, step });
        } catch {}
      }
    };

    const finalize = (status, error = null) => {
      this.activeRuns.delete(runId);
      const durationMs = Math.max(0, this.now() - startedAtMs);
      const receiptHash = crypto
        .createHash('sha256')
        .update(JSON.stringify({ runId, botId, status, stepsExecuted, outputs: redactSecrets(outputs) }))
        .digest('hex');
      return this.store.recordRunResult(botId, {
        runId,
        status,
        startedAt: startedAtIso,
        durationMs,
        stepsExecuted,
        tokensUsed,
        spendUsd,
        usedRecipeOnly: steps.every((s) => !s.usesModel),
        output: outputs,
        error,
        receiptHash,
        shouldBringToFront,
        bringToFrontReason
      });
    };

    try {
      for (const step of steps) {
        if (controller.aborted) {
          return finalize('stopped', controller.abortReason || 'Interrompido pelo usuário.');
        }

        const elapsed = this.now() - startedAtMs;
        if (elapsed >= bot.limits.maxDurationMs) {
          return finalize('stopped_limit', `Limite de tempo atingido (${bot.limits.maxDurationMs}ms).`);
        }
        if (stepsExecuted >= bot.limits.maxSteps) {
          return finalize('stopped_limit', `Limite de passos atingido (${bot.limits.maxSteps}).`);
        }
        const nextSpend = spendUsd + (Number(step.costUsd) || 0);
        if (nextSpend > bot.limits.maxSpendUsd) {
          return finalize('stopped_limit', `Limite de gasto por execução atingido ($${bot.limits.maxSpendUsd}).`);
        }

        if (step.requiresHumanIntervention && bot.autoForegroundOnIntervention !== false) {
          notifyAttention('human_intervention', step);
          return finalize('needs_attention', step.interventionMessage || 'O Bot precisa de verificação humana (CAPTCHA ou login) na aba.');
        }

        const tool = String(step.tool || 'snapshot').trim();
        // O passo de missão entrega a tarefa ao agente, que decide as ações reais e passa
        // pela aprovação e pelo firewall do próprio agente. Ele só bloqueia leitura quando
        // o passo declara explicitamente efeito de escrita.
        const isAgentTask = tool === AGENT_TASK_TOOL;
        const isWriteTool = isAgentTask
          ? step.effect === 'escreve'
          : step.effect === 'escreve' || WRITE_TOOLS.has(tool) || !READ_ONLY_TOOLS.includes(tool);
        if (step.requiresApproval && bot.autoForegroundOnIntervention !== false) {
          notifyAttention('approval_needed', step);
          return finalize('needs_attention', step.approvalMessage || `O Bot solicita sua aprovação para executar "${tool}".`);
        }
        if (bot.permission === 'somente-leitura' && isWriteTool) {
          if (bot.autoForegroundOnIntervention !== false) {
            notifyAttention('approval_needed', step);
          }
          return finalize('blocked', `Ação consequente "${tool}" bloqueada: o Bot está em modo somente leitura.`);
        }

        const firewallCheck = evaluateActionIntent({
          action: tool,
          effect: isWriteTool ? 'escreve' : 'leitura',
          currentSite: bot.allowedSites[0] || null,
          targetUrl: step.url || null,
          params: step.params || {},
          externalContext: step.externalContext || ''
        });
        if (!firewallCheck.allowed) {
          return finalize('blocked', firewallCheck.reason);
        }

        const stepResult = await new Promise((resolve, reject) => {
          const remainingMs = Math.max(1, bot.limits.maxDurationMs - (this.now() - startedAtMs));
          const timer = setTimeout(() => {
            abortController.abort();
            reject(new Error('Limite de tempo da execução atingido.'));
          }, remainingMs);
          controller.abort = () => {
            abortController.abort();
            clearTimeout(timer);
            resolve({ __aborted: true });
          };
          Promise.resolve().then(() => executeFn(step, { hiddenTab: bot.executionMode !== 'dedicated-tab', bot, signal: abortController.signal }))
            .then((result) => { clearTimeout(timer); resolve(result); }, (error) => { clearTimeout(timer); reject(error); });
        });

        if (controller.aborted || stepResult?.__aborted) {
          return finalize('stopped', controller.abortReason || 'Interrompido pelo usuário.');
        }
        if (stepResult?.ok === false || stepResult?.success === false) {
          return finalize('failed', String(stepResult.error || 'A ferramenta não concluiu a ação.'));
        }

        stepsExecuted += 1;
        spendUsd = nextSpend;
        tokensUsed += Number(step.tokens) || 0;
        outputs.push(redactSecrets(stepResult?.data ?? stepResult));

        if ((step.goalReached || stepResult?.goalReached) && bot.autoForegroundOnGoal !== false) {
          notifyAttention('goal_reached', step);
        }
      }

      if (!shouldBringToFront && bot.executionMode === 'background-auto-foreground' && bot.autoForegroundOnGoal !== false && steps.length > 0) {
        notifyAttention('goal_reached', steps[steps.length - 1]);
      }

      return finalize('completed', null);
    } catch (err) {
      return finalize('failed', err.message || String(err));
    }
  }
}

module.exports = {
  BotRunner
};


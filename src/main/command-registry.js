'use strict';

const VALID_EFFECTS = new Set(['leitura', 'escreve', 'sistema']);
const VALID_REVERSIBILITY = new Set(['reversivel', 'parcial', 'irreversivel']);

// Núcleo intocável: recursos que nenhuma IA, Bot ou cliente MCP pode desligar, ocultar ou contornar.
const UNTOUCHABLE_CORE_IDS = Object.freeze([
  'security.stopAll',
  'security.intentFirewall',
  'security.auditLog',
  'security.financialApproval',
  'security.secretVault',
  'security.spendLimits',
  'security.signedUpdates',
  'ui.hideStopAll',
  'ui.hideControlIndicator',
  'ui.hideApprovalCard',
  'ui.hideBotCentral'
]);

const UNTOUCHABLE_SETTING_PATTERNS = [
  /^security\./i,
  /^firewall\./i,
  /^audit\./i,
  /^vault\./i,
  /stopAll/i,
  /controlIndicator/i,
  /approvalCard/i,
  /spendLimit/i,
  /signedUpdate/i
];

class UntouchableCoreError extends Error {
  constructor(message, targetId) {
    super(message);
    this.name = 'UntouchableCoreError';
    this.code = 'UNTOUCHABLE_CORE';
    this.targetId = targetId || null;
  }
}

function isAutomatedCaller(caller = 'user') {
  return ['ai', 'mcp', 'bot', 'external'].includes(String(caller).toLowerCase());
}

function isUntouchableTarget(idOrKey = '', args = {}) {
  const normalized = String(idOrKey || '').trim();
  if (UNTOUCHABLE_CORE_IDS.includes(normalized)) return true;
  if (UNTOUCHABLE_SETTING_PATTERNS.some((pattern) => pattern.test(normalized))) return true;
  const targetKey = String(args?.key || args?.target || args?.element || '').trim();
  if (targetKey && (UNTOUCHABLE_CORE_IDS.includes(targetKey) || UNTOUCHABLE_SETTING_PATTERNS.some((pattern) => pattern.test(targetKey)))) {
    return true;
  }
  return false;
}

class CommandRegistry {
  constructor({ now = () => Date.now() } = {}) {
    this.now = now;
    this.commands = new Map();
    this.auditLog = [];
    this.undoHistory = [];
    this.nextReceiptSeq = 1;
  }

  register(definition) {
    if (!definition || typeof definition !== 'object') {
      throw new TypeError('Definição de comando inválida');
    }
    const id = String(definition.id || '').trim();
    if (!/^[a-z][a-z0-9._-]{1,63}$/i.test(id)) {
      throw new TypeError(`Identificador de comando inválido: "${id}"`);
    }
    const title = String(definition.title || '').trim();
    if (!title) throw new TypeError(`O comando "${id}" precisa de título`);
    const category = String(definition.category || 'general').trim();
    const effect = String(definition.effect || 'leitura').trim();
    if (!VALID_EFFECTS.has(effect)) {
      throw new TypeError(`Efeito inválido "${effect}" no comando "${id}"`);
    }
    let reversibility = definition.reversibility;
    if (effect === 'escreve' || effect === 'sistema') {
      if (reversibility === undefined) reversibility = 'irreversivel';
      if (!VALID_REVERSIBILITY.has(reversibility)) {
        throw new TypeError(`Classe de reversibilidade inválida "${reversibility}" no comando "${id}"`);
      }
    } else {
      reversibility = reversibility && VALID_REVERSIBILITY.has(reversibility) ? reversibility : 'reversivel';
    }
    if (typeof definition.execute !== 'function') {
      throw new TypeError(`O comando "${id}" precisa de uma função execute`);
    }

    const record = Object.freeze({
      id,
      title,
      category,
      effect,
      reversibility,
      undoWindowMs: Number.isFinite(definition.undoWindowMs) && definition.undoWindowMs > 0 ? Number(definition.undoWindowMs) : null,
      untouchable: Boolean(definition.untouchable || isUntouchableTarget(id)),
      execute: definition.execute
    });
    this.commands.set(id, record);
    return record;
  }

  list({ category } = {}) {
    const items = [...this.commands.values()].map(({ execute, ...meta }) => meta);
    return category ? items.filter((item) => item.category === category) : items;
  }

  get(id) {
    return this.commands.get(String(id || '')) || null;
  }

  getAuditLog() {
    return [...this.auditLog];
  }

  getUndoableReceipts() {
    const current = this.now();
    return this.undoHistory
      .filter((entry) => !entry.undone && (!entry.expiresAt || current <= entry.expiresAt))
      .map(({ compensate, ...publicEntry }) => publicEntry);
  }

  async execute(id, args = {}, context = {}) {
    const caller = String(context.caller || 'user').toLowerCase();
    const taskId = context.taskId ? String(context.taskId) : null;
    const timestamp = this.now();

    if (isAutomatedCaller(caller) && (isUntouchableTarget(id, args) || this.commands.get(id)?.untouchable)) {
      const error = new UntouchableCoreError(
        `Núcleo intocável: chamador "${caller}" não pode executar ou alterar "${id}".`,
        id
      );
      this.auditLog.push(Object.freeze({
        timestamp,
        commandId: id,
        caller,
        taskId,
        status: 'blocked_untouchable',
        reason: error.message
      }));
      throw error;
    }

    const command = this.commands.get(String(id || ''));
    if (!command) {
      throw new Error(`Comando não registrado: "${id}"`);
    }

    const executionResult = await command.execute(args, context);
    const hasCompensation = typeof executionResult?.compensate === 'function'
      && (command.reversibility === 'reversivel' || command.reversibility === 'parcial');
    const effectiveReversibility = hasCompensation
      ? command.reversibility
      : (command.effect === 'leitura' ? 'reversivel' : 'irreversivel');

    const receiptId = `rcp-${this.nextReceiptSeq++}`;
    const expiresAt = hasCompensation && command.undoWindowMs ? timestamp + command.undoWindowMs : null;
    const receipt = {
      receiptId,
      commandId: command.id,
      title: command.title,
      category: command.category,
      effect: command.effect,
      reversibility: effectiveReversibility,
      canUndo: hasCompensation,
      executedAt: timestamp,
      expiresAt,
      taskId,
      summary: executionResult?.summary || command.title
    };

    if (command.effect !== 'leitura') {
      this.undoHistory.push({
        ...receipt,
        undone: false,
        compensate: hasCompensation ? executionResult.compensate : null
      });
    }

    this.auditLog.push(Object.freeze({
      timestamp,
      receiptId,
      commandId: command.id,
      caller,
      taskId,
      reversibility: effectiveReversibility,
      status: 'executed'
    }));

    return {
      ok: true,
      value: executionResult?.value !== undefined ? executionResult.value : executionResult,
      receipt
    };
  }

  async undoReceipt(receiptId, { caller = 'user' } = {}) {
    const entry = this.undoHistory.find((item) => item.receiptId === String(receiptId));
    if (!entry) {
      return { ok: false, code: 'RECEIPT_NOT_FOUND', error: 'Recibo não encontrado para desfazer.' };
    }
    if (entry.undone) {
      return { ok: false, code: 'ALREADY_UNDONE', error: 'Esta ação já foi desfeita.' };
    }
    if (!entry.canUndo || typeof entry.compensate !== 'function') {
      return {
        ok: false,
        code: 'IRREVERSIBLE_ACTION',
        reversibility: entry.reversibility,
        error: `A ação "${entry.title}" é classificada como ${entry.reversibility} e não possui operação inversa.`
      };
    }
    const current = this.now();
    if (entry.expiresAt && current > entry.expiresAt) {
      return {
        ok: false,
        code: 'UNDO_WINDOW_EXPIRED',
        error: `A janela para desfazer "${entry.title}" expirou.`
      };
    }

    const compensationValue = await entry.compensate();
    entry.undone = true;
    entry.undoneAt = current;

    this.auditLog.push(Object.freeze({
      timestamp: current,
      receiptId: entry.receiptId,
      commandId: entry.commandId,
      caller,
      taskId: entry.taskId,
      status: 'undone'
    }));

    return {
      ok: true,
      receiptId: entry.receiptId,
      commandId: entry.commandId,
      title: entry.title,
      reversibility: entry.reversibility,
      value: compensationValue
    };
  }

  async undoSequence({ taskId = null, count = null, caller = 'user' } = {}) {
    const candidates = [...this.undoHistory]
      .reverse()
      .filter((entry) => !entry.undone && (!taskId || entry.taskId === String(taskId)));
    const slice = Number.isFinite(count) && count > 0 ? candidates.slice(0, count) : candidates;
    const restored = [];
    const skippedIrreversible = [];

    for (const entry of slice) {
      const res = await this.undoReceipt(entry.receiptId, { caller });
      if (res.ok) {
        restored.push(res);
      } else {
        skippedIrreversible.push({
          receiptId: entry.receiptId,
          commandId: entry.commandId,
          title: entry.title,
          code: res.code,
          error: res.error
        });
      }
    }

    return {
      ok: skippedIrreversible.length === 0 && restored.length > 0,
      restored,
      skippedIrreversible
    };
  }
}

// Classificador local de intenção para a Barra de Comando única (Ctrl+K)
function classifyCommandBarInput(rawInput = '') {
  const text = String(rawInput || '').trim();
  if (!text) return { kind: 'empty', text: '' };

  if (/^(https?:\/\/|file:\/\/|zero:\/\/|about:|www\.)/i.test(text)
    || /^(localhost|(?:[\w-]+\.)+[a-z]{2,})(?::\d+)?(?:[/?#]|$)/i.test(text)) {
    return { kind: 'url', text, preview: `Ir para ${text}` };
  }

  const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const browserCommands = [
    { match: /^(fechar\s+abas\s+duplicadas|remover\s+abas\s+duplicadas)$/, commandId: 'tabs.closeDuplicates', preview: 'Comando: Fechar abas duplicadas (reversível)' },
    { match: /^(nova\s+aba|abrir\s+nova\s+aba)$/, commandId: 'tabs.new', preview: 'Comando: Abrir nova aba' },
    { match: /^(reabrir\s+aba|restaurar\s+aba)$/, commandId: 'tabs.reopenClosed', preview: 'Comando: Reabrir última aba fechada' },
    { match: /^(abrir\s+central|central\s+de\s+bots|equipe\s+de\s+bots)$/, commandId: 'bots.openCentral', preview: 'Comando: Abrir Central de Bots' },
    { match: /^(alternar\s+tema|mudar\s+tema|modo\s+escuro|modo\s+claro|tema\s+escuro|tema\s+claro)$/, commandId: 'ui.toggleTheme', preview: 'Comando: Alternar tema claro/escuro (reversível)' },
    { match: /^(modo\s+delegar|abrir\s+delegar|delegar)$/, commandId: 'ui.openDelegation', preview: 'Comando: Alternar para modo Delegar' },
    { match: /^(modo\s+navegar|fechar\s+delegar)$/, commandId: 'ui.closeDelegation', preview: 'Comando: Voltar ao modo Navegar' },
    { match: /^(historico|abrir\s+historico|ver\s+historico)$/, commandId: 'library.openHistory', preview: 'Comando: Abrir Histórico' },
    { match: /^(favoritos|abrir\s+favoritos|ver\s+favoritos)$/, commandId: 'library.openBookmarks', preview: 'Comando: Abrir Favoritos' },
    { match: /^(downloads|abrir\s+downloads|ver\s+downloads)$/, commandId: 'library.openDownloads', preview: 'Comando: Abrir Downloads' },
    { match: /^(configuracoes|abrir\s+configuracoes)$/, commandId: 'settings.open', preview: 'Comando: Abrir Configurações' },
    { match: /^(extensoes|abrir\s+extensoes)$/, commandId: 'extensions.open', preview: 'Comando: Abrir Extensões' },
    { match: /^(desfazer|desfazer\s+ultima\s+acao)$/, commandId: 'undo.last', preview: 'Comando: Desfazer última ação reversível' }
  ];

  for (const item of browserCommands) {
    if (item.match.test(lower)) {
      return { kind: 'command', commandId: item.commandId, text, preview: item.preview };
    }
  }

  const delegateCue = /^(monitore|pesquise\s+e\s+compare|preencha|resuma\s+esta\s+pagina|extraia|compare\s+os\s+precos|acompanhe|delegar:|bot:)\b/;
  if (delegateCue.test(lower)) {
    return { kind: 'delegate', text: text.replace(/^(delegar:|bot:)\s*/i, ''), preview: `Delegar ao Bot: "${text}"` };
  }

  return { kind: 'search', text, preview: `Pesquisar "${text}"` };
}

module.exports = {
  CommandRegistry,
  UntouchableCoreError,
  UNTOUCHABLE_CORE_IDS,
  VALID_EFFECTS,
  VALID_REVERSIBILITY,
  isUntouchableTarget,
  classifyCommandBarInput
};


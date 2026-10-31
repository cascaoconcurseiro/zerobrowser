'use strict';

const { redactSecrets } = require('../automation/service/intent-firewall');

class TeachTaskRecorder {
  constructor({ store } = {}) {
    this.store = store || null;
    this.sessions = new Map();
    this.writeApprovalQueue = new Map();
  }

  startRecording({ title = 'Nova tarefa ensinada', startUrl = 'https://exemplo.com.br' } = {}) {
    const sessionId = `teach-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const session = {
      sessionId,
      title: String(title).trim(),
      startUrl,
      status: 'recording',
      steps: [],
      startedAt: new Date().toISOString()
    };
    this.sessions.set(sessionId, session);
    return structuredClone(session);
  }

  recordEvent(sessionId, event = {}) {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'recording') {
      throw new Error('Sessão de gravação não encontrada ou já encerrada.');
    }
    const kind = String(event.kind || 'click').toLowerCase();
    const isSensitiveField = Boolean(event.isPassword || /password|senha|token|cvv/i.test(String(event.fieldName || '')));
    const stepNumber = session.steps.length + 1;

    let humanSummary = '';
    if (kind === 'navigate') {
      humanSummary = `Abrir a página ${event.url || session.startUrl}`;
    } else if (kind === 'click') {
      humanSummary = `Clicar em "${event.label || event.selector || 'elemento'}"`;
    } else if (kind === 'type') {
      humanSummary = isSensitiveField
        ? `Preencher campo sensível "${event.label || event.fieldName}" (valor protegido — nunca salvo na ficha)`
        : `Digitar "${redactSecrets(String(event.value || ''))}" em "${event.label || event.fieldName || 'campo'}"`;
    } else if (kind === 'extract') {
      humanSummary = `Ler "${event.label || 'valor selecionado'}" (${event.selector || 'elemento'})`;
    } else {
      humanSummary = `Executar ${kind} em "${event.label || event.selector || 'página'}"`;
    }

    const step = {
      stepNumber,
      kind,
      selector: event.selector || null,
      label: event.label || null,
      value: isSensitiveField ? null : redactSecrets(event.value ?? null),
      effect: event.effect || (kind === 'extract' || kind === 'navigate' ? 'leitura' : 'interacao'),
      humanSummary
    };
    session.steps.push(step);
    return structuredClone(step);
  }

  stopRecording(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Sessão de gravação não encontrada.');
    session.status = 'review';
    return {
      sessionId: session.sessionId,
      title: session.title,
      startUrl: session.startUrl,
      numberedSummary: session.steps.map((s) => `${s.stepNumber}. ${s.humanSummary}`),
      steps: structuredClone(session.steps)
    };
  }

  editRecordedStep(sessionId, stepNumber, updates = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Sessão de gravação não encontrada.');
    const target = session.steps.find((s) => s.stepNumber === Number(stepNumber));
    if (!target) throw new Error(`Passo ${stepNumber} não encontrado.`);
    if (updates.humanSummary != null) target.humanSummary = String(updates.humanSummary);
    if (updates.label != null) target.label = String(updates.label);
    if (updates.value !== undefined) target.value = redactSecrets(updates.value);
    return structuredClone(target);
  }

  saveAsBot(sessionId, { name, schedule = { enabled: false, kind: 'manual' } } = {}) {
    if (!this.store) throw new Error('BotTaskStore necessário para salvar como Bot.');
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Sessão de gravação não encontrada.');

    return this.store.createBot({
      name: name || session.title,
      template: 'taught-task',
      goal: session.steps.map((s) => `${s.stepNumber}. ${s.humanSummary}`).join(' | '),
      inputs: {
        startUrl: session.startUrl,
        taughtSteps: session.steps
      },
      allowedSites: [session.startUrl],
      permission: 'somente-leitura',
      schedule
    });
  }

  enqueueWriteApproval({ botId, step, targetSite, reversibility = 'irreversivel' } = {}) {
    const approvalId = `apprv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const item = {
      approvalId,
      botId,
      step: redactSecrets(step),
      targetSite,
      reversibility,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    this.writeApprovalQueue.set(approvalId, item);
    return structuredClone(item);
  }

  resolveWriteApproval(approvalId, { decision = 'cancel', approvedByUser = false } = {}) {
    const item = this.writeApprovalQueue.get(approvalId);
    if (!item) throw new Error('Pedido de aprovação não encontrado.');
    if ((decision === 'approve-once' || decision === 'always-site') && !approvedByUser) {
      throw new Error('Aprovação de escrita exige confirmação humana.');
    }
    item.status = decision === 'approve-once' || decision === 'always-site' ? 'approved' : 'cancelled';
    item.scope = decision;
    return structuredClone(item);
  }
}

module.exports = {
  TeachTaskRecorder
};


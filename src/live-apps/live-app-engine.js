'use strict';

const crypto = require('node:crypto');
const {
  evaluateActionIntent,
  createVerifiedReceipt,
  verifyReceiptMatchesRequest,
  redactSecrets,
  tagValueOrigin
} = require('../automation/service/intent-firewall');

const STRICT_OFFLINE_CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'none'; frame-src 'none'; form-action 'none'";

class LiveAppEngine {
  constructor() {
    this.apps = new Map();
  }

  createApp({
    id = null,
    title,
    description = '',
    sources = [],
    sourcesApprovedByUser = false,
    schema = {},
    initialRows = []
  } = {}) {
    if (!title) throw new Error('LiveApp precisa de um título.');
    if (sources.length > 0 && !sourcesApprovedByUser) {
      throw new Error('As fontes do App Vivo precisam ser aprovadas pelo usuário antes da criação.');
    }
    const appId = id || `live-app-${crypto.randomUUID().slice(0, 8)}`;
    const manifest = {
      appId,
      schemaVersion: 1,
      title: String(title),
      description: String(description),
      csp: STRICT_OFFLINE_CSP,
      networkAccess: 'none',
      sources: sources.map((s) => ({ ...s })),
      schema: { ...schema }
    };

    const state = {
      manifest,
      version: 1,
      versions: [{ version: 1, manifest: structuredClone(manifest), createdAt: new Date().toISOString() }],
      rows: initialRows.map((r) => redactSecrets(r)),
      updatedAt: new Date().toISOString()
    };
    this.apps.set(appId, state);
    return structuredClone(state);
  }

  static createWeeklyDueAppPrototype({ engine, rows = [] } = {}) {
    const targetEngine = engine || new LiveAppEngine();
    const defaultRows = rows.length ? rows : [
      { id: 'due-1', source: 'banco', title: 'Energia Elétrica', dueDate: '2026-11-03', amount: 245.90, status: 'pending' },
      { id: 'due-2', source: 'agenda', title: 'Servidor Cloud', dueDate: '2026-11-05', amount: 180.00, status: 'pending' },
      { id: 'due-3', source: 'fornecedor', title: 'Licença Software', dueDate: '2026-11-06', amount: 390.00, status: 'pending' }
    ];
    return targetEngine.createApp({
      id: 'weekly-due-prototype',
      title: 'Meus vencimentos da semana',
      description: 'Painel local unificando 3 fontes (banco, agenda e fornecedores) sem acesso direto à rede.',
      sources: [
        { id: 'src-bank', kind: 'route', label: 'Boletos do Banco' },
        { id: 'src-cal', kind: 'bot', label: 'Lembretes da Agenda' },
        { id: 'src-sup', kind: 'route', label: 'Faturas de Fornecedores' }
      ],
      sourcesApprovedByUser: true,
      schema: { fields: ['id', 'source', 'title', 'dueDate', 'amount', 'status'] },
      initialRows: defaultRows
    });
  }

  generateLiveAppFromPrompt({ prompt, proposedSources = [], approvedByUser = false } = {}) {
    if (!approvedByUser) {
      throw new Error('Geração de App Vivo por conversa exige aprovação das fontes pelo usuário.');
    }
    return this.createApp({
      title: `App Vivo · ${String(prompt || 'Painel').slice(0, 40)}`,
      description: String(prompt || ''),
      sources: proposedSources,
      sourcesApprovedByUser: true
    });
  }

  ingestFromReadOnlySource(appId, { sourceId, permission = 'somente-leitura', items = [] } = {}) {
    const app = this.apps.get(appId);
    if (!app) throw new Error(`App Vivo "${appId}" não encontrado.`);
    if (permission !== 'somente-leitura') {
      throw new Error('Coleta de dados do App Vivo aceita apenas fontes em modo somente leitura.');
    }
    const allowedSource = app.manifest.sources.some((s) => s.id === sourceId);
    if (!allowedSource) {
      throw new Error(`Fonte "${sourceId}" não está autorizada no manifesto deste App Vivo.`);
    }
    for (const item of items) {
      app.rows.push(redactSecrets({ ...item, sourceId }));
    }
    app.updatedAt = new Date().toISOString();
    return structuredClone(app.rows);
  }

  dispatchLiveAppAction(appId, {
    action,
    targetUrl,
    params = {},
    externalContext = '',
    approvalReceipt = null,
    executeFn = null
  } = {}) {
    const app = this.apps.get(appId);
    if (!app) throw new Error(`App Vivo "${appId}" não encontrado.`);

    const firewall = evaluateActionIntent({
      action,
      effect: 'escreve',
      currentSite: targetUrl,
      targetUrl,
      params,
      externalContext,
      approvalReceipt
    });

    if (!firewall.allowed) {
      return {
        ok: false,
        blocked: true,
        decision: firewall.decision,
        reason: firewall.reason,
        proposedReceipt: createVerifiedReceipt({
          action,
          title: `${app.manifest.title} · ${action}`,
          targetUrl,
          params
        })
      };
    }

    if (!approvalReceipt || !verifyReceiptMatchesRequest(approvalReceipt, { action, targetUrl, params }).matches) {
      return {
        ok: false,
        blocked: true,
        decision: 'require_approval',
        reason: 'Toda ação disparada a partir de um App Vivo exige recibo verificado e aprovado pelo usuário.',
        proposedReceipt: createVerifiedReceipt({
          action,
          title: `${app.manifest.title} · ${action}`,
          targetUrl,
          params
        })
      };
    }

    const result = typeof executeFn === 'function' ? executeFn(params) : { executed: true };
    return {
      ok: true,
      blocked: false,
      receiptId: approvalReceipt.id,
      result
    };
  }

  exportPackageWithoutPersonalData(appId) {
    const app = this.apps.get(appId);
    if (!app) throw new Error(`App Vivo "${appId}" não encontrado.`);
    return {
      schemaVersion: 1,
      manifest: structuredClone(app.manifest),
      // Exporta apenas a estrutura e o manifesto, sem linhas de dados pessoais (rows)
      rows: []
    };
  }
}

module.exports = {
  STRICT_OFFLINE_CSP,
  LiveAppEngine
};


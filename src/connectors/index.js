'use strict';

const {
  tagValueOrigin,
  evaluateActionIntent,
  createVerifiedReceipt,
  verifyReceiptMatchesRequest,
  redactSecrets
} = require('../automation/service/intent-firewall');
const { UNTOUCHABLE_CORE_IDS, UntouchableCoreError } = require('../main/command-registry');

class NativeConnectorsHub {
  constructor() {
    this.drafts = new Map();
  }

  // Fase 4a: Conectores somente leitura — todo dado retornado recebe etiqueta 'externo'
  readServiceData({ connector, query = {}, mockItems = [] } = {}) {
    const valid = new Set(['email.read', 'calendar.read', 'files.read', 'notion.read', 'github.read']);
    if (!valid.has(connector)) {
      throw new Error(`Conector de leitura desconhecido: "${connector}".`);
    }
    return mockItems.map((item) => ({
      connector,
      query,
      data: tagValueOrigin(redactSecrets(item), 'externo', { source: connector })
    }));
  }

  // Fase 4b: Conectores de escrita — criam rascunho primeiro e exigem Recibo Verificado + Firewall
  createWriteDraft({ connector, targetUrl, params = {}, externalContext = '' } = {}) {
    const valid = new Set(['email.send', 'calendar.createEvent', 'github.createIssue', 'slack.postMessage']);
    if (!valid.has(connector)) {
      throw new Error(`Conector de escrita desconhecido: "${connector}".`);
    }

    const firewall = evaluateActionIntent({
      action: connector,
      effect: 'escreve',
      currentSite: targetUrl,
      targetUrl,
      params,
      externalContext
    });

    if (firewall.hostileContextDetected) {
      return {
        ok: false,
        status: 'blocked_firewall',
        reason: firewall.reason
      };
    }

    const receipt = createVerifiedReceipt({
      action: connector,
      title: `Rascunho · ${connector}`,
      targetUrl,
      reversibility: 'irreversivel',
      params
    });

    const draft = {
      draftId: `draft-${receipt.id}`,
      connector,
      targetUrl,
      params,
      receipt,
      status: 'pending_approval'
    };
    this.drafts.set(draft.draftId, draft);
    return {
      ok: true,
      status: 'draft_created',
      draftId: draft.draftId,
      receipt
    };
  }

  executeApprovedDraft(draftId, { approvalReceipt, actualRequestParams = null } = {}) {
    const draft = this.drafts.get(draftId);
    if (!draft) throw new Error(`Rascunho "${draftId}" não encontrado.`);
    const paramsToVerify = actualRequestParams || draft.params;

    const check = verifyReceiptMatchesRequest(approvalReceipt, {
      action: draft.connector,
      targetUrl: draft.targetUrl,
      params: paramsToVerify
    });
    if (!check.matches) {
      return { ok: false, status: 'rejected_mismatch', reason: check.reason };
    }
    draft.status = 'executed';
    return { ok: true, status: 'executed', draftId: draft.draftId };
  }
}

class ExternalMcpClient {
  constructor() {
    this.servers = new Map();
  }

  connectServer({ serverId, name, isThirdParty = true, thirdPartyRiskAcknowledged = false, tools = [] } = {}) {
    if (isThirdParty && !thirdPartyRiskAcknowledged) {
      throw new Error('Conectar servidor MCP de terceiros exige confirmação explícita do aviso de risco.');
    }
    const record = {
      serverId,
      name: String(name || serverId),
      isThirdParty: Boolean(isThirdParty),
      tools: [...tools]
    };
    this.servers.set(serverId, record);
    return structuredClone(record);
  }
}

class AuthorizedMessagingBridge {
  constructor({ channel = 'telegram', authorizedSenderIds = [] } = {}) {
    this.channel = channel;
    this.authorizedSenders = new Set(authorizedSenderIds.map((id) => String(id)));
  }

  handleIncomingMessage({ senderId, command, args = {} } = {}) {
    const normalizedSender = String(senderId || '');
    if (!this.authorizedSenders.has(normalizedSender)) {
      return {
        accepted: false,
        code: 'UNAUTHORIZED_SENDER',
        reason: `Remetente "${normalizedSender}" não está na lista de remetentes autorizados.`
      };
    }
    if (UNTOUCHABLE_CORE_IDS.includes(command)) {
      throw new UntouchableCoreError(
        `O comando "${command}" pertence ao núcleo intocável e não pode ser alterado via mensageria.`,
        command
      );
    }
    return {
      accepted: true,
      channel: this.channel,
      senderId: normalizedSender,
      command,
      args: redactSecrets(args)
    };
  }
}

module.exports = {
  NativeConnectorsHub,
  ExternalMcpClient,
  AuthorizedMessagingBridge
};


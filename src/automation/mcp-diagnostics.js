'use strict';

const crypto = require('node:crypto');
const { redactSecrets } = require('./service/intent-firewall');
const { UNTOUCHABLE_CORE_IDS, UntouchableCoreError } = require('../main/command-registry');

const PERMISSION_LEVELS = Object.freeze({
  observar: 1,
  interagir: 2,
  desenvolvedor: 3,
  total: 4
});

const TOOL_MINIMUM_LEVEL = Object.freeze({
  // Nível 1: observar (leitura de página, console, erros e rede com segredos redigidos)
  browser_get_text: 'observar',
  browser_screenshot: 'observar',
  browser_get_tabs: 'observar',
  console_messages: 'observar',
  page_errors: 'observar',
  network_requests: 'observar',

  // Nível 2: interagir (clicar, digitar, navegar, abas)
  browser_navigate: 'interagir',
  browser_click: 'interagir',
  browser_type: 'interagir',
  browser_scroll: 'interagir',
  browser_wait: 'interagir',
  browser_new_tab: 'interagir',
  browser_close_tab: 'interagir',

  // Nível 3: desenvolvedor (evaluate, CDP, performance)
  browser_evaluate: 'desenvolvedor',
  browser_cdp_send: 'desenvolvedor',
  browser_cdp_events: 'desenvolvedor',
  performance_trace: 'desenvolvedor',

  // Nível 4: total (histórico, favoritos, downloads, configurações, perfis, extensões)
  library_history_query: 'total',
  library_bookmarks_manage: 'total',
  library_downloads_list: 'total',
  settings_manage: 'total',
  profiles_manage: 'total',
  extensions_manage: 'total'
});

const ALWAYS_APPROVAL_ACTIONS = new Set([
  'submit_payment',
  'send_external_form',
  'delete_user_data',
  'read_raw_cookies',
  'read_saved_passwords'
]);

class McpClientRegistry {
  constructor({ now = () => Date.now() } = {}) {
    this.now = now;
    this.clients = new Map();
    this.auditLog = [];
    this.diagnosticsBuffer = {
      consoleMessages: [],
      pageErrors: [],
      networkRequests: []
    };
  }

  pairClient({
    clientId,
    name,
    level = 'observar',
    profileId = 'default',
    allowedSites = ['*'],
    ttlMs = 3_600_000,
    approvedByUser = false
  } = {}) {
    if (!approvedByUser) {
      throw new Error('Pareamento de cliente MCP exige aprovação explícita do usuário.');
    }
    if (!PERMISSION_LEVELS[level]) {
      throw new Error(`Nível de permissão inválido: "${level}".`);
    }
    const id = String(clientId || `mcp-client-${crypto.randomUUID().slice(0, 8)}`);
    const token = `zbmcp_${crypto.randomBytes(24).toString('hex')}`;
    const issuedAt = this.now();
    const record = {
      clientId: id,
      name: String(name || id),
      level,
      profileId,
      allowedSites: Array.isArray(allowedSites) ? [...allowedSites] : ['*'],
      token,
      issuedAt,
      expiresAt: issuedAt + Math.max(1000, Number(ttlMs) || 3_600_000),
      revoked: false
    };
    this.clients.set(id, record);
    return { ...record };
  }

  revokeClient(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return false;
    client.revoked = true;
    return true;
  }

  revokeAllClients() {
    for (const client of this.clients.values()) {
      client.revoked = true;
    }
  }

  authorizeCall({ token, tool, args = {}, site = null } = {}) {
    const client = [...this.clients.values()].find((c) => c.token === token);
    if (!client) {
      this._recordAudit(null, tool, 'denied_invalid_token');
      return { allowed: false, code: 'INVALID_TOKEN', reason: 'Token MCP inválido ou desconhecido.' };
    }
    if (client.revoked) {
      this._recordAudit(client.clientId, tool, 'denied_revoked');
      return { allowed: false, code: 'CLIENT_REVOKED', reason: 'Cliente MCP revogado pelo usuário.' };
    }
    if (this.now() > client.expiresAt) {
      this._recordAudit(client.clientId, tool, 'denied_expired');
      return { allowed: false, code: 'TOKEN_EXPIRED', reason: 'Concessão do cliente MCP expirou.' };
    }

    if (
      UNTOUCHABLE_CORE_IDS.includes(tool) ||
      UNTOUCHABLE_CORE_IDS.includes(args?.key) ||
      /^(?:security\.|firewall\.|audit\.|vault\.|ui\.hide(?:StopAll|ControlIndicator|ApprovalCard|BotCentral))/i.test(String(tool || '')) ||
      /^(?:security\.|firewall\.|audit\.|vault\.)/i.test(String(args?.key || ''))
    ) {
      this._recordAudit(client.clientId, tool, 'denied_untouchable_core');
      throw new UntouchableCoreError(args?.key || tool, `mcp:${client.clientId}`);
    }

    if (ALWAYS_APPROVAL_ACTIONS.has(tool) && !args?.userApproved) {
      this._recordAudit(client.clientId, tool, 'requires_approval');
      return {
        allowed: false,
        code: 'APPROVAL_REQUIRED',
        reason: `A ferramenta "${tool}" exige aprovação explícita do usuário mesmo no nível total.`
      };
    }

    const requiredLevel = TOOL_MINIMUM_LEVEL[tool] || 'total';
    if (PERMISSION_LEVELS[client.level] < PERMISSION_LEVELS[requiredLevel]) {
      this._recordAudit(client.clientId, tool, 'denied_insufficient_level');
      return {
        allowed: false,
        code: 'INSUFFICIENT_LEVEL',
        reason: `A ferramenta "${tool}" requer nível "${requiredLevel}", mas o cliente possui "${client.level}".`
      };
    }

    if (site && !client.allowedSites.includes('*') && !client.allowedSites.includes(site)) {
      this._recordAudit(client.clientId, tool, 'denied_site_scope');
      return {
        allowed: false,
        code: 'SITE_OUT_OF_SCOPE',
        reason: `Site "${site}" fora do escopo autorizado para este cliente MCP.`
      };
    }

    this._recordAudit(client.clientId, tool, 'allowed');
    return { allowed: true, clientId: client.clientId, level: client.level };
  }

  recordConsoleMessage(entry = {}) {
    this.diagnosticsBuffer.consoleMessages.push({
      level: String(entry.level || 'info'),
      text: redactSecrets(String(entry.text || '')),
      url: entry.url || null,
      lineNumber: Number(entry.lineNumber) || 0,
      timestamp: entry.timestamp || this.now()
    });
  }

  recordPageError(entry = {}) {
    this.diagnosticsBuffer.pageErrors.push({
      message: redactSecrets(String(entry.message || '')),
      stack: redactSecrets(String(entry.stack || '')),
      url: entry.url || null,
      timestamp: entry.timestamp || this.now()
    });
  }

  recordNetworkRequest(entry = {}) {
    this.diagnosticsBuffer.networkRequests.push({
      requestId: entry.requestId || `req-${this.diagnosticsBuffer.networkRequests.length + 1}`,
      method: String(entry.method || 'GET').toUpperCase(),
      url: redactSecrets(String(entry.url || '')),
      status: Number(entry.status) || 0,
      headers: redactSecrets(entry.headers || {}),
      requestBody: redactSecrets(entry.requestBody ?? null),
      responseBody: redactSecrets(entry.responseBody ?? null),
      timestamp: entry.timestamp || this.now()
    });
  }

  executeDiagnosticTool({ token, tool, args = {} } = {}) {
    const auth = this.authorizeCall({ token, tool, args });
    if (!auth.allowed) {
      return auth;
    }

    if (tool === 'console_messages') {
      const levelFilter = args.level ? String(args.level).toLowerCase() : null;
      const items = this.diagnosticsBuffer.consoleMessages.filter(
        (m) => !levelFilter || m.level.toLowerCase() === levelFilter
      );
      return { allowed: true, items };
    }

    if (tool === 'page_errors') {
      return { allowed: true, items: [...this.diagnosticsBuffer.pageErrors] };
    }

    if (tool === 'network_requests') {
      const urlInclude = args.urlContains ? String(args.urlContains).toLowerCase() : null;
      const statusFilter = args.status != null ? Number(args.status) : null;
      const items = this.diagnosticsBuffer.networkRequests.filter((req) => {
        if (urlInclude && !req.url.toLowerCase().includes(urlInclude)) return false;
        if (statusFilter != null && req.status !== statusFilter) return false;
        return true;
      });
      return { allowed: true, items };
    }

    return { allowed: false, code: 'UNKNOWN_DIAGNOSTIC_TOOL', reason: `Ferramenta "${tool}" desconhecida.` };
  }

  getAuditLog() {
    return [...this.auditLog];
  }

  _recordAudit(clientId, tool, decision) {
    this.auditLog.push({
      clientId,
      tool,
      decision,
      timestamp: this.now()
    });
  }
}

module.exports = {
  PERMISSION_LEVELS,
  TOOL_MINIMUM_LEVEL,
  McpClientRegistry
};

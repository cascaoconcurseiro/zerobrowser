'use strict';

const crypto = require('node:crypto');
const {
  evaluateActionIntent,
  redactSecrets,
  tagValueOrigin,
  getOriginOf,
  unwrapValue
} = require('./service/intent-firewall');

const NOISE_URL_PATTERN = /(?:\.(?:png|jpe?g|gif|webp|svg|ico|woff2?|ttf|eot|css|map)(?:\?|$)|google-analytics|doubleclick|hotjar|segment\.io|sentry\.io|clarity\.ms|facebook\.com\/tr)/i;

class NetworkRouteObserver {
  constructor() {
    this.captured = [];
  }

  observeRequest(req = {}) {
    const url = String(req.url || '').trim();
    if (!url || NOISE_URL_PATTERN.test(url)) {
      return null;
    }
    const resourceType = String(req.resourceType || 'fetch').toLowerCase();
    if (resourceType && !['fetch', 'xhr', 'xmlhttprequest', 'api'].includes(resourceType)) {
      return null;
    }

    const entry = {
      id: `obs-${this.captured.length + 1}`,
      method: String(req.method || 'GET').toUpperCase(),
      url: redactSecrets(url),
      status: Number(req.status) || 200,
      requestHeaders: redactSecrets(req.requestHeaders || {}),
      requestBody: redactSecrets(req.requestBody ?? null),
      responseSample: redactSecrets(req.responseBody ?? null),
      timestamp: req.timestamp || Date.now()
    };
    this.captured.push(entry);
    return entry;
  }

  listCandidateRoutes() {
    const grouped = new Map();
    for (const item of this.captured) {
      let parsed;
      try {
        parsed = new URL(item.url);
      } catch {
        continue;
      }
      const key = `${item.method} ${parsed.origin}${parsed.pathname}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          signature: key,
          site: parsed.origin,
          method: item.method,
          pathname: parsed.pathname,
          samples: []
        });
      }
      grouped.get(key).samples.push(item);
    }
    return [...grouped.values()];
  }
}

class RouteCompiler {
  static compileFromSamples({
    site,
    profileId = 'default',
    name,
    intent,
    method = 'GET',
    samples = [],
    effect = null,
    reversibility = null
  } = {}) {
    if (!samples.length) {
      throw new Error('RouteCompiler requer pelo menos 1 amostra de requisição.');
    }
    const normalizedMethod = String(method || samples[0].method || 'GET').toUpperCase();
    const inferredEffect = effect || (normalizedMethod === 'GET' || normalizedMethod === 'HEAD' ? 'leitura' : 'escreve');
    const inferredReversibility = reversibility || (inferredEffect === 'leitura' ? 'reversivel' : 'irreversivel');

    const firstUrl = new URL(samples[0].url);
    const paramDefs = [];
    const varyingQueryKeys = new Set();

    if (samples.length > 1) {
      const secondUrl = new URL(samples[1].url);
      for (const [k, v1] of firstUrl.searchParams.entries()) {
        const v2 = secondUrl.searchParams.get(k);
        if (v1 !== v2) {
          varyingQueryKeys.add(k);
        }
      }
    } else {
      for (const k of firstUrl.searchParams.keys()) {
        varyingQueryKeys.add(k);
      }
    }

    const queryParts = [];
    for (const [k, v] of firstUrl.searchParams.entries()) {
      if (varyingQueryKeys.has(k)) {
        paramDefs.push({
          name: k,
          in: 'query',
          type: Number.isFinite(Number(v)) && v !== '' ? 'number' : 'string',
          defaultOrigin: 'usuario'
        });
        queryParts.push(`${k}={${k}}`);
      } else {
        queryParts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
      }
    }

    const urlTemplate = `${firstUrl.origin}${firstUrl.pathname}${queryParts.length ? `?${queryParts.join('&')}` : ''}`;

    return {
      id: `route-${crypto.randomUUID().slice(0, 8)}`,
      site: site || firstUrl.origin,
      profileId,
      name: String(name || intent || `${normalizedMethod} ${firstUrl.pathname}`),
      intent: String(intent || name || firstUrl.pathname),
      method: normalizedMethod,
      urlTemplate,
      params: paramDefs,
      effect: inferredEffect,
      reversibility: inferredReversibility,
      // Rotas de escrita ficam desligadas por padrão até ativação humana
      enabled: inferredEffect === 'leitura',
      needsRelearning: false,
      runs: 0,
      successes: 0,
      successRate: 1,
      lastVerifiedAt: new Date().toISOString(),
      evidenceSample: redactSecrets(samples[0])
    };
  }
}

class LearnedRouteLibrary {
  constructor() {
    this.routes = new Map();
  }

  addRoute(route) {
    const copy = structuredClone(route);
    if (copy.effect === 'escreve' && copy.explicitlyEnabledByUser !== true) {
      copy.enabled = false;
    }
    this.routes.set(copy.id, copy);
    return structuredClone(copy);
  }

  setRouteEnabled(routeId, enabled, { confirmedByUser = false } = {}) {
    const route = this.routes.get(routeId);
    if (!route) throw new Error(`Rota "${routeId}" não encontrada.`);
    if (enabled && route.effect === 'escreve' && !confirmedByUser) {
      throw new Error('Ativar rota de escrita exige confirmação explícita do usuário.');
    }
    route.enabled = Boolean(enabled);
    return structuredClone(route);
  }

  findMatchingRoute({ site, profileId = 'default', intent }) {
    for (const route of this.routes.values()) {
      if (
        route.enabled &&
        !route.needsRelearning &&
        route.site === site &&
        route.profileId === profileId &&
        route.intent === intent
      ) {
        return structuredClone(route);
      }
    }
    return null;
  }

  recordExecutionOutcome(routeId, ok) {
    const route = this.routes.get(routeId);
    if (!route) return null;
    route.runs += 1;
    if (ok) {
      route.successes += 1;
      route.lastVerifiedAt = new Date().toISOString();
    } else {
      route.needsRelearning = true;
    }
    route.successRate = Number((route.successes / route.runs).toFixed(4));
    return structuredClone(route);
  }

  exportLibrary() {
    return [...this.routes.values()].map((route) => ({
      id: route.id,
      site: route.site,
      name: route.name,
      intent: route.intent,
      method: route.method,
      urlTemplate: route.urlTemplate,
      params: route.params,
      effect: route.effect,
      reversibility: route.reversibility,
      // Rotas exportadas nunca levam segredos e rotas de escrita saem desligadas
      enabled: false
    }));
  }
}

class LearnedRouteExecutor {
  constructor({ library, httpCaller, clickFallbackCaller } = {}) {
    this.library = library;
    this.httpCaller = httpCaller;
    this.clickFallbackCaller = clickFallbackCaller;
  }

  buildUrl(urlTemplate, params = {}) {
    let url = String(urlTemplate || '');
    for (const [key, rawVal] of Object.entries(params)) {
      const val = encodeURIComponent(String(unwrapValue(rawVal) ?? ''));
      url = url.replace(`{${key}}`, val);
    }
    return url;
  }

  async executeRoute(routeId, params = {}, { externalContext = '', approvalReceipt = null } = {}) {
    const route = this.library.routes.get(routeId);
    if (!route) throw new Error(`Rota "${routeId}" não encontrada.`);
    if (!route.enabled) {
      throw new Error(`Rota "${route.name}" está desligada.`);
    }

    const builtUrl = this.buildUrl(route.urlTemplate, params);
    const firewall = evaluateActionIntent({
      action: `route:${route.intent}`,
      effect: route.effect,
      currentSite: route.site,
      targetUrl: builtUrl,
      params,
      externalContext,
      approvalReceipt
    });

    if (!firewall.allowed) {
      return {
        ok: false,
        blockedByFirewall: true,
        decision: firewall.decision,
        reason: firewall.reason
      };
    }

    try {
      const response = await this.httpCaller({
        method: route.method,
        url: builtUrl,
        params
      });

      if (!response || response.status >= 400 || response.schemaValid === false) {
        this.library.recordExecutionOutcome(route.id, false);
        if (typeof this.clickFallbackCaller === 'function') {
          const fallbackResult = await this.clickFallbackCaller({ route, params });
          return {
            ok: true,
            mode: 'click_fallback',
            fallbackUsed: true,
            needsRelearning: true,
            notice: 'Rota precisa ser reaprendida; execução concluída pelo modo clicar.',
            data: fallbackResult
          };
        }
        return {
          ok: false,
          fallbackUsed: false,
          needsRelearning: true,
          reason: `Rota retornou status ${response?.status || 'inválido'}.`
        };
      }

      this.library.recordExecutionOutcome(route.id, true);
      return {
        ok: true,
        mode: 'learned_route',
        fallbackUsed: false,
        needsRelearning: false,
        data: response.data
      };
    } catch (err) {
      this.library.recordExecutionOutcome(route.id, false);
      if (typeof this.clickFallbackCaller === 'function') {
        const fallbackResult = await this.clickFallbackCaller({ route, params, error: err });
        return {
          ok: true,
          mode: 'click_fallback',
          fallbackUsed: true,
          needsRelearning: true,
          notice: 'Rota precisa ser reaprendida; execução concluída pelo modo clicar.',
          data: fallbackResult
        };
      }
      throw err;
    }
  }
}

class WebMcpBridge {
  constructor({ routeLibrary, routeExecutor, recipeRunner, clickAgentRunner } = {}) {
    this.routeLibrary = routeLibrary;
    this.routeExecutor = routeExecutor;
    this.recipeRunner = recipeRunner;
    this.clickAgentRunner = clickAgentRunner;
    this.declaredPageTools = new Map(); // site -> Map(intent, toolDef)
  }

  registerPageModelContext(site, tools = []) {
    const map = new Map();
    for (const tool of tools) {
      if (tool && tool.intent) {
        map.set(tool.intent, tool);
      }
    }
    this.declaredPageTools.set(site, map);
  }

  // Ordem de preferência estrita (PLANO_ROTAS_E_FIREWALL.md §1):
  // 1. Ferramenta declarada pelo site (WebMCP)
  // 2. Rota aprendida válida
  // 3. Receita por site
  // 4. Agente olhando e clicando
  async dispatchByPreference({ site, profileId = 'default', intent, params = {}, externalContext = '' } = {}) {
    const pageTool = this.declaredPageTools.get(site)?.get(intent);
    if (pageTool) {
      const fw = evaluateActionIntent({
        action: `webmcp:${intent}`,
        effect: pageTool.effect || 'leitura',
        currentSite: site,
        params,
        externalContext
      });
      if (!fw.allowed) {
        return { ok: false, blockedByFirewall: true, tier: 'webmcp', reason: fw.reason };
      }
      const data = await pageTool.execute(params);
      return { ok: true, tier: 'webmcp', data };
    }

    const route = this.routeLibrary?.findMatchingRoute({ site, profileId, intent });
    if (route && this.routeExecutor) {
      const res = await this.routeExecutor.executeRoute(route.id, params, { externalContext });
      return { ...res, tier: res.fallbackUsed ? 'click_agent' : 'learned_route' };
    }

    if (typeof this.recipeRunner === 'function') {
      const recipeRes = await this.recipeRunner({ site, intent, params });
      if (recipeRes?.matched) {
        return { ok: true, tier: 'site_recipe', data: recipeRes.data };
      }
    }

    if (typeof this.clickAgentRunner === 'function') {
      const clickRes = await this.clickAgentRunner({ site, intent, params });
      return { ok: true, tier: 'click_agent', data: clickRes };
    }

    return { ok: false, tier: 'none', reason: 'Nenhum executor disponível.' };
  }
}

class LocalTwinSandbox {
  constructor() {
    this.snapshots = new Map();
  }

  captureTwin({ site, html, elements = {} } = {}) {
    const twinId = `twin-${crypto.randomUUID().slice(0, 8)}`;
    const record = {
      twinId,
      site,
      html: String(html || ''),
      elements: structuredClone(elements),
      capturedAt: new Date().toISOString()
    };
    this.snapshots.set(twinId, record);
    return structuredClone(record);
  }

  rehearseAction(twinId, { action, selector, proposedValue = null } = {}) {
    const twin = this.snapshots.get(twinId);
    if (!twin) throw new Error(`Gêmeo local "${twinId}" não encontrado.`);
    const target = twin.elements[selector];
    if (!target) {
      return {
        rehearsed: true,
        readOnly: true,
        selectorFound: false,
        layoutChanged: true,
        warning: `Seletor "${selector}" não existe mais no gêmeo local; o site pode ter mudado.`
      };
    }
    return {
      rehearsed: true,
      readOnly: true,
      selectorFound: true,
      layoutChanged: false,
      action,
      targetLabel: target.label || selector,
      beforeValue: target.value ?? null,
      afterPreview: proposedValue ?? target.value ?? null
    };
  }
}

module.exports = {
  NetworkRouteObserver,
  RouteCompiler,
  LearnedRouteLibrary,
  LearnedRouteExecutor,
  WebMcpBridge,
  LocalTwinSandbox
};


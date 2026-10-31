'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  NetworkRouteObserver,
  RouteCompiler,
  LearnedRouteLibrary,
  LearnedRouteExecutor,
  WebMcpBridge,
  LocalTwinSandbox
} = require('../src/automation/learned-routes');
const { tagValueOrigin } = require('../src/automation/service/intent-firewall');

test('NetworkRouteObserver filtra ruído e RouteCompiler gera rota parametrizada sem segredos', () => {
  const observer = new NetworkRouteObserver();

  // Ruído ignorado
  assert.equal(observer.observeRequest({ url: 'https://loja.com/logo.png', resourceType: 'image' }), null);
  assert.equal(observer.observeRequest({ url: 'https://www.google-analytics.com/collect' }), null);

  // Chamadas de API reais com token sensível
  observer.observeRequest({
    method: 'GET',
    url: 'https://api.loja.com/v1/search?q=notebook&page=1',
    requestHeaders: { Authorization: 'Bearer sk-1234567890abcdef' },
    responseBody: { items: [{ title: 'Notebook A', price: 3999 }] }
  });
  observer.observeRequest({
    method: 'GET',
    url: 'https://api.loja.com/v1/search?q=monitor&page=1',
    requestHeaders: { Authorization: 'Bearer sk-1234567890abcdef' },
    responseBody: { items: [{ title: 'Monitor B', price: 1499 }] }
  });

  const candidates = observer.listCandidateRoutes();
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].samples[0].requestHeaders.Authorization, '[REDIGIDO]');

  const compiled = RouteCompiler.compileFromSamples({
    site: 'https://api.loja.com',
    name: 'Buscar produto por termo',
    intent: 'search_product',
    samples: candidates[0].samples
  });

  assert.equal(compiled.effect, 'leitura');
  assert.equal(compiled.enabled, true);
  assert.equal(compiled.urlTemplate, 'https://api.loja.com/v1/search?q={q}&page=1');
  assert.equal(compiled.params.length, 1);
  assert.equal(compiled.params[0].name, 'q');
});

test('LearnedRouteExecutor cai automaticamente para o modo clicar quando a rota falha e bloqueia rotas de escrita não ativadas', async () => {
  const library = new LearnedRouteLibrary();
  const readRoute = RouteCompiler.compileFromSamples({
    site: 'https://api.loja.com',
    intent: 'get_price',
    samples: [{ method: 'GET', url: 'https://api.loja.com/v1/price?sku=ABC' }]
  });
  const savedRead = library.addRoute(readRoute);

  let simulateBreak = false;
  const executor = new LearnedRouteExecutor({
    library,
    httpCaller: async ({ url }) => {
      if (simulateBreak) return { status: 404, data: null };
      return { status: 200, data: { url, price: 4199 } };
    },
    clickFallbackCaller: async ({ params }) => ({
      price: 4199,
      recoveredViaClick: true,
      sku: params.sku
    })
  });

  // 1. Execução direta via rota aprendida
  const res1 = await executor.executeRoute(savedRead.id, { sku: 'XYZ-1' });
  assert.equal(res1.ok, true);
  assert.equal(res1.mode, 'learned_route');
  assert.equal(res1.fallbackUsed, false);

  // 2. Quando o site muda (404), faz queda automática para o modo clicar sem erro ao usuário
  simulateBreak = true;
  const res2 = await executor.executeRoute(savedRead.id, { sku: 'XYZ-2' });
  assert.equal(res2.ok, true);
  assert.equal(res2.mode, 'click_fallback');
  assert.equal(res2.fallbackUsed, true);
  assert.equal(res2.needsRelearning, true);

  // 3. Rota de escrita nasce desligada e exige confirmação do usuário para ligar
  const writeRoute = RouteCompiler.compileFromSamples({
    site: 'https://api.loja.com',
    intent: 'place_order',
    method: 'POST',
    samples: [{ method: 'POST', url: 'https://api.loja.com/v1/orders' }]
  });
  const savedWrite = library.addRoute(writeRoute);
  assert.equal(savedWrite.enabled, false);
  assert.throws(
    () => library.setRouteEnabled(savedWrite.id, true, { confirmedByUser: false }),
    /confirmação explícita do usuário/
  );
});

test('WebMcpBridge respeita a ordem de preferência (1. WebMCP -> 2. Rota -> 3. Receita -> 4. Clique) e passa pelo Firewall', async () => {
  const library = new LearnedRouteLibrary();
  const route = library.addRoute(
    RouteCompiler.compileFromSamples({
      site: 'https://loja.exemplo.com',
      intent: 'lookup_stock',
      samples: [{ method: 'GET', url: 'https://loja.exemplo.com/api/stock?sku=1' }]
    })
  );
  const executor = new LearnedRouteExecutor({
    library,
    httpCaller: async () => ({ status: 200, data: { source: 'route' } })
  });

  const bridge = new WebMcpBridge({
    routeLibrary: library,
    routeExecutor: executor,
    recipeRunner: async ({ intent }) => (intent === 'recipe_only' ? { matched: true, data: { source: 'recipe' } } : { matched: false }),
    clickAgentRunner: async () => ({ source: 'click' })
  });

  bridge.registerPageModelContext('https://loja.exemplo.com', [
    {
      intent: 'lookup_stock',
      effect: 'leitura',
      execute: async () => ({ source: 'webmcp' })
    },
    {
      intent: 'pay_invoice',
      effect: 'escreve',
      execute: async () => ({ paid: true })
    }
  ]);

  // 1. WebMCP vence quando disponível
  const tier1 = await bridge.dispatchByPreference({
    site: 'https://loja.exemplo.com',
    intent: 'lookup_stock',
    params: { sku: '10' }
  });
  assert.equal(tier1.tier, 'webmcp');

  // Remove WebMCP para 'lookup_stock' -> cai para 2. Rota aprendida
  bridge.registerPageModelContext('https://loja.exemplo.com', []);
  const tier2 = await bridge.dispatchByPreference({
    site: 'https://loja.exemplo.com',
    intent: 'lookup_stock',
    params: { sku: '10' }
  });
  assert.equal(tier2.tier, 'learned_route');

  // 3. Receita por site
  const tier3 = await bridge.dispatchByPreference({
    site: 'https://loja.exemplo.com',
    intent: 'recipe_only'
  });
  assert.equal(tier3.tier, 'site_recipe');

  // 4. Agente clicando
  const tier4 = await bridge.dispatchByPreference({
    site: 'https://loja.exemplo.com',
    intent: 'unknown_intent'
  });
  assert.equal(tier4.tier, 'click_agent');

  // Firewall bloqueia ferramenta WebMCP de escrita com valor vindo de origem externa
  bridge.registerPageModelContext('https://loja.exemplo.com', [
    { intent: 'pay_invoice', effect: 'escreve', execute: async () => ({ paid: true }) }
  ]);
  const blocked = await bridge.dispatchByPreference({
    site: 'https://loja.exemplo.com',
    intent: 'pay_invoice',
    params: { amount: tagValueOrigin(5000, 'externo') }
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.blockedByFirewall, true);
  assert.ok(route.id);
});

test('LocalTwinSandbox ensaia ação em cópia local somente leitura e detecta quebra de seletor', () => {
  const sandbox = new LocalTwinSandbox();
  const twin = sandbox.captureTwin({
    site: 'https://banco.exemplo.com',
    html: '<form><input id="pix-val" value="150.00"></form>',
    elements: {
      '#pix-val': { label: 'Valor do PIX', value: '150.00' }
    }
  });

  const okRehearsal = sandbox.rehearseAction(twin.twinId, {
    action: 'fill',
    selector: '#pix-val',
    proposedValue: '200.00'
  });
  assert.equal(okRehearsal.readOnly, true);
  assert.equal(okRehearsal.selectorFound, true);
  assert.equal(okRehearsal.beforeValue, '150.00');
  assert.equal(okRehearsal.afterPreview, '200.00');

  const brokenRehearsal = sandbox.rehearseAction(twin.twinId, {
    action: 'click',
    selector: '#botao-antigo-removido'
  });
  assert.equal(brokenRehearsal.selectorFound, false);
  assert.equal(brokenRehearsal.layoutChanged, true);
});


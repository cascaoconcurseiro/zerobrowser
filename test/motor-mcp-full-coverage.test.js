'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  decomposeRunTiming,
  verifyPromptPrefixStabilityAndByteBudget
} = require('../src/automation/service/time-decomposition');
const { McpClientRegistry } = require('../src/automation/mcp-diagnostics');
const { McpLoopbackHttpServer } = require('../src/automation/mcp-http-server');
const {
  CommandRegistry,
  verifyUiCommandCoverage,
  classifyCommandBarInput
} = require('../src/main/command-registry');
const {
  AdTrackerListFilter,
  PdfQuestionBridge
} = require('../src/main/parity-essentials');

test('Motor Etapas 2 e 4: decomposição das 4 parcelas de tempo e estabilidade de prefixo + orçamento de bytes', () => {
  const timing = decomposeRunTiming([
    { phase: 'model', durationMs: 1200 },
    { phase: 'browser', durationMs: 350 },
    { phase: 'fixed_wait', durationMs: 150 },
    { phase: 'network', durationMs: 300 }
  ]);
  assert.equal(timing.tempo_modelo_ms, 1200);
  assert.equal(timing.tempo_navegador_ms, 350);
  assert.equal(timing.tempo_espera_fixa_ms, 150);
  assert.equal(timing.tempo_rede_site_ms, 300);
  assert.equal(timing.total_ms, 2000);
  assert.equal(timing.shares.modelo, 0.6);

  const budget = verifyPromptPrefixStabilityAndByteBudget({
    systemPrefixA: 'SYSTEM_STATIC_V1',
    systemPrefixB: 'SYSTEM_STATIC_V1',
    payloadBytes: 8096,
    maxBudgetBytes: 12000
  });
  assert.equal(budget.prefixIdentical, true);
  assert.equal(budget.withinBudget, true);
  assert.equal(budget.savedBytesFromBudget, 3904);
});

test('MCP Fases 4, 5 e 6: ferramentas de página, bloqueio de nível total e servidor HTTP/CDP loopback com token', async () => {
  const registry = new McpClientRegistry();
  const devClient = registry.pairClient({
    clientId: 'cursor-dev',
    level: 'desenvolvedor',
    approvedByUser: true
  });
  const totalClient = registry.pairClient({
    clientId: 'claude-total',
    level: 'total',
    approvedByUser: true
  });

  // Fase 4: cookies_storage redige cookies sensíveis / httpOnly
  const cookieRes = registry.executeDiagnosticTool({
    token: devClient.token,
    tool: 'cookies_storage',
    args: {
      cookies: [
        { name: 'theme', domain: 'example.com', value: 'dark', httpOnly: false },
        { name: 'session_token', domain: 'example.com', value: 'secret-jwt-123', httpOnly: true }
      ],
      storage: { apiKey: 'sk-1234567890abcdefghijklmnop' }
    }
  });
  assert.equal(cookieRes.allowed, true);
  assert.equal(cookieRes.cookies[0].value, 'dark');
  assert.equal(cookieRes.cookies[1].value, '[REDACTED]');

  // Fase 4: ferramentas de página (accessibility_tree, emulate_device, pdf_export, etc.)
  for (const pageTool of ['emulate_device', 'emulate_network', 'handle_dialog', 'file_upload', 'pdf_export', 'accessibility_tree', 'drag_and_drop', 'press_key', 'iframe_select']) {
    const res = registry.executeDiagnosticTool({
      token: devClient.token,
      tool: pageTool,
      args: { target: 'main' }
    });
    assert.equal(res.allowed, true, `Ferramenta ${pageTool} deve funcionar para nível desenvolvedor`);
  }

  // Fase 5: ferramentas do navegador exigem nível 'total' (negativo para desenvolvedor, positivo para total)
  for (const browserTool of ['browser_history', 'browser_bookmarks', 'browser_downloads', 'browser_settings', 'browser_profiles', 'browser_extensions', 'browser_tab_groups']) {
    const denied = registry.executeDiagnosticTool({
      token: devClient.token,
      tool: browserTool,
      args: {}
    });
    assert.equal(denied.allowed, false);
    assert.equal(denied.code, 'INSUFFICIENT_LEVEL');

    const allowed = registry.executeDiagnosticTool({
      token: totalClient.token,
      tool: browserTool,
      args: { action: 'list' }
    });
    assert.equal(allowed.allowed, true);
  }

  // Fase 6: Servidor HTTP/CDP local em 127.0.0.1 exigindo Bearer token
  const server = new McpLoopbackHttpServer({ registry });
  const { host, port } = await server.start(0);
  assert.equal(host, '127.0.0.1');
  assert.ok(port > 0);

  try {
    const noTokenRes = await fetch(`http://127.0.0.1:${port}/cdp/info`);
    assert.equal(noTokenRes.status, 401);

    const cdpRes = await fetch(`http://127.0.0.1:${port}/cdp/info`, {
      headers: { Authorization: `Bearer ${devClient.token}` }
    });
    assert.equal(cdpRes.status, 200);
    const cdpJson = await cdpRes.json();
    assert.equal(cdpJson.allowed, true);
    assert.match(cdpJson.wsEndpoint, /^ws:\/\/127\.0\.0\.1:/);

    const mcpPost = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${totalClient.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ tool: 'browser_bookmarks', args: { query: 'docs' } })
    });
    assert.equal(mcpPost.status, 200);
    const mcpJson = await mcpPost.json();
    assert.equal(mcpJson.allowed, true);
  } finally {
    await server.stop();
  }
});

test('Navegador Nativo Fase 1 & Design UX: cobertura de comandos da UI e 10 de 10 intenções na barra de comando', () => {
  const registry = new CommandRegistry();
  const uiActions = ['tabs.new', 'tabs.closeDuplicates', 'bots.openCentral', 'ui.toggleTheme', 'settings.open'];
  for (const id of uiActions) {
    registry.register({
      id,
      title: `Comando ${id}`,
      category: 'ui',
      effect: 'leitura',
      execute: () => ({ ok: true })
    });
  }

  const coverage = verifyUiCommandCoverage(registry, uiActions);
  assert.equal(coverage.covered, true);

  assert.throws(
    () => verifyUiCommandCoverage(registry, [...uiActions, 'ui.unregisteredButton']),
    (err) => err.code === 'UI_COMMAND_UNREGISTERED' && err.missing.includes('ui.unregisteredButton')
  );

  // 10 de 10 intenções da barra de comando única (PLANO_DESIGN_UX.md §12)
  const samples = [
    { input: 'https://zero.local/docs', expectedKind: 'url' },
    { input: 'localhost:3000/painel', expectedKind: 'url' },
    { input: 'fechar abas duplicadas', expectedKind: 'command' },
    { input: 'alternar tema', expectedKind: 'command' },
    { input: 'central de bots', expectedKind: 'command' },
    { input: 'desfazer', expectedKind: 'command' },
    { input: 'monitore o preço deste notebook todo dia', expectedKind: 'delegate' },
    { input: 'compare os precos nas 3 lojas', expectedKind: 'delegate' },
    { input: 'como configurar sqlite wal no node', expectedKind: 'search' },
    { input: 'documentacao oficial electron browserview', expectedKind: 'search' }
  ];
  let hits = 0;
  for (const s of samples) {
    const classified = classifyCommandBarInput(s.input);
    if (classified.kind === s.expectedKind && classified.preview) hits += 1;
  }
  assert.equal(hits, 10, '10 de 10 intenções classificadas com prévia explícita');
});

test('Paridade Essencial: bloqueador de rastreadores com contador por página e ponte Perguntar sobre PDF', () => {
  const filter = new AdTrackerListFilter();
  const blocked1 = filter.shouldBlockRequest({
    pageOrigin: 'https://noticias.example',
    requestUrl: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'
  });
  assert.equal(blocked1.blocked, true);
  assert.equal(filter.getBlockedCount('https://noticias.example'), 1);

  filter.allowSiteException('https://noticias.example');
  const afterException = filter.shouldBlockRequest({
    pageOrigin: 'https://noticias.example',
    requestUrl: 'https://doubleclick.net/pixel'
  });
  assert.equal(afterException.blocked, false);

  const pdfPayload = PdfQuestionBridge.buildPdfQuestionPayload({
    tabUrl: 'file:///C:/docs/contrato.pdf',
    pdfTitle: 'Contrato de Serviço',
    selectedText: 'Cláusula 8: multa rescisória de 10%.',
    userQuestion: 'Qual é a multa rescisória?'
  });
  assert.equal(pdfPayload.mode, 'read-only');
  assert.match(pdfPayload.prompt, /Cláusula 8/);
});

test('GrokBot Especialistas: 9 especialidades prontas, aba exclusiva vs. 2º plano com auto-foreground ao atingir meta ou precisar do usuário', async () => {
  const { BotTaskStore, SPECIALIST_BOT_PRESETS, EXECUTION_MODES } = require('../src/bots/bot-store');
  const { BotRunner } = require('../src/bots/runner');

  assert.equal(SPECIALIST_BOT_PRESETS.length, 9, 'Deve oferecer 9 especialidades de Bot');
  assert.equal(EXECUTION_MODES.DEDICATED_TAB, 'dedicated-tab');
  assert.equal(EXECUTION_MODES.BACKGROUND_AUTO_FOREGROUND, 'background-auto-foreground');

  const store = new BotTaskStore();
  const priceBot = store.createBot({
    name: 'Caçador de Ofertas',
    specialty: 'price-hunter',
    executionMode: 'background-auto-foreground'
  });
  assert.equal(priceBot.specialty, 'price-hunter');
  assert.equal(priceBot.specialtyTitle, 'Monitor de preço');
  assert.equal(priceBot.executionMode, 'background-auto-foreground');
  assert.equal(priceBot.autoForegroundOnGoal, true);
  assert.equal(priceBot.autoForegroundOnIntervention, true);

  const erpBot = store.createBot({
    name: 'Operador Fiscal',
    specialty: 'erp-operator',
    executionMode: 'dedicated-tab'
  });
  assert.equal(erpBot.executionMode, 'dedicated-tab');

  const runner = new BotRunner({ store, stepExecutor: async (step) => ({ ok: true, data: step.mockData }) });
  const attentionEvents = [];

  // 1. Declaração do passo não prova que a meta foi atingida.
  const goalRun = await runner.runBotNow(priceBot.id, {
    steps: [
      { tool: 'snapshot', mockData: { price: 1899 } },
      { tool: 'extract_table', goalReached: true, mockData: { lowestPrice: 1749 } }
    ],
    onAttention: (ev) => attentionEvents.push(ev)
  });
  assert.equal(goalRun.status, 'completed');
  assert.equal(goalRun.shouldBringToFront, false);
  assert.equal(goalRun.bringToFrontReason, null);
  assert.equal(attentionEvents.length, 0);

  // 2. Execução em 2º plano que encontra CAPTCHA/login deve pausar e trazer para frente ('human_intervention')
  const captchaRun = await runner.runBotNow(priceBot.id, {
    steps: [
      { tool: 'snapshot', requiresHumanIntervention: true, interventionMessage: 'Resolva o CAPTCHA na loja.' }
    ],
    onAttention: (ev) => attentionEvents.push(ev)
  });
  assert.equal(captchaRun.status, 'needs_attention');
  assert.equal(captchaRun.shouldBringToFront, true);
  assert.equal(captchaRun.bringToFrontReason, 'human_intervention');

  // 3. Execução que pede aprovação antes de enviar traz para frente ('approval_needed')
  const approvalRun = await runner.runBotNow(erpBot.id, {
    steps: [
      { tool: 'submit_form', requiresApproval: true, approvalMessage: 'Confirmar envio do lote fiscal?' }
    ],
    onAttention: (ev) => attentionEvents.push(ev)
  });
  assert.equal(approvalRun.status, 'needs_attention');
  assert.equal(approvalRun.shouldBringToFront, true);
  assert.equal(approvalRun.bringToFrontReason, 'approval_needed');
});



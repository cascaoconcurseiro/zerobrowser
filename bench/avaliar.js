#!/usr/bin/env node
// Roda as tarefas do benchmark no Zero Browser aberto (pela ponte MCP) e grava o relatório de taxa de sucesso.
// Uso: node bench/avaliar.js [rotulo] [--conjunto=basico|dificeis|stress|todos|reais] [--tarefas=01,07] [--repeticoes=N] [--max-passos=N] [--tempo=SEGUNDOS] [--data-dir=PASTA] [--observe]
//      node bench/avaliar.js --servidor            (só sobe as páginas, para testar à mão)
//      node bench/avaliar.js --comparar A.json B.json
const fs = require('fs');
const net = require('net');
const path = require('path');
const { tarefas: basicas } = require('./tarefas');
const { tarefasDificeis } = require('./tarefas-dificeis');
const { tarefasReais } = require('./tarefas-reais');
const { tarefasStress } = require('./tarefas-stress');
// "todos" fica só com as páginas locais; os sites reais dependem da internet e rodam à parte.
const CONJUNTOS = { basico: basicas, dificeis: tarefasDificeis, stress: tarefasStress, todos: [...basicas, ...tarefasDificeis, ...tarefasStress], reais: tarefasReais };
const { iniciarServidor } = require('./servidor');
const { automationPipePath, defaultDataDir } = require('../src/automation/pipe-path');

const { compararRelatorios, comparacaoMarkdown } = require('./comparador');
const RESULTADOS = path.join(__dirname, 'resultados');
const TEMPO_POR_TAREFA_MS = 10 * 60 * 1000;

function lerArgumentos(argv) {
  const opcoes = { rotulo: 'execucao', conjunto: 'todos', tarefas: null, repeticoes: 1, maxPassos: 20, tempo: 0, dataDir: '', servidor: false, comparar: null, motor: 'navegante', observeAfterActions: true, preInspect: false, scripts: false, diff: false, cascade: '', stream: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const [chave, valor] = arg.split('=');
    if (chave === '--conjunto') opcoes.conjunto = valor;
    else if (chave === '--tarefas') opcoes.tarefas = valor.split(',').map((v) => v.trim()).filter(Boolean);
    else if (chave === '--repeticoes') opcoes.repeticoes = Math.max(1, Number(valor) || 1);
    else if (chave === '--max-passos') opcoes.maxPassos = Math.min(40, Math.max(1, Number(valor) || 20));
    else if (chave === '--tempo') opcoes.tempo = Math.min(1800, Math.max(10, Number(valor) || 0));
    else if (chave === '--data-dir') opcoes.dataDir = valor || '';
    else if (chave === '--motor') opcoes.motor = valor === 'flame' ? 'flame' : 'navegante';
    else if (chave === '--servidor') opcoes.servidor = true;
    else if (chave === '--observe') opcoes.observeAfterActions = true;
    else if (chave === '--no-observe') opcoes.observeAfterActions = false;
    else if (chave === '--preinspect') opcoes.preInspect = true;
    else if (chave === '--scripts') opcoes.scripts = true;
    else if (chave === '--diff') opcoes.diff = true;
    else if (chave === '--cascade') opcoes.cascade = valor || '';
    else if (chave === '--stream') opcoes.stream = true;
    else if (chave === '--comparar') { opcoes.comparar = [argv[i + 1], argv[i + 2]]; i += 2; }
    else if (!arg.startsWith('--')) opcoes.rotulo = arg.replace(/[^\w.-]/g, '_');
  }
  return opcoes;
}

function conectarMcp(caminho) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(caminho);
    const pendentes = new Map();
    let proximoId = 1;
    let buffer = '';
    socket.setEncoding('utf8');
    socket.on('data', (parte) => {
      buffer += parte;
      let fim;
      while ((fim = buffer.indexOf('\n')) >= 0) {
        const linha = buffer.slice(0, fim).trim();
        buffer = buffer.slice(fim + 1);
        if (!linha) continue;
        let mensagem;
        try { mensagem = JSON.parse(linha); } catch { continue; }
        const espera = pendentes.get(mensagem.id);
        if (!espera) continue;
        pendentes.delete(mensagem.id);
        clearTimeout(espera.timer);
        if (mensagem.error) espera.reject(new Error(mensagem.error.message || 'erro MCP'));
        else espera.resolve(mensagem.result);
      }
    });
    socket.on('close', () => {
      for (const espera of pendentes.values()) espera.reject(new Error('A conexão com o Zero Browser caiu.'));
      pendentes.clear();
    });
    const chamar = (method, params, tempo = 30000) => new Promise((ok, falha) => {
      const id = proximoId++;
      const timer = setTimeout(() => { pendentes.delete(id); falha(new Error(`Tempo esgotado em ${method}.`)); }, tempo);
      pendentes.set(id, { resolve: ok, reject: falha, timer });
      socket.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    });
    socket.once('error', (erro) => reject(new Error(`Não consegui falar com o Zero Browser (${erro.code || erro.message}). Abra o app antes de rodar o benchmark.`)));
    socket.once('connect', async () => {
      try {
        await chamar('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'navegante-bench', version: '1' } });
        socket.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
        resolve({ chamar, fechar: () => socket.end() });
      } catch (erro) { reject(erro); }
    });
  });
}

const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');
const media = (lista) => (lista.length ? lista.reduce((s, v) => s + v, 0) / lista.length : 0);
const percentil = (lista, p) => {
  if (!lista.length) return 0;
  const ordenados = [...lista].sort((a, b) => a - b);
  return ordenados[Math.max(0, Math.ceil(p * ordenados.length) - 1)];
};

function resumir(execucoes) {
  const porCategoria = {};
  for (const e of execucoes) {
    const c = (porCategoria[e.categoria] ||= { total: 0, aprovadas: 0 });
    c.total += 1;
    if (e.aprovado) c.aprovadas += 1;
  }
  const comTokens = execucoes.filter((e) => e.tokensDisponiveis);
  const chamadas = execucoes.flatMap((e) => e.trace?.requestMetrics || []);
  const respostasValidas = chamadas.filter((chamada) => chamada.success === true && Number.isFinite(chamada.durationMs));
  const latencias = respostasValidas.map((chamada) => chamada.durationMs);
  const latenciasTentativas = chamadas.filter((chamada) => Number.isFinite(chamada.durationMs)).map((chamada) => chamada.durationMs);
  return {
    total: execucoes.length,
    aprovadas: execucoes.filter((e) => e.aprovado).length,
    porCategoria,
    mediaPassos: media(execucoes.map((e) => e.passos)),
    mediaSegundos: media(execucoes.map((e) => e.ms / 1000)),
    tokensEntrada: comTokens.reduce((s, e) => s + e.tokensEntrada, 0),
    tokensSaida: comTokens.reduce((s, e) => s + e.tokensSaida, 0),
    chamadasModelo: respostasValidas.length,
    tentativasRepetidas: chamadas.filter((chamada) => chamada.attempt > 1).length,
    latenciaP50Ms: percentil(latencias, 0.5),
    latenciaP90Ms: percentil(latencias, 0.9),
    latenciaTentativaP50Ms: percentil(latenciasTentativas, 0.5),
    latenciaTentativaP90Ms: percentil(latenciasTentativas, 0.9),
    tokensParciais: comTokens.length < execucoes.length
  };
}

async function verificarLocators(mcp, tabId, verificacoes = []) {
  const resultados = [];
  for (const verificacao of verificacoes) {
    const { esperado, ...locator } = verificacao;
    try {
      const response = await mcp.chamar('tools/call', { name: 'browser_locator_action', arguments: { tabId, ...locator } });
      const result = response?.structuredContent || {};
      const sucesso = !response?.isError && result.success !== false && result.value === esperado;
      resultados.push({ success: sucesso, esperado, atual: result.value, error: sucesso ? '' : String(result.error || `Esperado ${esperado}; recebido ${result.value}`) });
    } catch (error) {
      resultados.push({ success: false, esperado, error: error.message || 'Leitura do locator falhou' });
    }
  }
  return { success: resultados.every((resultado) => resultado.success), resultados };
}

async function lerTextoVisivelEFecharAba(mcp, tabId, limpeza = null, initialPageText = '') {
  let pageText = '';
  let cleanupPageText = '';
  let readError = '';
  let closeError = '';
  let cleanupAttempted = false;
  let cleanupVerified = false;
  let cleanupError = '';
  let cleanupBeforeChecks = [];
  let cleanupAfterChecks = [];
  try {
    const response = await mcp.chamar('tools/call', { name: 'browser_get_text', arguments: { tabId } });
    const result = response?.structuredContent || {};
    if (response?.isError || result.success === false) throw new Error(result.error || 'Leitura do texto visível falhou');
    pageText = String(result.text || '');
  } catch (error) {
    readError = error.message || 'Leitura do texto visível falhou';
  }
  if (!readError && limpeza?.quando?.(pageText, initialPageText)) {
    cleanupAttempted = true;
    try {
      const antes = await verificarLocators(mcp, tabId, limpeza.validarAntes || []);
      cleanupBeforeChecks = antes.resultados;
      if (!antes.success) throw new Error(`Pré-condição de limpeza não confirmada: ${antes.resultados.find((resultado) => !resultado.success)?.error || 'locator divergente'}`);
      for (const action of limpeza.acoes || []) {
        const response = await mcp.chamar('tools/call', { name: 'browser_locator_action', arguments: { tabId, ...action } });
        const result = response?.structuredContent || {};
        if (response?.isError || result.success === false) throw new Error(result.error || 'Ação de limpeza falhou');
      }
      const timeout = Math.max(0, Math.min(Number(limpeza.timeoutDepoisMs) || 0, 15000));
      const deadline = Date.now() + timeout;
      let waiting = true;
      while (waiting) {
        const response = await mcp.chamar('tools/call', { name: 'browser_get_text', arguments: { tabId } });
        const result = response?.structuredContent || {};
        if (response?.isError || result.success === false) throw new Error(result.error || 'Não foi possível verificar a limpeza');
        cleanupPageText = String(result.text || '');
        if (!limpeza.esperarDepois || limpeza.esperarDepois(cleanupPageText) || Date.now() >= deadline) waiting = false;
        else await new Promise((resolve) => setTimeout(resolve, 100));
      }
      const depois = await verificarLocators(mcp, tabId, limpeza.validarDepois || []);
      cleanupAfterChecks = depois.resultados;
      cleanupVerified = depois.success && Boolean(limpeza.verificar?.(cleanupPageText, cleanupAfterChecks));
      if (!cleanupVerified) cleanupError = 'O estado limpo não foi confirmado';
    } catch (error) {
      cleanupError = error.message || 'Ação de limpeza falhou';
    }
  }
  try {
    const response = await mcp.chamar('tools/call', { name: 'browser_close_tab', arguments: { tabId } });
    const result = response?.structuredContent || {};
    if (response?.isError || result.success === false) closeError = result.error || 'Fechamento da aba falhou';
  } catch (error) {
    closeError = error.message || 'Fechamento da aba falhou';
  }
  return { pageText, cleanupPageText, readError, closeError, cleanupAttempted, cleanupVerified, cleanupError, cleanupBeforeChecks, cleanupAfterChecks };
}

function relatorioMarkdown(relatorio) {
  const r = relatorio.resumo;
  const linhas = [
    `# Benchmark Zero Browser — ${relatorio.rotulo}`,
    '',
    `Data: ${relatorio.inicio} · Modelo: ${relatorio.modelo || 'desconhecido'} (${relatorio.provedor || '?'}) · Máx. passos: ${relatorio.maxPassos}`,
    '',
    `**Taxa de sucesso: ${pct(r.aprovadas, r.total)}** (${r.aprovadas} de ${r.total})`,
    '',
    `Média de passos: ${r.mediaPassos.toFixed(1)} · Tempo médio: ${r.mediaSegundos.toFixed(1)} s · Tokens: ${r.tokensEntrada} entrada / ${r.tokensSaida} saída${r.tokensParciais ? ' (o provedor não informou em todas)' : ''}`,
    `Chamadas aceitas: ${r.chamadasModelo} · Retentativas: ${r.tentativasRepetidas} · Latência aceita p50/p90: ${r.latenciaP50Ms}/${r.latenciaP90Ms} ms · Tentativas totais p50/p90: ${r.latenciaTentativaP50Ms}/${r.latenciaTentativaP90Ms} ms`,
    '',
    '## Por categoria',
    '',
    '| Categoria | Sucesso |',
    '|---|---|',
    ...Object.entries(r.porCategoria).map(([c, v]) => `| ${c} | ${pct(v.aprovadas, v.total)} (${v.aprovadas}/${v.total}) |`),
    '',
    '## Por tarefa',
    '',
    '| Tarefa | Resultado | Motivo | Parada | Passos | Tempo |',
    '|---|---|---|---|---|---|',
    ...relatorio.execucoes.map((e) => `| ${e.id} | ${e.aprovado ? 'passou' : 'falhou'} | ${String(e.motivo).replace(/\|/g, '/')} | ${e.parada} | ${e.passos} | ${(e.ms / 1000).toFixed(1)} s |`)
  ];
  return `${linhas.join('\n')}\n`;
}

function comparar(arquivoA, arquivoB) {
  const [a, b] = [arquivoA, arquivoB].map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
  const taxa = (rel) => pct(rel.resumo.aprovadas, rel.resumo.total);
  console.log(`${a.rotulo}: ${taxa(a)}  →  ${b.rotulo}: ${taxa(b)}`);
  console.log(`\n${comparacaoMarkdown(compararRelatorios(a, b))}`);
  const ids = [...new Set([...a.execucoes, ...b.execucoes].map((e) => e.id))];
  for (const id of ids) {
    const estado = (rel) => {
      const lista = rel.execucoes.filter((e) => e.id === id);
      return lista.length ? `${lista.filter((e) => e.aprovado).length}/${lista.length}` : '—';
    };
    const [ea, eb] = [estado(a), estado(b)];
    if (ea !== eb) console.log(`  ${id}: ${ea} → ${eb}`);
  }
}

async function principal() {
  const opcoes = lerArgumentos(process.argv.slice(2));
  if (opcoes.comparar) return comparar(...opcoes.comparar);

  const servidor = await iniciarServidor();
  if (opcoes.servidor) {
    console.log(`Páginas no ar em ${servidor.base}. Ctrl+C para parar.`);
    for (const t of CONJUNTOS.todos) console.log(`  ${servidor.urlDa(t.id)}  — ${t.pedido}`);
    return;
  }

  const tarefas = CONJUNTOS[opcoes.conjunto];
  if (!tarefas) throw new Error('Use --conjunto=basico, dificeis, stress, todos ou reais.');
  const selecionadas = opcoes.tarefas ? tarefas.filter((t) => opcoes.tarefas.some((p) => t.id.startsWith(p))) : tarefas;
  if (!selecionadas.length) throw new Error('Nenhuma tarefa corresponde ao filtro --tarefas.');

  const mcp = await conectarMcp(automationPipePath(opcoes.dataDir || defaultDataDir())).catch(async (erro) => {
    await servidor.fechar();
    throw erro;
  });
  const { tools = [] } = await mcp.chamar('tools/list', {});
  if (!tools.some((t) => t.name === 'run_task')) {
    mcp.fechar();
    await servidor.fechar();
    throw new Error('O Zero Browser aberto é uma versão antiga, sem a ferramenta run_task. Feche-o e abra a versão nova com "npm start".');
  }
  const relatorio = { rotulo: opcoes.rotulo, motor: opcoes.motor, observeAfterActions: opcoes.observeAfterActions, preInspect: opcoes.preInspect, scripts: opcoes.scripts, diff: opcoes.diff, cascade: opcoes.cascade || null, stream: opcoes.stream, inicio: new Date().toISOString(), maxPassos: opcoes.maxPassos, provedor: null, modelo: null, execucoes: [] };
  try {
    for (let rodada = 1; rodada <= opcoes.repeticoes; rodada += 1) {
      for (const tarefa of selecionadas) {
        servidor.limpar(tarefa.id);
        process.stdout.write(`[${rodada}/${opcoes.repeticoes}] ${tarefa.id} ... `);
        const inicio = Date.now();
        let resultado;
        try {
          const resposta = await mcp.chamar('tools/call', {
            name: 'run_task',
            arguments: { startUrl: tarefa.startUrl || servidor.urlDa(tarefa.id), prompt: tarefa.pedido, maxSteps: opcoes.maxPassos, ...(tarefa.hosts ? { approvalPolicy: 'public-sites', allowedHosts: tarefa.hosts } : { approvalPolicy: 'local-fixture' }), ...(tarefa.id === '44-estoque-filiais' ? { captureReadEvidence: true } : {}), ...(tarefa.verificarPagina ? { keepTab: true } : {}), ...(tarefa.capturarTextoInicial ? { captureInitialText: true } : {}), ...(tarefa.captureInitialChecks ? { captureInitialChecks: tarefa.captureInitialChecks.map(({ esperado, ...check }) => check) } : {}), engine: opcoes.motor, observeAfterActions: opcoes.observeAfterActions, ...(opcoes.preInspect ? { preInspect: true } : {}), ...(opcoes.scripts ? { actionScripts: true } : {}), ...(opcoes.diff ? { diffSnapshots: true } : {}), ...(opcoes.cascade ? { cascadeModel: opcoes.cascade } : {}), ...(opcoes.stream ? { streaming: true } : {}), ...(opcoes.tempo ? { maxDurationSec: opcoes.tempo } : {}) }
          }, opcoes.tempo ? (opcoes.tempo + 60) * 1000 : TEMPO_POR_TAREFA_MS);
          resultado = resposta?.structuredContent || {};
        } catch (erro) {
          resultado = { success: false, error: erro.message };
        }
        let verificacaoPagina = null;
        if (tarefa.verificarPagina) {
          const initialPageText = String(resultado.initialPageText || '');
          const initialPageRead = !tarefa.capturarTextoInicial || initialPageText.length > 0;
          const initialLocatorChecks = resultado.initialLocatorChecks || [];
          const initialStateVerified = initialPageRead && tarefa.verificarEstadoInicial?.(initialPageText, initialLocatorChecks) === true;
          const cleanup = initialStateVerified ? tarefa.limpezaAposVerificacao || null : null;
          const aba = resultado.tabId
            ? await lerTextoVisivelEFecharAba(mcp, resultado.tabId, cleanup, initialPageText)
            : { pageText: '', cleanupPageText: '', readError: 'run_task não devolveu a aba para verificação', closeError: '', cleanupAttempted: false, cleanupVerified: false, cleanupError: '', cleanupBeforeChecks: [], cleanupAfterChecks: [] };
          verificacaoPagina = { ...(tarefa.capturarTextoInicial ? { estadoInicialConfirmado: initialStateVerified } : {}), ...(tarefa.captureInitialChecks ? { checksIniciaisConfirmados: initialLocatorChecks.length === tarefa.captureInitialChecks.length && initialLocatorChecks.every((check, index) => check.success && check.value === tarefa.captureInitialChecks[index].esperado) } : {}), leituraConfirmada: !aba.readError, abaFechada: !aba.closeError, ...(tarefa.limpezaAposVerificacao ? { limpezaTentada: aba.cleanupAttempted, limpezaConfirmada: aba.cleanupVerified } : {}) };
          resultado.pageTextForVerification = aba.pageText;
          resultado.cleanupPageTextForVerification = aba.cleanupPageText;
          resultado.cleanupBeforeChecksForVerification = aba.cleanupBeforeChecks;
          resultado.cleanupAfterChecksForVerification = aba.cleanupAfterChecks;
          resultado.initialPageTextRead = initialPageRead;
          resultado.initialStateVerified = verificacaoPagina.estadoInicialConfirmado === true;
          resultado.pageTextReadError = aba.readError;
          resultado.pageCloseError = aba.closeError;
          resultado.pageCleanupVerified = aba.cleanupVerified;
          resultado.pageCleanupError = aba.cleanupError;
        }
        // Dá um instante para o último registrar() da página chegar.
        await new Promise((fim) => setTimeout(fim, 300));
        const trace = resultado.trace || {};
        const veredito = tarefa.verificar(servidor.estadoDe(tarefa.id), { mensagem: resultado.message || resultado.error || '', parada: trace.stopReason || '', urlFinal: resultado.finalUrl || '', pageText: resultado.pageTextForVerification || '', cleanupPageText: resultado.cleanupPageTextForVerification || '', pageTextRead: verificacaoPagina?.leituraConfirmada || false, pageTextReadError: resultado.pageTextReadError || '', pageCloseError: resultado.pageCloseError || '', pageCleanupVerified: resultado.pageCleanupVerified === true, pageCleanupError: resultado.pageCleanupError || '', initialPageText: resultado.initialPageText || '', initialPageRead: resultado.initialPageTextRead === true, initialStateVerified: resultado.initialStateVerified === true, initialLocatorChecks: resultado.initialLocatorChecks || [], cleanupBeforeChecks: resultado.cleanupBeforeChecksForVerification || [], cleanupAfterChecks: resultado.cleanupAfterChecksForVerification || [], trace });
        relatorio.provedor ||= resultado.provider || null;
        relatorio.modelo ||= resultado.model || null;
        relatorio.execucoes.push({
          id: tarefa.id,
          categoria: tarefa.categoria,
          rodada,
          aprovado: veredito.aprovado,
          motivo: veredito.motivo,
          parada: trace.stopReason || (resultado.success === false ? 'erro' : '—'),
          passos: trace.toolCalls?.length || 0,
          ms: Date.now() - inicio,
          tokensDisponiveis: trace.usageAvailable !== false && trace.inputTokens !== undefined,
          tokensEntrada: trace.inputTokens || 0,
          tokensSaida: trace.outputTokens || 0,
          mensagem: String(resultado.message || resultado.error || '').slice(0, 500),
          ...(verificacaoPagina ? { verificacaoPagina } : {}),
          trace
        });
        console.log(veredito.aprovado ? 'passou' : `falhou (${veredito.motivo})`);
      }
    }
  } finally {
    mcp.fechar();
    await servidor.fechar();
  }

  relatorio.resumo = resumir(relatorio.execucoes);
  fs.mkdirSync(RESULTADOS, { recursive: true });
  const base = path.join(RESULTADOS, `${opcoes.rotulo}__${relatorio.inicio.replace(/[:.]/g, '-')}`);
  fs.writeFileSync(`${base}.json`, JSON.stringify(relatorio, null, 2));
  fs.writeFileSync(`${base}.md`, relatorioMarkdown(relatorio));
  console.log(`\nTaxa de sucesso: ${pct(relatorio.resumo.aprovadas, relatorio.resumo.total)} (${relatorio.resumo.aprovadas}/${relatorio.resumo.total})`);
  console.log(`Relatório: ${base}.md`);
}

if (require.main === module) {
  principal().catch((erro) => {
    console.error(erro.message);
    process.exitCode = 1;
  });
}

module.exports = { lerArgumentos, resumir, relatorioMarkdown, lerTextoVisivelEFecharAba };

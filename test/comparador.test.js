const test = require('node:test');
const assert = require('node:assert/strict');
const { compararRelatorios, comparacaoMarkdown } = require('../bench/comparador');

function relatorio(rotulo, modelo, linhas) {
  return {
    rotulo,
    modelo,
    provedor: 'p',
    motor: 'navegante', observeAfterActions: true, preInspect: false, scripts: false,
    diff: false, deduplicateSnapshots: false, promptCache: false, cascade: null, stream: false, journal: false, maxPassos: 20,
    tempo: null, conjunto: 'todos',
    execucoes: linhas.map(([id, aprovado, passos, ms, entrada, cache, chamadas]) => ({
      id, aprovado, passos, ms, tokensDisponiveis: true, tokensEntrada: entrada, tokensSaida: 50,
      trace: { cachedInputTokens: cache, cachedInputTokensAvailable: true, modelCalls: chamadas }
    }))
  };
}

const ids = ['t1', 't2', 't3', 't4', 't5', 't6'];

test('B com menos chamadas em todas as tarefas é lido como menor, com 6 pares', () => {
  const a = relatorio('base', 'm', ids.map((id, i) => [id, true, 6, 12000 + i * 100, 10000, 6000, 6]));
  const b = relatorio('novo', 'm', ids.map((id, i) => [id, true, 5, 9000 + i * 100, 8000, 6000, 5]));
  const c = compararRelatorios(a, b);
  const chamadas = c.metricas.find((m) => m.chave === 'chamadasModelo');
  assert.equal(chamadas.tarefasPareadas, 6);
  assert.equal(chamadas.mediaA, 6);
  assert.equal(chamadas.mediaB, 5);
  assert.match(chamadas.veredito, /B menor/);
  const naoCacheados = c.metricas.find((m) => m.chave === 'tokensNaoCacheados');
  assert.equal(naoCacheados.mediaA, 4000);
  assert.equal(naoCacheados.mediaB, 2000);
  assert.equal(c.mesmoModelo, true);
});

test('veredito causal exige mesmo provedor, modelo e condições registradas', () => {
  const a = relatorio('a', 'm', ids.map((id) => [id, true, 6, 12000, 10000, 0, 6]));
  const b = relatorio('b', 'm', ids.map((id) => [id, true, 5, 9000, 9000, 0, 5]));
  a.observeAfterActions = true; b.observeAfterActions = false;
  const comparison = compararRelatorios(a, b);
  assert.match(comparison.metricas.find((m) => m.chave === 'chamadasModelo').veredito, /incompatível/);
  assert.match(comparacaoMarkdown(comparison), /observeAfterActions/);
  b.observeAfterActions = true;
  b.deduplicateSnapshots = true;
  assert.match(compararRelatorios(a, b).metricas.find((m) => m.chave === 'chamadasModelo').veredito, /incompatível/);
  const experimento = compararRelatorios(a, b, { variaveis: ['deduplicateSnapshots'] });
  assert.match(experimento.metricas.find((m) => m.chave === 'chamadasModelo').veredito, /B menor/);
  assert.match(comparacaoMarkdown(experimento), /Variável experimental declarada: deduplicateSnapshots/);
  assert.match(compararRelatorios(a, b, { variaveis: ['modelo'] }).metricas.find((m) => m.chave === 'chamadasModelo').veredito, /incompatível/);
  b.stream = true;
  const comparacaoMultivariavel = compararRelatorios(a, b, { variaveis: ['deduplicateSnapshots', 'stream'] });
  assert.match(comparacaoMultivariavel.metricas.find((m) => m.chave === 'chamadasModelo').veredito, /incompatível/);
  assert.deepEqual(comparacaoMultivariavel.variaveisComparadas, []);
  b.stream = false;
  b.deduplicateSnapshots = false;
  assert.match(compararRelatorios(a, b).metricas.find((m) => m.chave === 'chamadasModelo').veredito, /B menor/);
  b.promptCache = true;
  assert.match(compararRelatorios(a, b).metricas.find((m) => m.chave === 'chamadasModelo').veredito, /incompatível/);
  assert.match(compararRelatorios(a, b, { variaveis: ['promptCache'] }).metricas.find((m) => m.chave === 'chamadasModelo').veredito, /B menor/);
});

test('cache desconhecido e relatórios legados não são tratados como zero', () => {
  const a = relatorio('a', 'm', [['t1', true, 1, 1000, 100, 0, 1]]);
  const b = structuredClone(a);
  delete b.execucoes[0].trace.cachedInputTokensAvailable;
  assert.equal(compararRelatorios(a, b).metricas.find((m) => m.chave === 'tokensNaoCacheados').tarefasPareadas, 0);
  b.execucoes[0].trace.cachedInputTokensAvailable = false;
  assert.equal(compararRelatorios(a, b).metricas.find((m) => m.chave === 'tokensNaoCacheados').tarefasPareadas, 0);
});

test('poucos pares ou diferença ruidosa ficam inconclusivos', () => {
  const a = relatorio('base', 'm', [['t1', true, 6, 12000, 10000, 0, 6], ['t2', true, 6, 12000, 10000, 0, 6]]);
  const b = relatorio('novo', 'm', [['t1', true, 5, 9000, 8000, 0, 5], ['t2', true, 5, 9000, 8000, 0, 5]]);
  a.provedor = b.provedor = 'p';
  assert.equal(compararRelatorios(a, b).metricas.find((m) => m.chave === 'chamadasModelo').veredito, 'inconclusivo');
});

test('amostra de cinco tarefas usa intervalo t e não exagera uma melhora ruidosa', () => {
  const taskIds = ['a', 'b', 'c', 'd', 'e'];
  const a = relatorio('base', 'm', taskIds.map((id) => [id, true, 1, 10000, 100, 0, 1]));
  const b = relatorio('candidato', 'm', taskIds.map((id, i) => [id, true, 1, i < 4 ? 9000 : 10400, 100, 0, 1]));
  const c = compararRelatorios(a, b);
  const segundos = c.metricas.find((m) => m.chave === 'segundos');
  assert.ok(segundos.intervalo95[0] < 0 && segundos.intervalo95[1] > 0);
  assert.equal(segundos.veredito, 'inconclusivo');
});

test('acerto lista tarefas que pioraram e avisa quando os modelos diferem', () => {
  const a = relatorio('base', 'm1', [['t1', true, 3, 1000, 100, 0, 3], ['t2', true, 3, 1000, 100, 0, 3]]);
  const b = relatorio('novo', 'm2', [['t1', true, 3, 1000, 100, 0, 3], ['t2', false, 3, 1000, 100, 0, 3]]);
  const c = compararRelatorios(a, b);
  assert.deepEqual(c.acerto.piores, ['t2']);
  assert.equal(c.mesmoModelo, false);
  assert.match(comparacaoMarkdown(c), /modelos diferentes/);
});

test('execuções sem tokens informados não entram nas métricas de tokens', () => {
  const a = { rotulo: 'a', modelo: 'm', execucoes: [{ id: 't1', aprovado: true, passos: 1, ms: 1000, tokensDisponiveis: false, tokensEntrada: 0, tokensSaida: 0 }] };
  const c = compararRelatorios(a, a);
  assert.equal(c.metricas.find((m) => m.chave === 'tokensEntrada').tarefasPareadas, 0);
});

test('acerto considera somente tarefas comuns e alerta sobre provedores diferentes', () => {
  const a = relatorio('a', 'm', [['t1', true, 1, 1000, 100, 0, 1], ['extra', false, 1, 1000, 100, 0, 1]]);
  const b = relatorio('b', 'm', [['t1', true, 1, 1000, 100, 0, 1]]);
  a.provedor = 'p1'; b.provedor = 'p2';
  const c = compararRelatorios(a, b);
  assert.deepEqual(c.acerto.a, { aprovadas: 1, total: 1, taxaBalanceada: 1 });
  assert.deepEqual(c.acerto.b, { aprovadas: 1, total: 1, taxaBalanceada: 1 });
  assert.match(c.metricas.find((m) => m.chave === 'segundos').veredito, /incompatível/, 'cobertura diferente não sustenta inferência pareada');
  assert.match(comparacaoMarkdown(c), /provedores diferentes/);
  assert.match(comparacaoMarkdown(c), /somente A: extra/);
});

test('acerto balanceia tarefas com números diferentes de repetições', () => {
  const ok = ['ok', true, 1, 1000, 100, 0, 1];
  const falha = ['falha', false, 1, 1000, 100, 0, 1];
  const a = relatorio('a', 'm', [ok, ...Array(9).fill(falha)]);
  const b = relatorio('b', 'm', [...Array(9).fill(ok), falha]);
  const c = compararRelatorios(a, b);
  assert.equal(c.acerto.a.taxaBalanceada, 0.5);
  assert.equal(c.acerto.b.taxaBalanceada, 0.5);
  assert.match(c.metricas.find((m) => m.chave === 'segundos').veredito, /incompatível/, 'pesos diferentes de repetições não sustentam inferência pareada');
  assert.match(comparacaoMarkdown(c), /quantidades de repetições diferentes/);
});

test('sem tarefas em comum não afirma que não houve regressão', () => {
  const a = relatorio('a', 'm', [['a', true, 1, 1000, 100, 0, 1]]);
  const b = relatorio('b', 'm', [['b', true, 1, 1000, 100, 0, 1]]);
  const texto = comparacaoMarkdown(compararRelatorios(a, b));
  assert.match(texto, /Sem tarefas pareadas/);
  assert.doesNotMatch(texto, /Nenhuma tarefa pareada piorou/);
});

test('custo só é comparável quando todas as execuções pareadas informam custo', () => {
  const taskIds = ['a', 'b', 'c', 'd', 'e', 'f'];
  const a = relatorio('base', 'm', taskIds.map((id) => [id, true, 1, 1000, 100, 0, 1]));
  const b = structuredClone(a);
  a.provedor = b.provedor = 'openrouter';
  for (const [index, execution] of a.execucoes.entries()) {
    execution.custoDisponivel = true;
    execution.custoUsd = 0.01;
    b.execucoes[index].custoDisponivel = true;
    b.execucoes[index].custoUsd = 0.008;
  }
  const compararCusto = (candidate) => compararRelatorios(a, candidate).metricas.find((metric) => metric.chave === 'custoUsd');
  assert.match(compararCusto(b).veredito, /B menor/);
  b.execucoes[0].custoDisponivel = false;
  assert.match(compararCusto(b).veredito, /incompatível/);
});

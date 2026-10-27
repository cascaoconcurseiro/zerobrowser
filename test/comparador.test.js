const test = require('node:test');
const assert = require('node:assert/strict');
const { compararRelatorios, comparacaoMarkdown } = require('../bench/comparador');

function relatorio(rotulo, modelo, linhas) {
  return {
    rotulo,
    modelo,
    execucoes: linhas.map(([id, aprovado, passos, ms, entrada, cache, chamadas]) => ({
      id, aprovado, passos, ms, tokensDisponiveis: true, tokensEntrada: entrada, tokensSaida: 50,
      trace: { cachedInputTokens: cache, modelCalls: chamadas }
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

test('poucos pares ou diferença ruidosa ficam inconclusivos', () => {
  const a = relatorio('base', 'm', [['t1', true, 6, 12000, 10000, 0, 6], ['t2', true, 6, 12000, 10000, 0, 6]]);
  const b = relatorio('novo', 'm', [['t1', true, 5, 9000, 8000, 0, 5], ['t2', true, 5, 9000, 8000, 0, 5]]);
  assert.equal(compararRelatorios(a, b).metricas.find((m) => m.chave === 'chamadasModelo').veredito, 'inconclusivo');
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

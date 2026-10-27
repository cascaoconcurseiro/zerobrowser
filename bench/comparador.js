'use strict';
// Comparador pareado de dois relatórios do benchmark (A = referência, B = candidato).
// Pareia por tarefa: cada tarefa vira uma média sobre as repetições, e a diferença B - A é tirada tarefa a tarefa.
// Assim a variação entre tarefas (fáceis x difíceis) não mascara o efeito da mudança.
// Com poucas tarefas ou repetições o resultado costuma sair "inconclusivo"; isso é o esperado e honesto.

const METRICAS = [
  { chave: 'passos', rotulo: 'Passos (chamadas de ferramenta)', valor: (e) => e.passos },
  { chave: 'segundos', rotulo: 'Tempo (s)', valor: (e) => e.ms / 1000 },
  { chave: 'chamadasModelo', rotulo: 'Chamadas ao modelo', valor: (e) => e.trace?.modelCalls },
  { chave: 'tokensEntrada', rotulo: 'Tokens de entrada (brutos)', valor: (e) => (e.tokensDisponiveis === false ? undefined : e.tokensEntrada) },
  { chave: 'tokensNaoCacheados', rotulo: 'Tokens de entrada não cacheados', valor: (e) => (e.tokensDisponiveis === false ? undefined : e.tokensEntrada - (e.trace?.cachedInputTokens || 0)) },
  { chave: 'tokensSaida', rotulo: 'Tokens de saída', valor: (e) => (e.tokensDisponiveis === false ? undefined : e.tokensSaida) }
];

function media(valores) {
  return valores.reduce((soma, v) => soma + v, 0) / valores.length;
}

function desvioPadrao(valores) {
  if (valores.length < 2) return 0;
  const m = media(valores);
  return Math.sqrt(valores.reduce((soma, v) => soma + (v - m) ** 2, 0) / (valores.length - 1));
}

function mediasPorTarefa(relatorio, valor) {
  const grupos = new Map();
  for (const execucao of relatorio.execucoes || []) {
    const v = valor(execucao);
    if (!Number.isFinite(v)) continue;
    if (!grupos.has(execucao.id)) grupos.set(execucao.id, []);
    grupos.get(execucao.id).push(v);
  }
  return new Map([...grupos].map(([id, valores]) => [id, media(valores)]));
}

function compararMetrica(a, b, metrica) {
  const mediasA = mediasPorTarefa(a, metrica.valor);
  const mediasB = mediasPorTarefa(b, metrica.valor);
  const ids = [...mediasA.keys()].filter((id) => mediasB.has(id));
  if (!ids.length) return { chave: metrica.chave, rotulo: metrica.rotulo, tarefasPareadas: 0, veredito: 'sem dados' };
  const totalA = ids.reduce((soma, id) => soma + mediasA.get(id), 0);
  const totalB = ids.reduce((soma, id) => soma + mediasB.get(id), 0);
  const diferencas = ids.map((id) => mediasB.get(id) - mediasA.get(id));
  const mediaDif = media(diferencas);
  const erro = desvioPadrao(diferencas) / Math.sqrt(ids.length);
  // 1,96 é a aproximação normal; com poucas tarefas é otimista, por isso exigimos pelo menos 5 pares.
  const intervalo = [mediaDif - 1.96 * erro, mediaDif + 1.96 * erro];
  let veredito = 'inconclusivo';
  if (ids.length >= 5) {
    if (intervalo[1] < 0) veredito = 'B menor (provável melhora se menor é melhor)';
    else if (intervalo[0] > 0) veredito = 'B maior (provável piora se menor é melhor)';
  }
  return {
    chave: metrica.chave,
    rotulo: metrica.rotulo,
    tarefasPareadas: ids.length,
    mediaA: totalA / ids.length,
    mediaB: totalB / ids.length,
    variacaoPercentual: totalA === 0 ? null : ((totalB - totalA) / totalA) * 100,
    intervalo95: intervalo,
    veredito
  };
}

function compararAcerto(a, b) {
  const taxaPorTarefa = (rel) => {
    const grupos = new Map();
    for (const e of rel.execucoes || []) {
      if (!grupos.has(e.id)) grupos.set(e.id, []);
      grupos.get(e.id).push(e.aprovado ? 1 : 0);
    }
    return new Map([...grupos].map(([id, v]) => [id, media(v)]));
  };
  const ta = taxaPorTarefa(a);
  const tb = taxaPorTarefa(b);
  const ids = [...ta.keys()].filter((id) => tb.has(id));
  const piores = ids.filter((id) => tb.get(id) < ta.get(id));
  const melhores = ids.filter((id) => tb.get(id) > ta.get(id));
  const total = (rel) => ({ aprovadas: (rel.execucoes || []).filter((e) => e.aprovado).length, total: (rel.execucoes || []).length });
  return { a: total(a), b: total(b), tarefasPareadas: ids.length, melhores, piores };
}

function compararRelatorios(a, b) {
  return {
    rotuloA: a.rotulo,
    rotuloB: b.rotulo,
    modeloA: a.modelo || null,
    modeloB: b.modelo || null,
    mesmoModelo: Boolean(a.modelo) && a.modelo === b.modelo,
    acerto: compararAcerto(a, b),
    metricas: METRICAS.map((metrica) => compararMetrica(a, b, metrica))
  };
}

const fmt = (n) => (Number.isFinite(n) ? (Math.abs(n) >= 100 ? n.toFixed(0) : n.toFixed(2)) : '—');

function comparacaoMarkdown(c) {
  const pct = (x) => (x.total ? `${Math.round((x.aprovadas / x.total) * 100)}% (${x.aprovadas}/${x.total})` : '—');
  const linhas = [
    `# Comparação pareada — ${c.rotuloA} (A) x ${c.rotuloB} (B)`,
    '',
    c.mesmoModelo ? `Modelo: ${c.modeloA}` : `ATENÇÃO: modelos diferentes (A: ${c.modeloA || '?'}, B: ${c.modeloB || '?'}). A comparação não isola a mudança.`,
    '',
    `Acerto: ${pct(c.acerto.a)} → ${pct(c.acerto.b)} · tarefas pareadas: ${c.acerto.tarefasPareadas}`,
    c.acerto.piores.length ? `Tarefas que pioraram: ${c.acerto.piores.join(', ')}` : 'Nenhuma tarefa piorou.',
    c.acerto.melhores.length ? `Tarefas que melhoraram: ${c.acerto.melhores.join(', ')}` : 'Nenhuma tarefa melhorou.',
    '',
    '| Métrica | A | B | Variação | IC 95% da diferença (B−A) | Pares | Leitura |',
    '|---|---:|---:|---:|---|---:|---|',
    ...c.metricas.map((m) => (m.tarefasPareadas
      ? `| ${m.rotulo} | ${fmt(m.mediaA)} | ${fmt(m.mediaB)} | ${m.variacaoPercentual === null ? '—' : `${m.variacaoPercentual.toFixed(1)}%`} | ${fmt(m.intervalo95[0])} a ${fmt(m.intervalo95[1])} | ${m.tarefasPareadas} | ${m.veredito} |`
      : `| ${m.rotulo} | — | — | — | — | 0 | ${m.veredito} |`)),
    '',
    'Cada tarefa vira a média das suas repetições. "Inconclusivo" significa que o intervalo inclui zero ou há menos de 5 tarefas pareadas.'
  ];
  return `${linhas.join('\n')}\n`;
}

module.exports = { compararRelatorios, comparacaoMarkdown, METRICAS };

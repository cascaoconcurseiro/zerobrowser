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
  { chave: 'tokensNaoCacheados', rotulo: 'Tokens de entrada não cacheados', valor: (e) => (e.tokensDisponiveis === false || e.trace?.cachedInputTokensAvailable !== true || !Number.isFinite(e.trace?.cachedInputTokens) || !Number.isFinite(e.tokensEntrada) || e.trace.cachedInputTokens < 0 || e.trace.cachedInputTokens > e.tokensEntrada ? undefined : e.tokensEntrada - e.trace.cachedInputTokens) },
  { chave: 'tokensSaida', rotulo: 'Tokens de saída', valor: (e) => (e.tokensDisponiveis === false ? undefined : e.tokensSaida) },
  { chave: 'custoUsd', rotulo: 'Custo reportado pelo provedor (USD)', requerCoberturaCompleta: true, valor: (e) => (e.custoDisponivel === true && Number.isFinite(e.custoUsd) && e.custoUsd >= 0 ? e.custoUsd : undefined) }
];

const CAMPOS_CONDICAO = ['motor', 'observeAfterActions', 'preInspect', 'scripts', 'diff', 'deduplicateSnapshots', 'promptCache', 'cascade', 'stream', 'journal', 'maxPassos', 'tempo', 'conjunto'];
const T_CRITICO_95 = [null, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.160, 2.145, 2.131, 2.120, 2.110, 2.101, 2.093, 2.086, 2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045, 2.042];

function mesmasCondicoes(a, b, variaveis = []) {
  const declaradas = new Set(variaveis);
  if (variaveis.length > 1 || [...declaradas].some((campo) => !CAMPOS_CONDICAO.includes(campo))) return false;
  return CAMPOS_CONDICAO.every((campo) => Object.hasOwn(a, campo) && Object.hasOwn(b, campo)
    && (a[campo] === b[campo] || declaradas.has(campo)));
}

function tCritico95(n) {
  const gl = n - 1;
  return T_CRITICO_95[gl] || 1.96;
}

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

function compararMetrica(a, b, metrica, coberturaComparavel, variaveis) {
  const mediasA = mediasPorTarefa(a, metrica.valor);
  const mediasB = mediasPorTarefa(b, metrica.valor);
  const ids = [...mediasA.keys()].filter((id) => mediasB.has(id));
  if (!ids.length) return { chave: metrica.chave, rotulo: metrica.rotulo, tarefasPareadas: 0, veredito: 'sem dados' };
  const totalA = ids.reduce((soma, id) => soma + mediasA.get(id), 0);
  const totalB = ids.reduce((soma, id) => soma + mediasB.get(id), 0);
  const diferencas = ids.map((id) => mediasB.get(id) - mediasA.get(id));
  const mediaDif = media(diferencas);
  const erro = desvioPadrao(diferencas) / Math.sqrt(ids.length);
  // O valor t corrige a incerteza extra da amostra pequena; acima de 30 pares usamos a aproximação normal.
  const margem = tCritico95(ids.length) * erro;
  const intervalo = [mediaDif - margem, mediaDif + margem];
  const todosIdsA = new Set((a.execucoes || []).map((e) => e.id));
  const todosIdsB = new Set((b.execucoes || []).map((e) => e.id));
  const valoresValidosA = (a.execucoes || []).filter((e) => Number.isFinite(metrica.valor(e))).length;
  const valoresValidosB = (b.execucoes || []).filter((e) => Number.isFinite(metrica.valor(e))).length;
  const metricaCompleta = !metrica.requerCoberturaCompleta || (valoresValidosA === (a.execucoes || []).length && valoresValidosB === (b.execucoes || []).length && mediasA.size === todosIdsA.size && mediasB.size === todosIdsB.size && ids.length === todosIdsA.size && ids.length === todosIdsB.size);
  const comparavel = Boolean(coberturaComparavel && metricaCompleta && a.modelo && b.modelo && a.modelo === b.modelo && a.provedor && b.provedor && a.provedor === b.provedor && mesmasCondicoes(a, b, variaveis));
  let veredito = comparavel ? 'inconclusivo' : 'incompatível (modelo, provedor, condições, cobertura ou repetições diferentes/ausentes)';
  if (comparavel && ids.length >= 5) {
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
  const total = (rel) => {
    const execucoes = (rel.execucoes || []).filter((e) => ids.includes(e.id));
    const taxas = ids.map((id) => {
      const grupo = execucoes.filter((e) => e.id === id);
      return media(grupo.map((e) => e.aprovado ? 1 : 0));
    });
    return { aprovadas: execucoes.filter((e) => e.aprovado).length, total: execucoes.length, taxaBalanceada: taxas.length ? media(taxas) : null };
  };
  return { a: total(a), b: total(b), tarefasPareadas: ids.length, melhores, piores };
}

function compararRelatorios(a, b, { variaveis = [] } = {}) {
  const contar = (rel) => {
    const counts = new Map();
    for (const e of rel.execucoes || []) counts.set(e.id, (counts.get(e.id) || 0) + 1);
    return counts;
  };
  const countsA = contar(a);
  const countsB = contar(b);
  const soA = [...countsA.keys()].filter((id) => !countsB.has(id));
  const soB = [...countsB.keys()].filter((id) => !countsA.has(id));
  const repeticoesDiferentes = [...countsA.keys()].filter((id) => countsB.has(id) && countsA.get(id) !== countsB.get(id))
    .map((id) => ({ id, a: countsA.get(id), b: countsB.get(id) }));
  const coberturaComparavel = soA.length === 0 && soB.length === 0 && repeticoesDiferentes.length === 0;
  const condicoesDiferentes = CAMPOS_CONDICAO.filter((key) => !Object.hasOwn(a, key) || !Object.hasOwn(b, key) || a[key] !== b[key]).map((key) => ({ campo: key, a: a[key] ?? null, b: b[key] ?? null }));
  return {
    rotuloA: a.rotulo,
    rotuloB: b.rotulo,
    modeloA: a.modelo || null,
    modeloB: b.modelo || null,
    mesmoModelo: Boolean(a.modelo) && a.modelo === b.modelo,
    provedorA: a.provedor || null,
    provedorB: b.provedor || null,
    mesmoProvedor: Boolean(a.provedor) && a.provedor === b.provedor,
    variaveisComparadas: variaveis.length === 1 && CAMPOS_CONDICAO.includes(variaveis[0]) ? variaveis : [],
    cobertura: { soA, soB, repeticoesDiferentes },
    condicoesDiferentes,
    acerto: compararAcerto(a, b),
    metricas: METRICAS.map((metrica) => compararMetrica(a, b, metrica, coberturaComparavel, variaveis))
  };
}

const fmt = (n) => (Number.isFinite(n) ? (Math.abs(n) >= 100 ? n.toFixed(0) : n.toFixed(2)) : '—');

function comparacaoMarkdown(c) {
  const pct = (x) => (x.total ? `${Math.round(x.taxaBalanceada * 100)}% (média por tarefa; ${x.aprovadas}/${x.total} execuções)` : '—');
  const linhas = [
    `# Comparação pareada — ${c.rotuloA} (A) x ${c.rotuloB} (B)`,
    '',
    c.mesmoModelo ? `Modelo: ${c.modeloA}` : `ATENÇÃO: modelos diferentes (A: ${c.modeloA || '?'}, B: ${c.modeloB || '?'}). A comparação não isola a mudança.`,
    c.mesmoProvedor ? `Provedor: ${c.provedorA}` : `ATENÇÃO: provedores diferentes ou não informados (A: ${c.provedorA || '?'}, B: ${c.provedorB || '?'}). A comparação não isola a mudança.`,
    c.cobertura.soA.length || c.cobertura.soB.length ? `ATENÇÃO: tarefas sem par — somente A: ${c.cobertura.soA.join(', ') || 'nenhuma'}; somente B: ${c.cobertura.soB.join(', ') || 'nenhuma'}.` : c.acerto.tarefasPareadas ? 'Cobertura: todas as tarefas possuem par.' : 'Cobertura: nenhuma tarefa disponível.',
    c.cobertura.repeticoesDiferentes.length ? `ATENÇÃO: quantidades de repetições diferentes — ${c.cobertura.repeticoesDiferentes.map((item) => `${item.id} (A=${item.a}, B=${item.b})`).join(', ')}.` : c.acerto.tarefasPareadas ? 'Repetições: quantidades iguais nas tarefas pareadas.' : 'Repetições: sem tarefas pareadas.',
    c.condicoesDiferentes.length ? `ATENÇÃO: condições diferentes ou ausentes — ${c.condicoesDiferentes.map((item) => `${item.campo} (A=${item.a}, B=${item.b})`).join(', ')}.` : 'Condições registradas iguais.',
    c.variaveisComparadas?.length ? `Variável experimental declarada: ${c.variaveisComparadas.join(', ')}.` : '',
    '',
    `Acerto: ${pct(c.acerto.a)} → ${pct(c.acerto.b)} · tarefas pareadas: ${c.acerto.tarefasPareadas}`,
    !c.acerto.tarefasPareadas ? 'Sem tarefas pareadas para avaliar mudanças no acerto.' : c.acerto.piores.length ? `Tarefas que pioraram: ${c.acerto.piores.join(', ')}` : 'Nenhuma tarefa pareada piorou.',
    !c.acerto.tarefasPareadas ? '' : c.acerto.melhores.length ? `Tarefas que melhoraram: ${c.acerto.melhores.join(', ')}` : 'Nenhuma tarefa pareada melhorou.',
    '',
    '| Métrica | A | B | Variação | IC 95% da diferença (B−A) | Pares | Leitura |',
    '|---|---:|---:|---:|---|---:|---|',
    ...c.metricas.map((m) => (m.tarefasPareadas
      ? `| ${m.rotulo} | ${fmt(m.mediaA)} | ${fmt(m.mediaB)} | ${m.variacaoPercentual === null ? '—' : `${m.variacaoPercentual.toFixed(1)}%`} | ${fmt(m.intervalo95[0])} a ${fmt(m.intervalo95[1])} | ${m.tarefasPareadas} | ${m.veredito} |`
      : `| ${m.rotulo} | — | — | — | — | 0 | ${m.veredito} |`)),
    '',
    'Cada tarefa vira a média das suas repetições. O IC usa t de Student até 30 tarefas pareadas e aproximação normal acima disso. "Inconclusivo" significa que o intervalo inclui zero ou há menos de 5 tarefas pareadas.',
    'Tokens não cacheados incluem apenas execuções com dados completos de cache; relatórios antigos sem indicador de disponibilidade são omitidos.'
  ];
  return `${linhas.join('\n')}\n`;
}

module.exports = { compararRelatorios, comparacaoMarkdown, METRICAS };

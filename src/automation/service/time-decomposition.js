'use strict';

function decomposeRunTiming(events = []) {
  let tempo_modelo_ms = 0;
  let tempo_navegador_ms = 0;
  let tempo_espera_fixa_ms = 0;
  let tempo_rede_site_ms = 0;

  for (const ev of events || []) {
    const dur = Math.max(0, Number(ev?.durationMs) || 0);
    const kind = String(ev?.phase || ev?.kind || '').toLowerCase();
    if (kind === 'model' || kind === 'llm') tempo_modelo_ms += dur;
    else if (kind === 'browser' || kind === 'tool' || kind === 'snapshot') tempo_navegador_ms += dur;
    else if (kind === 'fixed_wait' || kind === 'sleep' || kind === 'wait') tempo_espera_fixa_ms += dur;
    else if (kind === 'network' || kind === 'site_load') tempo_rede_site_ms += dur;
  }

  const total_ms = tempo_modelo_ms + tempo_navegador_ms + tempo_espera_fixa_ms + tempo_rede_site_ms;
  return {
    tempo_modelo_ms,
    tempo_navegador_ms,
    tempo_espera_fixa_ms,
    tempo_rede_site_ms,
    total_ms,
    shares: total_ms > 0 ? {
      modelo: Number((tempo_modelo_ms / total_ms).toFixed(4)),
      navegador: Number((tempo_navegador_ms / total_ms).toFixed(4)),
      espera_fixa: Number((tempo_espera_fixa_ms / total_ms).toFixed(4)),
      rede_site: Number((tempo_rede_site_ms / total_ms).toFixed(4))
    } : { modelo: 0, navegador: 0, espera_fixa: 0, rede_site: 0 }
  };
}

function verifyPromptPrefixStabilityAndByteBudget({
  systemPrefixA = '',
  systemPrefixB = '',
  payloadBytes = 0,
  maxBudgetBytes = 32768
} = {}) {
  const prefixIdentical = String(systemPrefixA) === String(systemPrefixB) && String(systemPrefixA).length > 0;
  const withinBudget = Number(payloadBytes) <= Number(maxBudgetBytes);
  return {
    prefixIdentical,
    withinBudget,
    payloadBytes: Number(payloadBytes),
    maxBudgetBytes: Number(maxBudgetBytes),
    savedBytesFromBudget: Math.max(0, Number(maxBudgetBytes) - Number(payloadBytes))
  };
}

module.exports = {
  decomposeRunTiming,
  verifyPromptPrefixStabilityAndByteBudget
};


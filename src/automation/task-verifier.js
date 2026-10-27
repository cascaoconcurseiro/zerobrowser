// Verificação final de tarefa feita pelo host: o chamador declara o que deve ser verdade ao terminar e o resultado
// carrega a prova. Não executa nada além de ler URL, texto visível e downloads já registrados.

const { normalizeText } = require('./expectation');

const CHECK_KINDS = Object.freeze(['url', 'text', 'absent', 'textCount', 'download']);
const MAX_CHECKS = 20;

const CHECK_TASK_TOOL = {
  type: 'function',
  function: {
    name: 'check_task',
    description: 'Confere agora o contrato de verificação da tarefa e devolve o motivo de cada checagem. Use antes de encerrar quando quiser saber se o estado da página já satisfaz o pedido. Somente leitura.',
    parameters: { type: 'object', properties: {}, additionalProperties: false }
  }
};

function validateChecks(checks) {
  if (!Array.isArray(checks) || checks.length === 0) return 'Informe ao menos uma verificação.';
  if (checks.length > MAX_CHECKS) return `No máximo ${MAX_CHECKS} verificações por tarefa.`;
  for (const [i, check] of checks.entries()) {
    const label = `Verificação ${i + 1}`;
    if (!check || typeof check !== 'object' || Array.isArray(check)) return `${label}: inválida.`;
    if (!CHECK_KINDS.includes(check.kind)) return `${label}: kind deve ser ${CHECK_KINDS.join(', ')}.`;
    if (check.kind === 'download') {
      if (check.value !== undefined && (typeof check.value !== 'string' || !check.value.trim())) return `${label}: value deve ser o nome do arquivo.`;
      continue;
    }
    if (typeof check.value !== 'string' || !check.value.trim()) return `${label}: value não vazio é obrigatório.`;
    if (check.kind === 'textCount') {
      if (check.min !== undefined && (!Number.isInteger(check.min) || check.min < 0)) return `${label}: min deve ser inteiro não negativo.`;
      if (check.max !== undefined && (!Number.isInteger(check.max) || check.max < 0)) return `${label}: max deve ser inteiro não negativo.`;
      if (check.min !== undefined && check.max !== undefined && check.min > check.max) return `${label}: min maior que max.`;
    }
  }
  return null;
}

function countOccurrences(text, needle) {
  if (!needle) return 0;
  let count = 0;
  let index = 0;
  for (;;) {
    const found = text.indexOf(needle, index);
    if (found < 0) return count;
    count += 1;
    index = found + needle.length;
  }
}

function evaluateDownload(check, downloads) {
  const wanted = normalizeText(check.value || '');
  const list = Array.isArray(downloads) ? downloads : [];
  const matches = list.filter((item) => {
    if (!item || item.state !== 'completed') return false;
    if (!wanted) return true;
    const name = normalizeText(String(item.filename || item.path || '').split(/[\\/]/).pop());
    return name === wanted;
  });
  if (!matches.length) {
    const seen = list.map((item) => `${item?.filename || '?'} (${item?.state || '?'})`).join(', ') || 'nenhum';
    return { ok: false, detail: `download "${check.value || 'qualquer'}" não concluído; vistos: ${seen}` };
  }
  return { ok: true, detail: `download concluído: ${matches[0].filename || matches[0].path}` };
}

function evaluateCheck(check, state) {
  const text = normalizeText(state?.text || '');
  const value = normalizeText(check.value || '');
  switch (check.kind) {
    case 'url': {
      const current = String(state?.url || '');
      return current.startsWith(check.value)
        ? { ok: true, detail: `URL ${current} começa com ${check.value}` }
        : { ok: false, detail: `URL atual ${current || '(vazia)'} não começa com ${check.value}` };
    }
    case 'text':
      return text.includes(value)
        ? { ok: true, detail: `texto presente: ${check.value}` }
        : { ok: false, detail: `texto ausente: ${check.value}` };
    case 'absent':
      return text.includes(value)
        ? { ok: false, detail: `texto ainda presente: ${check.value}` }
        : { ok: true, detail: `texto ausente como esperado: ${check.value}` };
    case 'textCount': {
      const count = countOccurrences(text, value);
      const min = check.min ?? 1;
      const max = check.max;
      const ok = count >= min && (max === undefined || count <= max);
      return { ok, count, detail: ok ? `"${check.value}" apareceu ${count}×` : `"${check.value}" apareceu ${count}× (esperado ${max === undefined ? `≥ ${min}` : `${min}–${max}`})` };
    }
    case 'download':
      return evaluateDownload(check, state?.downloads);
    default:
      return { ok: false, detail: `verificação desconhecida: ${check.kind}` };
  }
}

function evaluateChecks(checks, state = {}) {
  const results = (Array.isArray(checks) ? checks : []).map((check) => ({
    kind: check.kind,
    ...(check.value === undefined ? {} : { value: check.value }),
    ...evaluateCheck(check, state)
  }));
  return { ok: results.length > 0 && results.every((result) => result.ok), results };
}

module.exports = { CHECK_KINDS, MAX_CHECKS, CHECK_TASK_TOOL, validateChecks, evaluateChecks, evaluateCheck, countOccurrences };

// Pós-condição de um passo de run_steps: o modelo declara o que deve ser verdade depois da ação e o host confirma.
// Compara texto visível sem acento/caixa e URL por prefixo; nada aqui toca na página.

const EXPECT_KEYS = Object.freeze(['url', 'text', 'absent']);

function normalizeText(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function needsPageText(expect) {
  return Boolean(expect && typeof expect === 'object' && (expect.text !== undefined || expect.absent !== undefined));
}

function invalidExpectationReason(expect) {
  if (expect === undefined || expect === null) return null;
  if (typeof expect !== 'object' || Array.isArray(expect)) return 'expect deve ser um objeto';
  const keys = Object.keys(expect);
  if (!keys.length) return 'expect precisa de url, text ou absent';
  const unknown = keys.find((key) => !EXPECT_KEYS.includes(key));
  if (unknown) return `expect não aceita "${unknown}"`;
  if (keys.some((key) => typeof expect[key] !== 'string')) return 'expect aceita apenas textos';
  if (keys.every((key) => !normalizeText(expect[key]))) return 'expect precisa de um valor não vazio';
  return null;
}

function evaluateExpectation(expect, snapshot = {}) {
  if (!expect || typeof expect !== 'object') return { ok: true };
  if (expect.url !== undefined) {
    const current = String(snapshot.url || '');
    if (!current.startsWith(String(expect.url))) {
      return { ok: false, reason: 'url', detail: `URL atual ${current || '(vazia)'} não começa com ${expect.url}` };
    }
  }
  if (needsPageText(expect)) {
    const body = normalizeText(snapshot.text || '');
    if (expect.text !== undefined) {
      const wanted = normalizeText(expect.text);
      if (wanted && !body.includes(wanted)) return { ok: false, reason: 'text', detail: `texto "${expect.text}" não apareceu` };
    }
    if (expect.absent !== undefined) {
      const unwanted = normalizeText(expect.absent);
      if (unwanted && body.includes(unwanted)) return { ok: false, reason: 'absent', detail: `texto "${expect.absent}" ainda está na página` };
    }
  }
  return { ok: true };
}

module.exports = { EXPECT_KEYS, normalizeText, needsPageText, invalidExpectationReason, evaluateExpectation };

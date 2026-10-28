// Transformação determinística em processo separado: o código do agente roda sem require, rede ou disco,
// com tempo e tamanho limitados. Não é uma fronteira de segurança contra código nativo — por isso a
// verificação estática recusa tudo que tente sair do contexto.

const { spawn } = require('child_process');
const path = require('path');

const MAX_CODE = 4000;
const MAX_INPUT_BYTES = 256000;
const MAX_OUTPUT_BYTES = 256000;
const DEFAULT_TIMEOUT_MS = 2000;

// Padrões que, se aceitos, dariam acesso ao processo, ao disco, à rede ou a código dinâmico.
const FORBIDDEN = [
  [/\brequire\s*\(/, 'require'],
  [/\bimport\s*\(/, 'import()'],
  [/\bprocess\b/, 'process'],
  [/\bglobalThis\b/, 'globalThis'],
  [/\bFunction\s*\(/, 'Function()'],
  [/\beval\s*\(/, 'eval()'],
  [/\bfetch\s*\(/, 'fetch()'],
  [/\bXMLHttpRequest\b/, 'XMLHttpRequest'],
  [/\bWebSocket\b/, 'WebSocket'],
  [/\bchild_process\b/, 'child_process'],
  [/\brequire\.resolve\b/, 'require.resolve']
];

function checkCode(code) {
  if (typeof code !== 'string' || !code.trim()) return 'code é obrigatório.';
  if (code.length > MAX_CODE) return `code acima de ${MAX_CODE} caracteres.`;
  for (const [pattern, label] of FORBIDDEN) {
    if (pattern.test(code)) return `código recusado: ${label} não é permitido no sandbox.`;
  }
  return null;
}

function runTransform(code, input = null, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const problem = checkCode(code);
  if (problem) return Promise.resolve({ ok: false, error: problem });
  let payload;
  try {
    payload = JSON.stringify({ code, input });
  } catch {
    return Promise.resolve({ ok: false, error: 'input não é serializável em JSON.' });
  }
  if (Buffer.byteLength(payload) > MAX_INPUT_BYTES) return Promise.resolve({ ok: false, error: 'input grande demais.' });

  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(__dirname, 'sandbox-worker.js')], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {},
      windowsHide: true
    });
    let out = '';
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { child.kill(); } catch {}
      resolve(value);
    };
    const timer = setTimeout(() => finish({ ok: false, error: `tempo limite de ${timeoutMs} ms no sandbox` }), timeoutMs);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      out += chunk;
      if (out.length > MAX_OUTPUT_BYTES) finish({ ok: false, error: 'saída grande demais' });
    });
    child.on('error', (error) => finish({ ok: false, error: String(error?.message || error) }));
    child.on('close', () => {
      try {
        const parsed = JSON.parse(out || '{}');
        finish(parsed && typeof parsed === 'object' ? parsed : { ok: false, error: 'resposta inválida do sandbox' });
      } catch {
        finish({ ok: false, error: 'resposta inválida do sandbox' });
      }
    });
    try {
      child.stdin.write(payload);
      child.stdin.end();
    } catch (error) {
      finish({ ok: false, error: String(error?.message || error) });
    }
  });
}

const TRANSFORM_TOOL = {
  type: 'function',
  function: {
    name: 'transform',
    description: 'Executa uma função JavaScript determinística sobre dados já lidos (ex.: somar uma coluna, normalizar datas) em processo isolado, sem require/rede/disco. O código é o corpo de uma função que recebe input e deve retornar o resultado.',
    parameters: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Corpo da função: use input e retorne o valor. Ex.: return input.rows.map(r => Number(r[1])).reduce((a,b) => a+b, 0)' },
        input: { description: 'Dados JSON já capturados (planilha, tabela).' }
      },
      required: ['code'],
      additionalProperties: false
    }
  }
};

module.exports = { checkCode, runTransform, TRANSFORM_TOOL, FORBIDDEN, MAX_CODE, DEFAULT_TIMEOUT_MS };

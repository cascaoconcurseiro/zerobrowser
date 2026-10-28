// A execução está bloqueada: Node vm e filtragem de texto não são uma fronteira de segurança.

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

function runTransform() {
  return Promise.resolve({ ok: false, error: 'Execução de transformações e módulos desativada: isolamento de segurança indisponível.' });
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

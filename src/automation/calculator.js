// Aritmética exata para o agente. Modelos erram somas longas (ex.: 659,95 em vez de 660,00); aqui a conta é determinística.
// Aceita números com ponto decimal, + - * / ( ) e menos unário. Sem eval: analisador próprio.
function tokenize(expression) {
  const tokens = [];
  const text = String(expression);
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (/\s/.test(ch)) { i += 1; continue; }
    if (/[0-9.]/.test(ch)) {
      const match = /^(?:\d+\.?\d*|\.\d+)/.exec(text.slice(i));
      if (!match) throw new Error(`Número inválido perto de "${text.slice(i, i + 8)}"`);
      tokens.push({ type: 'num', value: match[0] });
      i += match[0].length;
      continue;
    }
    if ('+-*/()'.includes(ch)) { tokens.push({ type: ch }); i += 1; continue; }
    throw new Error(`Caractere não permitido: "${ch}". Use só números com ponto decimal e + - * / ( )`);
  }
  return tokens;
}

// Decimais viram inteiros escalados (BigInt) para somar centavos sem erro de ponto flutuante.
function toScaled(value) {
  const [whole, frac = ''] = value.split('.');
  return { n: BigInt((whole || '0') + frac), scale: frac.length };
}

function align(a, b) {
  const scale = Math.max(a.scale, b.scale);
  return [a.n * 10n ** BigInt(scale - a.scale), b.n * 10n ** BigInt(scale - b.scale), scale];
}

function evaluate(tokens) {
  let pos = 0;
  const peek = () => tokens[pos]?.type;
  const parseExpr = () => {
    let left = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = tokens[pos++].type;
      const right = parseTerm();
      const [a, b, scale] = align(left, right);
      left = { n: op === '+' ? a + b : a - b, scale };
    }
    return left;
  };
  const parseTerm = () => {
    let left = parseFactor();
    while (peek() === '*' || peek() === '/') {
      const op = tokens[pos++].type;
      const right = parseFactor();
      if (op === '*') {
        left = { n: left.n * right.n, scale: left.scale + right.scale };
      } else {
        if (right.n === 0n) throw new Error('Divisão por zero');
        // 12 casas extras bastam para valores de planilha; o resultado final é arredondado na saída.
        const extra = 12;
        left = { n: (left.n * 10n ** BigInt(extra + right.scale)) / (right.n * 10n ** BigInt(left.scale)), scale: extra };
      }
    }
    return left;
  };
  const parseFactor = () => {
    const token = tokens[pos++];
    if (!token) throw new Error('Expressão incompleta');
    if (token.type === '-') { const v = parseFactor(); return { n: -v.n, scale: v.scale }; }
    if (token.type === '+') return parseFactor();
    if (token.type === 'num') return toScaled(token.value);
    if (token.type === '(') {
      const v = parseExpr();
      if (tokens[pos++]?.type !== ')') throw new Error('Parêntese não fechado');
      return v;
    }
    throw new Error('Expressão inválida');
  };
  const result = parseExpr();
  if (pos !== tokens.length) throw new Error('Expressão inválida');
  return result;
}

function format({ n, scale }, decimals) {
  // Arredonda meio-para-cima (em módulo) para `decimals` casas e remove zeros finais.
  const negative = n < 0n;
  let abs = negative ? -n : n;
  if (scale > decimals) {
    const divisor = 10n ** BigInt(scale - decimals);
    abs = (abs + divisor / 2n) / divisor;
    scale = decimals;
  }
  const digits = abs.toString().padStart(scale + 1, '0');
  const whole = digits.slice(0, digits.length - scale);
  const frac = scale ? digits.slice(-scale).replace(/0+$/, '') : '';
  const text = frac ? `${whole}.${frac}` : whole;
  return negative && /[1-9]/.test(text) ? `-${text}` : text;
}

function calculate(args = {}) {
  const expression = String(args.expression ?? '');
  if (!expression.trim()) return { success: false, error: 'Informe expression, por exemplo "12.5 + 3*(2-0.5)"' };
  if (expression.length > 2000) return { success: false, error: 'Expressão longa demais (máximo 2000 caracteres)' };
  const decimals = Number.isInteger(args.decimals) ? Math.min(Math.max(args.decimals, 0), 10) : 2;
  try {
    const value = evaluate(tokenize(expression));
    return { success: true, expression: expression.trim(), result: format(value, decimals), decimals };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = { calculate };

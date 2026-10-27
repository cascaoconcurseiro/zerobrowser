// Classificação de risco de um controle/ação, por capacidade e não por lista solta de palavras.
// Níveis: credential (senha/código/pagamento), destructive, commitment (compra/envio/publicação),
// write (salvar/atualizar) e none. O serviço usa o motivo; o nível fica disponível para políticas futuras.

const INTENTS = Object.freeze([
  {
    level: 'destructive',
    terms: [
      'delete', 'delete account', 'remove', 'remove account', 'destroy', 'erase', 'reset', 'wipe', 'revoke',
      'cancel order', 'cancel subscription', 'unsubscribe', 'log out', 'sign out',
      'excluir', 'excluir conta', 'apagar', 'apagar conta', 'remover', 'destruir', 'zerar', 'revogar',
      'cancelar', 'cancelamento', 'sair', 'desconectar'
    ]
  },
  {
    level: 'commitment',
    terms: [
      'purchase', 'buy', 'pay', 'checkout', 'place order', 'submit order', 'confirm purchase', 'confirm order',
      'send money', 'transfer', 'publish',
      'post', 'send', 'subscribe', 'book', 'reserve', 'donate',
      'comprar', 'pagar', 'pagamento', 'finalizar compra', 'finalizar pedido', 'fechar pedido', 'concluir compra',
      'concluir pedido', 'confirmar compra', 'confirmar pedido', 'transferir',
      'publicar', 'postar', 'enviar', 'assinar', 'reservar', 'doar', 'contratar'
    ]
  },
  {
    level: 'write',
    terms: [
      'save', 'save changes', 'update', 'update account', 'confirm', 'submit', 'register', 'sign up',
      'salvar', 'atualizar', 'confirmar', 'enviar formulario', 'cadastrar', 'registrar', 'inscrever'
    ]
  }
]);

const SENSITIVE_TYPES = new Set(['password', 'one-time-code', 'cc-number', 'cc-csc', 'cc-exp']);
const SENSITIVE_HINT = /password|passwd|senha|one-?time|otp|token|pin\b|cc-number|cc-csc|cc-exp|card|cvv|cvc/i;

function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesTerm(text, term) {
  const normalizedTerm = normalize(term);
  if (!normalizedTerm) return false;
  const index = text.indexOf(normalizedTerm);
  if (index < 0) return false;
  const before = index === 0 ? ' ' : text[index - 1];
  const after = index + normalizedTerm.length >= text.length ? ' ' : text[index + normalizedTerm.length];
  return !/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after);
}

function classifyIntent(context) {
  const text = normalize(context);
  if (!text) return null;
  for (const intent of INTENTS) {
    for (const term of intent.terms) {
      if (matchesTerm(text, term)) return { level: intent.level, term };
    }
  }
  return null;
}

function isSensitiveField({ type = '', autocomplete = '', name = '', label = '' } = {}) {
  if (SENSITIVE_TYPES.has(String(type).toLowerCase())) return true;
  return SENSITIVE_HINT.test(`${autocomplete} ${name} ${label}`);
}

function classifyRisk({ node = {}, context = '' } = {}) {
  if (node.sensitiveInput === true || isSensitiveField(node)) {
    return { level: 'credential', reason: 'Campo de senha, código de verificação ou pagamento' };
  }
  const intent = classifyIntent(context);
  if (intent?.level === 'destructive') return { level: 'destructive', reason: `Ação destrutiva: ${intent.term}` };
  if (intent?.level === 'commitment') return { level: 'commitment', reason: `Ação de compromisso: ${intent.term}` };
  if (intent?.level === 'write') return { level: 'write', reason: `Alteração de dados: ${intent.term}` };
  if (node.isSubmitControl === true || String(node.formMethod || '').toLowerCase() === 'post') {
    return { level: 'commitment', reason: 'Envio de formulário' };
  }
  return { level: 'none', reason: null };
}

// Motivo de aprovação que vem só do modo escolhido pelo usuário (o risco do controle é avaliado à parte).
function approvalReasonForMode(mode, { readOnly = false } = {}) {
  if (mode === 'always-ask') return 'O modo “Sempre perguntar” está ativo';
  if (mode === 'allow-read' && !readOnly) return 'O modo “Permitir leitura” exige confirmação antes de alterar a página';
  return null;
}

module.exports = { INTENTS, classifyIntent, classifyRisk, isSensitiveField, approvalReasonForMode, normalize };

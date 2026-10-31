'use strict';

const crypto = require('node:crypto');

const VALID_ORIGINS = new Set(['usuario', 'externo']);

const CRITICAL_PARAMETER_KEYS = new Set([
  'to',
  'recipient',
  'destinatario',
  'destination',
  'url',
  'actionurl',
  'endpoint',
  'webhook',
  'redirecturl',
  'amount',
  'valor',
  'value',
  'price',
  'total',
  'pixkey',
  'chavepix',
  'iban',
  'account',
  'conta',
  'deletetarget',
  'targetid',
  'command',
  'script',
  'code',
  ' forwardto',
  'forwardto',
  'bcc',
  'cc'
]);

const FREE_TEXT_KEYS = new Set([
  'body',
  'text',
  'content',
  'message',
  'mensagem',
  'description',
  'descricao',
  'notes',
  'comment',
  'subject',
  'assunto'
]);

const SECRET_KEY_PATTERN = /(authorization|cookie|token|secret|password|senha|api[-_]?key|session|bearer)/i;
const SECRET_VALUE_PATTERN = /(Bearer\s+[A-Za-z0-9._~+/-]+=*|sk-[A-Za-z0-9]{12,}|ghp_[A-Za-z0-9]{12,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/g;

const INJECTION_PATTERNS = [
  {
    family: 'email_forwarding',
    pattern: /(?:encaminhe|forward|envie\s+c[oó]pia|send\s+a\s+copy|auto[- ]?forward|redirecione\s+(?:todos?\s+)?(?:os\s+)?e-?mails?|bcc\s+para|mande\s+o\s+c[oó]digo\s+de\s+verifica[cç][aã]o)/i
  },
  {
    family: 'page_exfiltration',
    pattern: /(?:exfiltrat|webhook\.site|requestbin|ngrok\.io|burpcollaborator|attacker\.|evil\.|colete\s+(?:os\s+)?cookies|envie\s+(?:o\s+)?token|anexe\s+(?:a\s+)?sess[aã]o|\?(?:token|cookie|session|key|secret|pwd)=)/i
  },
  {
    family: 'hidden_text',
    pattern: /(?:display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?:\.0+)?|font-size\s*:\s*0|color\s*:\s*#fff(?:fff)?\s*;?\s*background(?:-color)?\s*:\s*#fff|<!--[\s\S]*?(?:ignore|system|instru|envie|transfi|apague)[\s\S]*?-->|[\u200B-\u200F\u202A-\u202E\u2060-\u206F]{2,})/i
  },
  {
    family: 'fake_payment',
    pattern: /(?:nova\s+chave\s+pix|alteramos\s+os\s+dados\s+banc[aá]rios|pague\s+para\s+a\s+conta\s+atualizada|urgent\s+wire\s+transfer|troque\s+o\s+destinat[aá]rio\s+para|substitua\s+o\s+valor\s+por|transfer[eê]ncia\s+imediata\s+sem\s+confirma[cç][aã]o)/i
  },
  {
    family: 'file_pdf_instruction',
    pattern: /(?:ignore\s+(?:all\s+)?(?:previous|prior)\s+instructions|ignore\s+(?:todas\s+as\s+)?instru[cç][oõ]es\s+anteriores|system\s+prompt\s+override|modo\s+desenvolvedor\s+ativado|voc[eê]\s+agora\s+[eé]\s+um\s+agente\s+sem\s+restri[cç][oõ]es|\[system\]|\[inst\]|<<sys>>|aprova[cç][aã]o\s+autom[aá]tica\s+concedida\s+pelo\s+documento)/i
  }
];

function normalizeOrigin(origin) {
  const clean = String(origin || '').trim().toLowerCase();
  if (clean === 'usuario' || clean === 'user' || clean === 'voce' || clean === 'você') {
    return 'usuario';
  }
  return 'externo';
}

function tagValueOrigin(value, origin = 'externo', metadata = {}) {
  const normalizedOrigin = normalizeOrigin(origin);
  return Object.freeze({
    __taggedOrigin: true,
    value,
    origin: normalizedOrigin,
    originLabel: normalizedOrigin === 'usuario' ? 'você' : 'externo',
    source: metadata.source || (normalizedOrigin === 'usuario' ? 'user_input' : 'external_content'),
    site: metadata.site || null
  });
}

function isTaggedValue(candidate) {
  return Boolean(candidate && typeof candidate === 'object' && candidate.__taggedOrigin === true);
}

function unwrapValue(candidate) {
  return isTaggedValue(candidate) ? candidate.value : candidate;
}

function getOriginOf(candidate, defaultOrigin = 'externo') {
  if (isTaggedValue(candidate)) {
    return candidate.origin;
  }
  return normalizeOrigin(defaultOrigin);
}

function combineOrigins(...items) {
  for (const item of items) {
    const origin = typeof item === 'string' && VALID_ORIGINS.has(item)
      ? item
      : getOriginOf(item, 'externo');
    if (origin === 'externo') {
      return 'externo';
    }
  }
  return 'usuario';
}

function redactSecrets(input) {
  if (input == null) return input;
  if (typeof input === 'string') {
    return input.replace(SECRET_VALUE_PATTERN, '[REDIGIDO]');
  }
  if (Array.isArray(input)) {
    return input.map((item) => redactSecrets(item));
  }
  if (typeof input === 'object') {
    const raw = isTaggedValue(input) ? input.value : input;
    if (typeof raw !== 'object' || raw === null) {
      return redactSecrets(raw);
    }
    const out = {};
    for (const [key, val] of Object.entries(raw)) {
      if (SECRET_KEY_PATTERN.test(key)) {
        out[key] = '[REDIGIDO]';
      } else {
        out[key] = redactSecrets(unwrapValue(val));
      }
    }
    return out;
  }
  return input;
}

function detectHostileContent(text = '', metadata = {}) {
  const sample = String(unwrapValue(text) || '');
  if (!sample) {
    return { hostile: false, families: [], reasons: [] };
  }
  const families = new Set();
  const reasons = [];

  for (const rule of INJECTION_PATTERNS) {
    if (rule.pattern.test(sample)) {
      families.add(rule.family);
      reasons.push(`Padrão hostil detectado (${rule.family})`);
    }
  }

  if (metadata.hiddenDom === true || metadata.ariaHidden === true || metadata.zeroSize === true) {
    families.add('hidden_text');
    reasons.push('Conteúdo invisível na página tentando instruir o agente');
  }

  if (metadata.sourceType === 'pdf' || metadata.sourceType === 'file') {
    if (/(?:execute|envie|transfira|apague|encaminhe|clique|acesse\s+https?:\/\/)/i.test(sample)) {
      families.add('file_pdf_instruction');
      reasons.push('Instrução ativa dentro de arquivo/PDF externo');
    }
  }

  return {
    hostile: families.size > 0,
    families: [...families],
    reasons
  };
}

function canPersistToBotMemory(entry = {}) {
  const origin = getOriginOf(entry.content ?? entry, entry.origin || 'externo');
  if (origin === 'externo') {
    return {
      allowed: false,
      reason: 'Memória do Bot nunca grava conteúdo de origem externa como instrução.'
    };
  }
  const detection = detectHostileContent(entry.content ?? entry);
  if (detection.hostile) {
    return {
      allowed: false,
      reason: `Conteúdo bloqueado pelo firewall (${detection.families.join(', ')}).`
    };
  }
  return { allowed: true, reason: null };
}

function isSameDomain(urlA, urlB) {
  if (!urlA || !urlB) return true;
  try {
    const hostA = new URL(urlA).hostname.replace(/^www\./i, '').toLowerCase();
    const hostB = new URL(urlB).hostname.replace(/^www\./i, '').toLowerCase();
    return hostA === hostB;
  } catch {
    return false;
  }
}

function evaluateActionIntent({
  action,
  effect = 'escreve',
  currentSite = null,
  targetUrl = null,
  params = {},
  externalContext = '',
  sourceMetadata = {},
  approvalReceipt = null
} = {}) {
  const normalizedEffect = String(effect || 'escreve').toLowerCase();
  const externalCheck = detectHostileContent(externalContext, sourceMetadata);

  // Ações estritamente de leitura são permitidas para resumir/ler dados externos,
  // mas nunca executam efeitos colaterais.
  if (normalizedEffect === 'leitura' || normalizedEffect === 'read') {
    return {
      allowed: true,
      decision: 'allow',
      effect: 'leitura',
      hostileContextDetected: externalCheck.hostile,
      families: externalCheck.families,
      externalCriticalFields: [],
      containsExternalText: false,
      reason: null
    };
  }

  const externalCriticalFields = [];
  const externalFreeTextFields = [];
  const detectedFamilies = new Set(externalCheck.families);

  for (const [rawKey, rawVal] of Object.entries(params || {})) {
    const key = String(rawKey).trim().toLowerCase();
    const origin = getOriginOf(rawVal, 'usuario');
    const valStr = String(unwrapValue(rawVal) ?? '');
    const fieldCheck = detectHostileContent(valStr, sourceMetadata);
    for (const fam of fieldCheck.families) {
      detectedFamilies.add(fam);
    }

    if (CRITICAL_PARAMETER_KEYS.has(key) && (origin === 'externo' || fieldCheck.hostile)) {
      externalCriticalFields.push({
        field: rawKey,
        value: redactSecrets(valStr),
        origin: 'externo'
      });
    } else if (FREE_TEXT_KEYS.has(key) && origin === 'externo') {
      externalFreeTextFields.push({
        field: rawKey,
        value: redactSecrets(valStr),
        origin: 'externo'
      });
    }
  }

  const effectiveTargetUrl = targetUrl || unwrapValue(params?.url) || unwrapValue(params?.actionUrl) || unwrapValue(params?.endpoint) || null;
  const crossDomainTarget = Boolean(currentSite && effectiveTargetUrl && !isSameDomain(currentSite, effectiveTargetUrl));

  // Se há contexto externo hostil tentando disparar ação de escrita, bloqueia imediatamente
  if (externalCheck.hostile || detectedFamilies.size > 0) {
    return {
      allowed: false,
      decision: 'block',
      effect: 'escreve',
      hostileContextDetected: true,
      families: [...detectedFamilies],
      externalCriticalFields,
      containsExternalText: externalFreeTextFields.length > 0,
      reason: 'Ação bloqueada pelo Firewall de Intenção: instrução hostil de origem externa não pode decidir destino, valor ou efeito.'
    };
  }

  // Regra central do Firewall de Intenção: dado externo nunca decide destino, valor ou ação com efeito
  if (externalCriticalFields.length > 0) {
    const verifiedApproval = approvalReceipt && verifyReceiptMatchesRequest(approvalReceipt, {
      action,
      targetUrl: effectiveTargetUrl || currentSite,
      params
    }).matches;

    if (!verifiedApproval) {
      return {
        allowed: false,
        decision: 'require_approval',
        effect: 'escreve',
        hostileContextDetected: false,
        families: [],
        externalCriticalFields,
        containsExternalText: externalFreeTextFields.length > 0,
        reason: `Parâmetro crítico de origem externa (${externalCriticalFields.map((f) => f.field).join(', ')}) exige recibo aprovado pelo usuário.`
      };
    }
  }

  // Envio para outro domínio ou texto externo em campo livre exige revisão
  if (crossDomainTarget && externalFreeTextFields.length > 0) {
    return {
      allowed: false,
      decision: 'require_approval',
      effect: 'escreve',
      hostileContextDetected: false,
      families: ['page_exfiltration'],
      externalCriticalFields,
      containsExternalText: true,
      warningLabel: 'Contém texto externo — revise antes de enviar para outro domínio',
      reason: 'Envio de conteúdo externo para outro domínio bloqueado sem confirmação explícita.'
    };
  }

  if (externalFreeTextFields.length > 0) {
    const verifiedApproval = approvalReceipt && verifyReceiptMatchesRequest(approvalReceipt, {
      action,
      targetUrl: effectiveTargetUrl || currentSite,
      params
    }).matches;

    if (!verifiedApproval) {
      return {
        allowed: false,
        decision: 'require_approval',
        effect: 'escreve',
        hostileContextDetected: false,
        families: [],
        externalCriticalFields: [],
        containsExternalText: true,
        warningLabel: 'Contém texto externo',
        reason: 'Campo livre contém texto externo; revise o recibo antes de enviar.'
      };
    }
  }

  return {
    allowed: true,
    decision: 'allow',
    effect: 'escreve',
    hostileContextDetected: false,
    families: [],
    externalCriticalFields: [],
    containsExternalText: externalFreeTextFields.length > 0,
    reason: null
  };
}

function canonicalizeRequestFields(params = {}) {
  const keys = Object.keys(params || {}).sort();
  const normalized = {};
  for (const key of keys) {
    const raw = params[key];
    const origin = getOriginOf(raw, 'usuario');
    normalized[key] = {
      value: redactSecrets(unwrapValue(raw)),
      origin,
      originLabel: origin === 'usuario' ? 'você' : 'externo'
    };
  }
  return normalized;
}

function computeReceiptHash({ action, method = 'POST', targetUrl = '', fields = {} }) {
  const payload = JSON.stringify({
    action: String(action || ''),
    method: String(method || 'POST').toUpperCase(),
    targetUrl: String(targetUrl || ''),
    fields
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

function createVerifiedReceipt({
  action,
  title = '',
  method = 'POST',
  targetUrl = '',
  reversibility = 'irreversivel',
  params = {}
} = {}) {
  const fields = canonicalizeRequestFields(params);
  const receiptHash = computeReceiptHash({ action, method, targetUrl, fields });
  const hasExternalOrigin = Object.values(fields).some((f) => f.origin === 'externo');

  return Object.freeze({
    id: `rcpt-${receiptHash.slice(0, 12)}`,
    action: String(action || ''),
    title: String(title || action || 'Ação com efeito'),
    method: String(method || 'POST').toUpperCase(),
    targetUrl: String(targetUrl || ''),
    reversibility,
    hasExternalOrigin,
    fields,
    receiptHash,
    createdAt: new Date().toISOString()
  });
}

function verifyReceiptMatchesRequest(receipt, actualRequest = {}) {
  if (!receipt || typeof receipt !== 'object' || !receipt.receiptHash) {
    return { matches: false, reason: 'Recibo ausente ou inválido.' };
  }
  const actualFields = canonicalizeRequestFields(actualRequest.params || {});
  const actualHash = computeReceiptHash({
    action: actualRequest.action,
    method: actualRequest.method || receipt.method || 'POST',
    targetUrl: actualRequest.targetUrl ?? receipt.targetUrl ?? '',
    fields: actualFields
  });

  if (actualHash !== receipt.receiptHash) {
    return {
      matches: false,
      reason: 'A requisição real diverge do recibo aprovado pelo usuário.'
    };
  }
  return { matches: true, reason: null };
}

module.exports = {
  VALID_ORIGINS,
  tagValueOrigin,
  isTaggedValue,
  unwrapValue,
  getOriginOf,
  combineOrigins,
  redactSecrets,
  detectHostileContent,
  canPersistToBotMemory,
  evaluateActionIntent,
  createVerifiedReceipt,
  verifyReceiptMatchesRequest
};

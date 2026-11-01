'use strict';

// Política de site e perfil isolado do Bot.
// Regra: a lista de sites do Bot é um limite rígido, conferido no processo principal em
// cada navegação (endereço digitado, link, redirecionamento, pop-up e loadURL do agente).
// Nada aqui fala com o Electron: são funções puras para poder testar sem app aberto.

// Perfil do usuário: continua sendo o único usado pelas abas normais (compatibilidade de dados).
const USER_PARTITION = 'persist:navegante';
// Cada Bot recebe um perfil próprio: nunca enxerga cookies, logins ou sessão do usuário.
const BOT_PARTITION_PREFIX = `${USER_PARTITION}-bot`;

// about:blank é a aba vazia onde o Bot começa; não é site e não abre rede.
const BLANK_URLS = new Set(['about:blank']);

function sanitizePartitionKey(botId) {
  const cleaned = String(botId ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
  return cleaned || 'sem-id';
}

function botPartitionFor(botId) {
  return `${BOT_PARTITION_PREFIX}-${sanitizePartitionKey(botId)}`;
}

function isBotPartition(partition) {
  return String(partition || '').startsWith(`${BOT_PARTITION_PREFIX}-`);
}

function normalizeAllowedSites(allowedSites) {
  if (!Array.isArray(allowedSites)) return [];
  return allowedSites.map((site) => String(site ?? '').trim()).filter(Boolean);
}

// Aceita "site.com", "https://site.com", "*.site.com", "site.com/loja" e "*".
function parseSiteEntry(entry) {
  const raw = String(entry ?? '').trim();
  if (!raw) return null;
  if (raw === '*') return { any: true };

  let candidate = raw;
  let protocol = '';
  const schemeMatch = /^(https?):\/\//i.exec(candidate);
  if (schemeMatch) {
    protocol = `${schemeMatch[1].toLowerCase()}:`;
    candidate = candidate.slice(schemeMatch[0].length);
  }

  const pathIndex = candidate.indexOf('/');
  let hostPart = pathIndex === -1 ? candidate : candidate.slice(0, pathIndex);
  const pathPrefix = pathIndex === -1 ? '' : candidate.slice(pathIndex);

  hostPart = hostPart
    .replace(/^\*\./, '')
    .replace(/\.$/, '')
    .toLowerCase()
    .split(':')[0]
    .trim();
  if (!hostPart) return null;

  return { host: hostPart, protocol, pathPrefix };
}

function isUrlAllowedForBot(rawUrl, allowedSites = []) {
  const raw = String(rawUrl ?? '').trim();
  if (!raw) return false;
  if (BLANK_URLS.has(raw.toLowerCase())) return true;

  let url;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  // download:, file:, data:, javascript: e chrome:// nunca entram na aba do Bot.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;

  const entries = normalizeAllowedSites(allowedSites);
  // Sem lista, o Bot pode navegar em HTTP/HTTPS; os esquemas perigosos seguem bloqueados.
  if (entries.length === 0) return true;

  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  return entries.some((entry) => {
    const parsed = parseSiteEntry(entry);
    if (!parsed) return false;
    if (parsed.any) return true;
    if (parsed.protocol && parsed.protocol !== url.protocol) return false;
    // A entrada vale para o site e para os subdomínios dele.
    if (hostname !== parsed.host && !hostname.endsWith(`.${parsed.host}`)) return false;
    if (parsed.pathPrefix && !url.pathname.startsWith(parsed.pathPrefix)) return false;
    return true;
  });
}

function siteBlockedMessage(rawUrl, allowedSites = []) {
  const entries = normalizeAllowedSites(allowedSites);
  const where = String(rawUrl ?? '').trim() || 'endereço vazio';
  if (entries.length === 0) {
    return `O Bot não pode abrir "${where}": só endereços http e https são permitidos.`;
  }
  return `O Bot não pode abrir "${where}": o site não está na lista do Bot (${entries.join(', ')}).`;
}

module.exports = {
  USER_PARTITION,
  BOT_PARTITION_PREFIX,
  sanitizePartitionKey,
  botPartitionFor,
  isBotPartition,
  normalizeAllowedSites,
  parseSiteEntry,
  isUrlAllowedForBot,
  siteBlockedMessage
};

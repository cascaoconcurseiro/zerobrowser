// Cache explícito de prefixo: só envia o que o provedor entende e sempre reporta se rendeu.
// Opt-in — sem a flag, o corpo da requisição continua idêntico ao de antes.

const crypto = require('crypto');

const KEY_PROVIDERS = new Set(['openai', 'openrouter']);
const ANTHROPIC_MODEL = /claude|anthropic/i;

function cacheKeyFor(seed) {
  const digest = crypto.createHash('sha256').update(String(seed || '')).digest('hex').slice(0, 40);
  return `zb-${digest}`;
}

// O cache de prefixo só ajuda se o começo da conversa for o mesmo entre passos e execuções.
function cacheSeed({ origin, prompt, model }) {
  return `${origin || ''}\u0000${model || ''}\u0000${String(prompt || '').slice(0, 2000)}`;
}

// Devolve os campos a mesclar no corpo. Não mexe em mensagens além do system (e só em modelo Claude).
function cacheRequestFields({ provider, model, messages, enabled, seed }) {
  if (!enabled) return { messages };
  const fields = {};
  if (KEY_PROVIDERS.has(provider)) fields.prompt_cache_key = cacheKeyFor(seed);
  let nextMessages = messages;
  if (ANTHROPIC_MODEL.test(String(model || '')) && Array.isArray(messages) && messages[0]?.role === 'system') {
    const system = messages[0];
    if (typeof system.content === 'string') {
      nextMessages = [{ ...system, content: [{ type: 'text', text: system.content, cache_control: { type: 'ephemeral' } }] }, ...messages.slice(1)];
    }
  }
  return { ...fields, messages: nextMessages };
}

// Usa o que o provedor devolveu em usage para dizer se o cache valeu a pena.
function cacheSummary(trace) {
  const input = Number(trace?.inputTokens) || 0;
  const cached = Number(trace?.cachedInputTokens) || 0;
  if (!input) return { cachedInputTokens: cached, cacheHitRate: 0, cacheUseful: false, note: 'O provedor não informou tokens de entrada.' };
  const rate = Math.round((cached / input) * 1000) / 10;
  return {
    cachedInputTokens: cached,
    cacheHitRate: rate,
    cacheUseful: cached > 0,
    note: cached > 0
      ? `${rate}% da entrada veio do cache de prefixo.`
      : 'Nenhum token veio do cache; desligue promptCache para este provedor/modelo.'
  };
}

module.exports = { cacheKeyFor, cacheSeed, cacheRequestFields, cacheSummary, KEY_PROVIDERS };

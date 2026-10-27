// Tokens de entrada que o provedor serviu do cache de prefixo (mais baratos e rápidos). Cada provedor usa um campo.
// DeepSeek: prompt_cache_hit_tokens. OpenAI/OpenRouter: prompt_tokens_details.cached_tokens. Anthropic: cache_read_input_tokens.
function cachedInputTokens(usage) {
  if (!usage || typeof usage !== 'object') return 0;
  const value = usage.prompt_cache_hit_tokens
    ?? usage.prompt_tokens_details?.cached_tokens
    ?? usage.cache_read_input_tokens
    ?? 0;
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

// Links de rastreamento (lojas, buscadores) passam de 300 caracteres e custam tokens a cada passo sem ajudar a escolher
// o controle, que é feito pelo índice. Acima do limite mantém origem + caminho e marca o corte.
const HREF_LIMIT = 160;
function compactHref(href) {
  if (typeof href !== 'string' || href.length <= HREF_LIMIT) return { href };
  try {
    const url = new URL(href);
    return { href: `${url.origin}${url.pathname}`.slice(0, HREF_LIMIT), hrefTruncated: true };
  } catch {
    return { href: href.slice(0, HREF_LIMIT), hrefTruncated: true };
  }
}

module.exports = { cachedInputTokens, compactHref };

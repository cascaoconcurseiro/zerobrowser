const PROVIDERS = Object.freeze({
  openrouter: {
    modelsUrl: 'https://openrouter.ai/api/v1/models?output_modalities=all',
    completionUrl: 'https://openrouter.ai/api/v1/chat/completions',
    label: 'OpenRouter'
  },
  deepseek: {
    modelsUrl: 'https://api.deepseek.com/models',
    completionUrl: 'https://api.deepseek.com/chat/completions',
    label: 'DeepSeek'
  },
  ollama: {
    modelsUrl: 'http://127.0.0.1:11434/api/tags',
    completionUrl: 'http://127.0.0.1:11434/api/chat',
    label: 'Ollama local',
    requiresApiKey: false,
    localOnly: true
  }
});

const TEST_ENV = Object.freeze({
  openrouter: { models: 'NAVEGANTE_TEST_OPENROUTER_MODELS_URL', completion: 'NAVEGANTE_TEST_OPENROUTER_URL' },
  deepseek: { models: 'NAVEGANTE_TEST_DEEPSEEK_MODELS_URL', completion: 'NAVEGANTE_TEST_DEEPSEEK_URL' }
});

function isLoopbackHost(hostname) {
  return ['127.0.0.1', '::1', '[::1]', 'localhost'].includes(String(hostname).toLowerCase());
}

function endpointFor(provider, kind, env = process.env) {
  const config = PROVIDERS[provider];
  if (!config) throw new Error('Provedor de IA inválido');
  const productionUrl = kind === 'models' ? config.modelsUrl : config.completionUrl;
  if (config.localOnly) return productionUrl;
  const overrideName = TEST_ENV[provider][kind];
  const testUrl = env[overrideName];
  if (!testUrl) return productionUrl;
  let parsed;
  try { parsed = new URL(testUrl); }
  catch { throw new Error(`${overrideName} deve ser uma URL válida de teste`); }
  if (parsed.protocol !== 'http:' || !isLoopbackHost(parsed.hostname)) {
    throw new Error(`${overrideName} só aceita HTTP em loopback`);
  }
  return parsed.href;
}

function normalizeModel(provider, model) {
  if (!model || typeof model.id !== 'string' || !model.id.trim()) return null;
  const parameters = Array.isArray(model.supported_parameters) ? model.supported_parameters : null;
  const supportsTools = parameters
    ? parameters.includes('tools')
    : null;
  return {
    id: model.id,
    name: model.name || model.id,
    description: model.description || '',
    contextLength: Number(model.context_length || model.context_window || 0) || null,
    inputModalities: model.architecture?.input_modalities || model.input_modalities || [],
    outputModalities: model.architecture?.output_modalities || model.output_modalities || [],
    supportsTools,
    promptPrice: model.pricing?.prompt || null,
    completionPrice: model.pricing?.completion || null,
    provider
  };
}

function providerNetworkError(error, provider, url) {
  const label = PROVIDERS[provider]?.label || 'provedor de IA';
  const host = (() => { try { return new URL(url).hostname; } catch { return 'endpoint configurado'; } })();
  if (provider === 'ollama') return new Error(`Não foi possível conectar ao Ollama local (${host}:11434). Verifique se o servidor local está ativo.`);
  const cause = error?.cause || error;
  const detail = String(cause?.message || error?.message || 'conexão recusada').slice(0, 180);
  const code = cause?.code || detail.match(/(?:SELF_SIGNED_CERT_IN_CHAIN|CERT_[A-Z_]+|ERR_CERT_[A-Z_]+)/)?.[0] || cause?.name || error?.name || 'NetworkError';
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
    return new Error(`Tempo limite ao conectar ao ${label} (${host}). Verifique a conexão e tente novamente.`);
  }
  if (/SELF_SIGNED_CERT|CERT_AUTHORITY_INVALID|ERR_CERT_[A-Z_]+/.test(String(code))) {
    return new Error(`A conexão TLS com ${label} (${host}) foi recusada [${code}]. O certificado apresentado pela rede ou proxy não é confiável pelo sistema. Instale/confirme a autoridade certificadora correta no Windows ou peça ajuda ao administrador da rede. A validação TLS continua ativa.`);
  }
  return new Error(`Falha de rede ao conectar ao ${label} (${host}) [${code}]: ${detail}. Verifique internet, DNS, firewall ou proxy e tente novamente.`);
}

async function listModels(provider, apiKey, fetchImpl = globalThis.fetch, env = process.env) {
  if (!PROVIDERS[provider]) throw new Error('Provedor de IA inválido');
  if (PROVIDERS[provider].requiresApiKey !== false && !apiKey) throw new Error(`Informe a chave de API do ${PROVIDERS[provider].label}`);
  const url = endpointFor(provider, 'models', env);
  let response;
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      headers: { ...(PROVIDERS[provider].requiresApiKey === false ? {} : { Authorization: `Bearer ${apiKey}` }), Accept: 'application/json' },
      signal: AbortSignal.timeout(15000)
    });
  } catch (error) {
    throw providerNetworkError(error, provider, url);
  }
  const data = await response.json();
  if (!response.ok) throw new Error(provider === 'ollama'
    ? `Ollama local retornou HTTP ${response.status}`
    : data.error?.message || data.message || `${PROVIDERS[provider].label} retornou HTTP ${response.status}`);
  const models = data.data;
  const localModels = provider === 'ollama' ? data.models : null;
  if (provider === 'ollama' ? !Array.isArray(localModels) : !Array.isArray(models)) throw new Error(`Resposta de modelos inválida do ${PROVIDERS[provider].label}`);
  const normalized = provider === 'ollama'
    ? localModels.filter((model) => typeof model?.name === 'string' && model.name.trim()).map((model) => ({ id: model.name, name: model.name, description: 'Modelo instalado localmente', contextLength: null, inputModalities: [], outputModalities: [], supportsTools: null, promptPrice: null, completionPrice: null, provider }))
    : models.map((model) => normalizeModel(provider, model)).filter(Boolean);
  return normalized.sort((a, b) => a.name.localeCompare(b.name));
}

module.exports = { PROVIDERS, endpointFor, normalizeModel, providerNetworkError, listModels };

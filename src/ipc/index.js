const { ipcMain, BrowserWindow } = require('electron');
const store = require('../store');
const { listModels, PROVIDERS } = require('../automation/model-catalog');
const { withTrustedMainUi } = require('./trusted-ui');
let automationService = null;
let providerFetch = null;

function maskApiKey(apiKey) {
  if (!apiKey) return '';
  return `••••••••${String(apiKey).slice(-4)}`;
}

function isSecretStoreKey(key) {
  return typeof key === 'string' && /apikey|secret|password/i.test(key);
}

async function getProviderKey(provider) {
  if (provider === 'ollama') return '';
  const keyName = provider === 'deepseek' ? 'automation.deepseekApiKey' : 'automation.openrouterApiKey';
  return await store.get(keyName) || (provider === 'openrouter' ? await store.get('automation.apiKey') : '');
}

async function getAgentConfig() {
  const provider = await store.get('automation.provider') || 'openrouter';
  const apiKey = await getProviderKey(provider);
  const model = await store.get(`automation.model.${provider}`) || (provider === 'openrouter' ? await store.get('automation.model') : '') || '';
  return { provider, apiKey, model };
}

async function saveProviderKey(provider, apiKey, storage = store) {
  if (!PROVIDERS[provider]) throw new Error('Provedor de IA inválido');
  if (PROVIDERS[provider].requiresApiKey === false) throw new Error('Ollama local não usa chave de API');
  if (typeof apiKey !== 'string' || apiKey.length > 4096 || !apiKey.trim()) throw new Error('Informe uma chave de API válida');
  await storage.set(provider === 'deepseek' ? 'automation.deepseekApiKey' : 'automation.openrouterApiKey', apiKey.trim());
  if (provider === 'openrouter') await storage.set('automation.apiKey', apiKey.trim());
  return { provider, hasApiKey: true, keyHint: maskApiKey(apiKey.trim()) };
}

function setAutomationService(service) {
  automationService = service;
}

function setProviderFetch(fetchImpl) {
  providerFetch = fetchImpl;
}

function setupIpc(assertTrustedUi) {
  if (typeof assertTrustedUi !== 'function') throw new TypeError('Validador da interface principal obrigatório para registrar IPCs');
  const registerUiIpc = (channel, handler) => {
    ipcMain.handle(channel, withTrustedMainUi(handler, assertTrustedUi));
  };
  registerUiIpc('store:get', async (e, key) => {
    if (isSecretStoreKey(key)) throw new Error('Credenciais só podem ser acessadas pelo processo principal');
    return await store.get(key);
  });
  registerUiIpc('store:set', async (e, key, value) => {
    if (isSecretStoreKey(key)) throw new Error('Credenciais só podem ser alteradas pelo painel de IA');
    return await store.set(key, value);
  });
  registerUiIpc('store:delete', async (e, key) => await store.remove(key));
  registerUiIpc('store:getAll', async () => await store.getAll());

  registerUiIpc('ai:get-config', async (_e, requestedProvider) => {
    const provider = requestedProvider || await store.get('automation.provider') || 'openrouter';
    if (!PROVIDERS[provider]) throw new Error('Provedor de IA inválido');
    const providerModel = await store.get(`automation.model.${provider}`);
    const model = providerModel || (provider === 'openrouter' ? await store.get('automation.model') : '') || '';
    const apiKey = await getProviderKey(provider);
    return { provider, model, hasApiKey: PROVIDERS[provider].requiresApiKey === false || Boolean(apiKey), keyHint: maskApiKey(apiKey) };
  });

  registerUiIpc('ai:save-config', async (_e, input = {}) => {
    const { provider, model, apiKey } = input;
    if (!PROVIDERS[provider]) throw new Error('Provedor de IA inválido');
    if (typeof model !== 'string' || !model.trim()) throw new Error('Selecione um modelo');
    if (PROVIDERS[provider].requiresApiKey === false && apiKey?.trim()) throw new Error('Ollama local não aceita chave de API');
    if (apiKey !== undefined && (typeof apiKey !== 'string' || apiKey.length > 4096)) throw new Error('Chave de API inválida');
    await store.set('automation.provider', provider);
    await store.set(`automation.model.${provider}`, model.trim());
    if (provider === 'openrouter') await store.set('automation.model', model.trim());
    if (apiKey?.trim()) {
      await store.set(provider === 'deepseek' ? 'automation.deepseekApiKey' : 'automation.openrouterApiKey', apiKey.trim());
      if (provider === 'openrouter') await store.set('automation.apiKey', apiKey.trim());
    }
    const savedKey = apiKey?.trim() || await getProviderKey(provider);
    return { provider, model: model.trim(), hasApiKey: PROVIDERS[provider].requiresApiKey === false || Boolean(savedKey), keyHint: maskApiKey(savedKey) };
  });

  registerUiIpc('ai:save-key', async (_e, { provider, apiKey } = {}) => saveProviderKey(provider, apiKey));

  registerUiIpc('ai:reveal-key', async (_e, provider) => {
    if (!PROVIDERS[provider]) throw new Error('Provedor de IA inválido');
    if (PROVIDERS[provider].requiresApiKey === false) throw new Error('Ollama local não usa chave de API');
    const apiKey = await getProviderKey(provider);
    if (!apiKey) throw new Error(`Nenhuma chave salva para ${PROVIDERS[provider].label}`);
    return apiKey;
  });

  registerUiIpc('ai:list-models', async (_e, { provider, apiKey } = {}) => {
    if (!PROVIDERS[provider]) throw new Error('Provedor de IA inválido');
    return listModels(provider, String(apiKey || '').trim() || await getProviderKey(provider), providerFetch || globalThis.fetch);
  });
  registerUiIpc('window:minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize());
  registerUiIpc('window:toggle-maximize', (e) => {
    const window = BrowserWindow.fromWebContents(e.sender);
    if (window?.isMaximized()) window.unmaximize();
    else window?.maximize();
  });

  registerUiIpc('automation:execute', async (e, action) => {
    if (!automationService) return { success: false, error: 'Automation service not running' };
    return await automationService.executeAction(action);
  });

  registerUiIpc('automation:run-agent', async (_e, { tabId, prompt, testOnly, requireToolCall, resumeId }) => {
    if (!automationService) return { success: false, error: 'Serviço de automação indisponível' };
    const { provider, apiKey, model } = await getAgentConfig();
    if (!model) return { success: false, error: 'Sincronize os modelos e escolha um modelo antes de conectar' };
    // Recursos do agente vêm das configurações; sem isso eles existiam no serviço e nunca chegavam ao painel.
    const recipes = (await store.get('automation.recipes')) !== false;
    const transforms = (await store.get('automation.transforms')) !== false;
    const promptCache = (await store.get('automation.promptCache')) === true;
    const configuredSteps = Number(await store.get('automation.maxSteps'));
    const maxSteps = [20, 40, 60].includes(configuredSteps) ? configuredSteps : 40;
    return automationService.runAgent(tabId, prompt, apiKey, model, !testOnly, provider, Boolean(requireToolCall), {
      // Eventos de progresso para o painel; falha de envio nunca derruba a tarefa.
      onEvent: (event) => { try { _e.sender.send('automation:run-event', event); } catch {} },
      resumable: !testOnly,
      resumeId: testOnly ? null : resumeId,
      // A pré-inspeção entrega a primeira leitura pronta e economiza uma rodada do modelo.
      // run_steps executa até 12 passos conhecidos numa única rodada (cada passo ainda pede aprovação quando precisa).
      ...(testOnly ? {} : { recipes, transforms, promptCache, maxSteps, preInspect: true, actionScripts: true })
    });
  });

  registerUiIpc('automation:recipes', async (_e, { origin } = {}) => {
    if (!automationService || !origin) return [];
    try { return await automationService.callTool('recipe_list', { origin }); } catch { return []; }
  });

  registerUiIpc('automation:recipe-run', async (_e, { origin, name } = {}) => {
    if (!automationService) return { success: false, error: 'Serviço de automação indisponível' };
    try { return await automationService.callTool('recipe_run', { origin, name }); } catch (error) { return { success: false, error: error.message }; }
  });

  registerUiIpc('automation:job-drop', async (_e, { id } = {}) => {
    if (!automationService) return false;
    return await automationService.dropJob(id);
  });

  registerUiIpc('automation:memory-save', async (_e, { origin, text, kind, replaceId } = {}) => {
    if (!automationService) return { success: false, error: 'Serviço de automação indisponível' };
    return await automationService.saveMemory({ origin, text, kind, replaceId });
  });

  registerUiIpc('automation:modules', async (_e, { origin } = {}) => {
    if (!automationService?.moduleStore) return { success: false, error: 'Módulos indisponíveis' };
    try {
      const list = await automationService.moduleStore.list(origin || null);
      return { success: true, modules: list };
    } catch (error) { return { success: false, error: error.message }; }
  });

  registerUiIpc('automation:module-run', async (_e, { origin, name, input } = {}) => {
    if (!automationService) return { success: false, error: 'Serviço de automação indisponível' };
    try { return await automationService.callTool('module_run', { origin, name, input }); } catch (error) { return { success: false, error: error.message }; }
  });

  registerUiIpc('automation:memory', async (_e, { action = 'list', id } = {}) => {
    if (!automationService) return action === 'list' ? [] : false;
    if (action === 'forget') return await automationService.forgetMemory(id);
    return await automationService.listMemories();
  });

  // Tarefas pausadas que sobreviveram ao reinício (TTL 20 min), para oferecer "Continuar".
  registerUiIpc('automation:jobs', async () => {
    if (!automationService) return [];
    return await automationService.listJobs();
  });

  registerUiIpc('automation:cancel-agent', async (_e, tabId) => {
    if (!automationService) return { success: false, error: 'Serviço de automação indisponível' };
    return automationService.cancelAgentRun(tabId);
  });

  registerUiIpc('automation:get-state', async (e, tabId) => {
    if (!automationService) return { success: false, error: 'Automation service not running' };
    return await automationService.getTabState(tabId);
  });

  registerUiIpc('automation:cdp-send', async (e, tabId, method, params) => {
    if (!automationService) return { success: false, error: 'Automation service not running' };
    return await automationService.sendCdpCommand(tabId, method, params);
  });

}

module.exports = { setupIpc, setAutomationService, setProviderFetch, saveProviderKey, maskApiKey, getAgentConfig };

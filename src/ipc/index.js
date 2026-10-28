const { ipcMain, BrowserWindow } = require('electron');
const store = require('../store');
const { listModels, PROVIDERS } = require('../automation/model-catalog');
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

function setupIpc() {
  ipcMain.handle('store:get', async (e, key) => {
    if (isSecretStoreKey(key)) throw new Error('Credenciais só podem ser acessadas pelo processo principal');
    return await store.get(key);
  });
  ipcMain.handle('store:set', async (e, key, value) => {
    if (isSecretStoreKey(key)) throw new Error('Credenciais só podem ser alteradas pelo painel de IA');
    return await store.set(key, value);
  });
  ipcMain.handle('store:delete', async (e, key) => await store.remove(key));
  ipcMain.handle('store:getAll', async () => await store.getAll());

  ipcMain.handle('ai:get-config', async (_e, requestedProvider) => {
    const provider = requestedProvider || await store.get('automation.provider') || 'openrouter';
    if (!PROVIDERS[provider]) throw new Error('Provedor de IA inválido');
    const providerModel = await store.get(`automation.model.${provider}`);
    const model = providerModel || (provider === 'openrouter' ? await store.get('automation.model') : '') || '';
    const apiKey = await getProviderKey(provider);
    return { provider, model, hasApiKey: Boolean(apiKey), keyHint: maskApiKey(apiKey) };
  });

  ipcMain.handle('ai:save-config', async (_e, input = {}) => {
    const { provider, model, apiKey } = input;
    if (!PROVIDERS[provider]) throw new Error('Provedor de IA inválido');
    if (typeof model !== 'string' || !model.trim()) throw new Error('Selecione um modelo');
    if (apiKey !== undefined && (typeof apiKey !== 'string' || apiKey.length > 4096)) throw new Error('Chave de API inválida');
    await store.set('automation.provider', provider);
    await store.set(`automation.model.${provider}`, model.trim());
    if (provider === 'openrouter') await store.set('automation.model', model.trim());
    if (apiKey?.trim()) {
      await store.set(provider === 'deepseek' ? 'automation.deepseekApiKey' : 'automation.openrouterApiKey', apiKey.trim());
      if (provider === 'openrouter') await store.set('automation.apiKey', apiKey.trim());
    }
    const savedKey = apiKey?.trim() || await getProviderKey(provider);
    return { provider, model: model.trim(), hasApiKey: Boolean(savedKey), keyHint: maskApiKey(savedKey) };
  });

  ipcMain.handle('ai:save-key', async (_e, { provider, apiKey } = {}) => saveProviderKey(provider, apiKey));

  ipcMain.handle('ai:reveal-key', async (_e, provider) => {
    if (!PROVIDERS[provider]) throw new Error('Provedor de IA inválido');
    const apiKey = await getProviderKey(provider);
    if (!apiKey) throw new Error(`Nenhuma chave salva para ${PROVIDERS[provider].label}`);
    return apiKey;
  });

  ipcMain.handle('ai:list-models', async (_e, { provider, apiKey } = {}) => {
    if (!PROVIDERS[provider]) throw new Error('Provedor de IA inválido');
    return listModels(provider, String(apiKey || '').trim() || await getProviderKey(provider), providerFetch || globalThis.fetch);
  });
  ipcMain.handle('window:minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize());
  ipcMain.handle('window:toggle-maximize', (e) => {
    const window = BrowserWindow.fromWebContents(e.sender);
    if (window?.isMaximized()) window.unmaximize();
    else window?.maximize();
  });

  ipcMain.handle('automation:execute', async (e, action) => {
    if (!automationService) return { success: false, error: 'Automation service not running' };
    return await automationService.executeAction(action);
  });

  ipcMain.handle('automation:run-agent', async (_e, { tabId, prompt, testOnly, requireToolCall, resumeId }) => {
    if (!automationService) return { success: false, error: 'Serviço de automação indisponível' };
    const { provider, apiKey, model } = await getAgentConfig();
    if (!model) return { success: false, error: 'Sincronize os modelos e escolha um modelo antes de conectar' };
    return automationService.runAgent(tabId, prompt, apiKey, model, !testOnly, provider, Boolean(requireToolCall), { resumable: !testOnly, resumeId: testOnly ? null : resumeId });
  });

  ipcMain.handle('automation:memory', async (_e, { action = 'list', id } = {}) => {
    if (!automationService) return action === 'list' ? [] : false;
    if (action === 'forget') return await automationService.forgetMemory(id);
    return await automationService.listMemories();
  });

  // Tarefas pausadas que sobreviveram ao reinício (TTL 20 min), para oferecer "Continuar".
  ipcMain.handle('automation:jobs', async () => {
    if (!automationService) return [];
    return await automationService.listJobs();
  });

  ipcMain.handle('automation:cancel-agent', async (_e, tabId) => {
    if (!automationService) return { success: false, error: 'Serviço de automação indisponível' };
    return automationService.cancelAgentRun(tabId);
  });

  ipcMain.handle('automation:get-state', async (e, tabId) => {
    if (!automationService) return { success: false, error: 'Automation service not running' };
    return await automationService.getTabState(tabId);
  });

  ipcMain.handle('automation:cdp-send', async (e, tabId, method, params) => {
    if (!automationService) return { success: false, error: 'Automation service not running' };
    return await automationService.sendCdpCommand(tabId, method, params);
  });

  ipcMain.handle('automation:list-tools', async () => {
    if (!automationService) return { success: false, error: 'Automation service not running' };
    return await automationService.listTools();
  });
}

module.exports = { setupIpc, setAutomationService, setProviderFetch, saveProviderKey, maskApiKey, getAgentConfig };

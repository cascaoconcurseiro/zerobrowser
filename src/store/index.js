const { app, safeStorage } = require('electron');
const { createCipheriv, createDecipheriv, randomBytes } = require('crypto');

let store = null;
let encryptionKey = null;
let Store = null;
let initPromise = null;

function isSecretKey(key) {
  return /apikey|secret|password/i.test(String(key));
}

async function loadStoreClass() {
  if (Store) return Store;
  const mod = await import('electron-store');
  Store = mod.default;
  return Store;
}

// Versões antigas gravavam { automation: { provider } } em vez de 'automation.provider'. O valor aninhado é o que o
// usuário salvou, então ele vence o padrão plano.
function migrateNestedKeys(target) {
  const flat = {};
  const walk = (obj, prefix) => {
    for (const [key, value] of Object.entries(obj)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) walk(value, `${prefix}${key}.`);
      else flat[`${prefix}${key}`] = value;
    }
  };
  const nested = Object.entries(target.store).filter(([, value]) => value && typeof value === 'object' && !Array.isArray(value));
  if (!nested.length) return;
  for (const [key, value] of nested) {
    walk(value, `${key}.`);
    target.delete(key);
  }
  for (const [key, value] of Object.entries(flat)) target.set(key, value);
}

async function initStore() {
  if (store) return store;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    await loadStoreClass();
    store = new Store({
      name: 'navegante-config',
      // As chaves são planas ('automation.provider'); sem isto o set gravava aninhado e o get lia o padrão.
      accessPropertiesByDotNotation: false,
      defaults: {
        'automation.enabled': true,
        'automation.approvalMode': 'low-risk',
        'automation.recipes': true,
        'automation.transforms': true,
        'automation.promptCache': false,
        'automation.provider': 'openrouter',
        'automation.model': 'openai/gpt-4o-mini',
        'automation.apiKey': '',
        'automation.openrouterApiKey': '',
        'automation.deepseekApiKey': '',
        'browser.defaultHomepage': 'https://www.google.com',
        'browser.showFullUrl': false,
        'browser.showBookmarksBar': true,
        'browser.restoreSession': true,
        'session.lastTabs': [],
        'downloads.path': app.getPath('downloads'),
        'downloads.prompt': true,
        'privacy.clearOnExit': false,
        'privacy.blockThirdPartyCookies': true,
        'privacy.doNotTrack': true,
        'developer.cdpEnabled': false,
        'developer.webMcpEnabled': false,
        'theme': 'system'
      }
    });
    migrateNestedKeys(store);
    return store;
  })();

  return initPromise;
}

async function getEncryptionKey() {
  if (encryptionKey) return encryptionKey;
  await initStore();
  const stored = store.get('encryption_key');
  if (stored) {
    encryptionKey = safeStorage.decryptString(Buffer.from(stored, 'base64'));
    return encryptionKey;
  }
  encryptionKey = randomBytes(32).toString('base64');
  store.set('encryption_key', safeStorage.encryptString(encryptionKey).toString('base64'));
  return encryptionKey;
}

function encrypt(value) {
  const key = Buffer.from(encryptionKey, 'base64');
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

function decrypt(encryptedValue) {
  try {
    const key = Buffer.from(encryptionKey, 'base64');
    const data = Buffer.from(encryptedValue, 'base64');
    const iv = data.slice(0, 16);
    const authTag = data.slice(16, 32);
    const encrypted = data.slice(32);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8'));
  } catch {
    return null;
  }
}

function setupStore() {
  return initStore();
}

function getStore() {
  if (!store) throw new Error('Store not initialized. Call setupStore() first.');
  return store;
}

async function get(key) {
  await initStore();
  const value = store.get(key);
  if (isSecretKey(key)) {
    await getEncryptionKey();
    return decrypt(value);
  }
  return value;
}

async function set(key, value) {
  await initStore();
  if (isSecretKey(key)) {
    await getEncryptionKey();
    store.set(key, encrypt(value));
  } else {
    store.set(key, value);
  }
}

async function remove(key) {
  await initStore();
  store.delete(key);
}

async function getAll({ includeSecrets = false } = {}) {
  await initStore();
  const all = store.store;
  const result = {};
  for (const [key, value] of Object.entries(all)) {
    if (isSecretKey(key)) {
      if (!includeSecrets) continue;
      await getEncryptionKey();
      result[key] = decrypt(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

async function reset() {
  await initStore();
  store.clear();
}

module.exports = { migrateNestedKeys, setupStore, getStore, get, set, remove, getAll, reset, encrypt, decrypt, isSecretKey };

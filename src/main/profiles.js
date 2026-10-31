const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

// Perfis extras ficam em <root>/<id>, com a lista em <root>/perfis.json. O perfil "principal" é a pasta de dados padrão
// do app e nunca entra na lista (não pode ser apagado por aqui). Cada perfil roda como um processo próprio do app.
const MAIN_PROFILE = { id: 'principal', name: 'Principal' };
const MAX_NAME = 40;
const PROFILE_LOCK_TIMEOUT_MS = 30000;
const PROFILE_LOCK_POLL_MS = 20;
const lockWaitCell = new Int32Array(new SharedArrayBuffer(4));

function resolveProfilesRoot({ appData, userData, testRoot, isPackaged, localAppData }) {
  if (!testRoot) return path.join(appData, 'zero-browser-perfis');
  if (!isPackaged) return path.resolve(testRoot);
  if (!localAppData) return path.join(appData, 'zero-browser-perfis');

  const qaRoot = path.resolve(localAppData, 'ZeroBrowserQA');
  const isInsideQaRoot = (candidate) => {
    const relative = path.relative(qaRoot, path.resolve(candidate));
    return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
  };
  if (isInsideQaRoot(userData) && isInsideQaRoot(testRoot)) return path.resolve(testRoot);
  return path.join(appData, 'zero-browser-perfis');
}

function listFile(root) {
  return path.join(root, 'perfis.json');
}

function listProfiles(root) {
  try {
    const parsed = JSON.parse(fs.readFileSync(listFile(root), 'utf8'));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && /^[a-z0-9-]{1,40}$/.test(String(item.id)) && typeof item.name === 'string')
      .map((item) => ({
        id: item.id,
        name: item.name.slice(0, MAX_NAME),
        ...(item.type === 'bot' ? {
          type: 'bot',
          initialApprovalMode: 'always-ask',
          ...(item.archived === true ? { archived: true } : {})
        } : {})
      }));
  } catch {
    return [];
  }
}

function saveProfiles(root, profiles) {
  fs.mkdirSync(root, { recursive: true });
  const destination = listFile(root);
  const temp = `${destination}.${process.pid}.${randomUUID()}.tmp`;
  let fd = null;
  try {
    fd = fs.openSync(temp, 'wx');
    fs.writeFileSync(fd, JSON.stringify(profiles, null, 2));
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = null;
    fs.renameSync(temp, destination);
  } finally {
    if (fd !== null) fs.closeSync(fd);
    try { fs.unlinkSync(temp); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}

function processIsAlive(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code !== 'ESRCH';
  }
}

function reclaimDeadProfileLock(lockDir) {
  const ownerPath = path.join(lockDir, 'owner.json');
  let owner;
  try {
    owner = JSON.parse(fs.readFileSync(ownerPath, 'utf8'));
  } catch {
    return false;
  }
  if (processIsAlive(owner.pid)) return false;

  // Removing the owner marker is the exclusive claim on a dead lock. Only the process
  // that removes it may remove the directory, so concurrent recovery cannot clear a new lock.
  try {
    fs.unlinkSync(ownerPath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return false;
  }
  try { fs.rmdirSync(lockDir); } catch (error) { if (error.code !== 'ENOENT' && error.code !== 'ENOTEMPTY') throw error; }
  return true;
}

function withProfilesLock(root, callback) {
  fs.mkdirSync(root, { recursive: true });
  const lockDir = `${listFile(root)}.lock`;
  const ownerPath = path.join(lockDir, 'owner.json');
  const token = randomUUID();
  const deadline = Date.now() + PROFILE_LOCK_TIMEOUT_MS;

  while (true) {
    try {
      fs.mkdirSync(lockDir);
      fs.writeFileSync(ownerPath, JSON.stringify({ pid: process.pid, token, createdAt: Date.now() }), { flag: 'wx' });
      break;
    } catch (error) {
      if (error.code !== 'EEXIST') {
        try { fs.rmdirSync(lockDir); } catch {}
        throw error;
      }
      if (reclaimDeadProfileLock(lockDir)) continue;
      if (Date.now() >= deadline) throw new Error('Tempo esgotado aguardando outro processo atualizar a lista de perfis.');
      Atomics.wait(lockWaitCell, 0, 0, PROFILE_LOCK_POLL_MS);
    }
  }

  try {
    return callback();
  } finally {
    try {
      const owner = JSON.parse(fs.readFileSync(ownerPath, 'utf8'));
      if (owner.token === token) {
        fs.unlinkSync(ownerPath);
        fs.rmdirSync(lockDir);
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}

function updateProfiles(root, mutate) {
  if (typeof mutate !== 'function') throw new TypeError('A atualização da lista de perfis precisa ser uma função.');
  return withProfilesLock(root, () => {
    const profiles = listProfiles(root);
    const result = mutate(profiles);
    saveProfiles(root, profiles);
    return result;
  });
}

function profileDir(root, id) {
  if (!/^[a-z0-9-]{1,40}$/.test(String(id))) throw new Error('Identificador de perfil inválido');
  return path.join(root, id);
}

// Cria um perfil. Sem nome, usa "Perfil N" com o próximo número livre.
function createProfile(root, name) {
  return updateProfiles(root, (profiles) => {
    let cleanName = String(name || '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
    if (!cleanName) {
      let n = profiles.length + 2;
      while (profiles.some((p) => p.name === `Perfil ${n}`)) n++;
      cleanName = `Perfil ${n}`;
    }
    if (profiles.some((p) => p.name.toLowerCase() === cleanName.toLowerCase()) || cleanName.toLowerCase() === MAIN_PROFILE.name.toLowerCase()) {
      throw new Error('Já existe um perfil com esse nome');
    }
    const base = cleanName.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'perfil';
    let id = base;
    for (let i = 2; profiles.some((p) => p.id === id) || fs.existsSync(path.join(root, id)); i++) id = `${base}-${i}`;
    const profile = { id, name: cleanName };
    fs.mkdirSync(profileDir(root, id), { recursive: true });
    profiles.push(profile);
    return profile;
  });
}

// Bots usam o mesmo isolamento por processo/perfil, com aprovação inicial conservadora.
// Credenciais de sites não fazem parte dos metadados do bot; o login acontece manualmente na janela aberta.
function createBot(root, name) {
  return updateProfiles(root, (profiles) => {
    let cleanName = String(name || '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
    if (!cleanName) {
      let n = 1;
      while (profiles.some((profile) => profile.name.toLowerCase() === `bot ${n}`)) n++;
      cleanName = `Bot ${n}`;
    }
    if (profiles.some((profile) => profile.name.toLowerCase() === cleanName.toLowerCase()) || cleanName.toLowerCase() === MAIN_PROFILE.name.toLowerCase()) {
      throw new Error('Já existe um perfil ou bot com esse nome');
    }
    const base = cleanName.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'bot';
    let id = base;
    for (let i = 2; profiles.some((profile) => profile.id === id) || fs.existsSync(path.join(root, id)); i++) id = `${base}-${i}`;
    const bot = { id, name: cleanName, type: 'bot', initialApprovalMode: 'always-ask' };
    fs.mkdirSync(profileDir(root, id), { recursive: true });
    profiles.push(bot);
    return bot;
  });
}

// Qual perfil está em uso, pela pasta de dados atual.
function currentProfile(root, userDataDir) {
  const resolved = path.resolve(userDataDir);
  for (const profile of listProfiles(root)) {
    if (path.resolve(profileDir(root, profile.id)) === resolved) return profile;
  }
  return MAIN_PROFILE;
}

function setBotArchived(root, id, archived) {
  if (typeof id !== 'string' || !/^[a-z0-9-]{1,40}$/.test(id)) throw new Error('Identificador de Bot inválido');
  return updateProfiles(root, (profiles) => {
    const index = profiles.findIndex((profile) => profile.id === id);
    if (index === -1 || profiles[index].type !== 'bot') throw new Error('Bot não encontrado');
    const bot = { ...profiles[index] };
    if (archived) bot.archived = true;
    else delete bot.archived;
    profiles[index] = bot;
    return bot;
  });
}

function archiveBot(root, id) {
  return setBotArchived(root, id, true);
}

function restoreBot(root, id) {
  return setBotArchived(root, id, false);
}

function getLaunchableProfile(root, profileId) {
  if (profileId === MAIN_PROFILE.id) return MAIN_PROFILE;
  const profile = listProfiles(root).find((entry) => entry.id === profileId);
  if (!profile) throw new Error('Perfil não encontrado');
  if (profile.type === 'bot' && profile.archived === true) throw new Error('Bot arquivado não pode ser aberto');
  return profile;
}

// Apaga um perfil e os dados dele. Nunca apaga o que está em uso.
function deleteProfile(root, id, userDataDir) {
  return updateProfiles(root, (profiles) => {
    const index = profiles.findIndex((profile) => profile.id === id);
    if (index === -1) throw new Error('Perfil não encontrado');
    const profile = profiles[index];
    const dir = path.resolve(profileDir(root, id));
    if (path.resolve(userDataDir) === dir) throw new Error('Não é possível apagar o perfil em uso');
    if (path.dirname(dir) !== path.resolve(root)) throw new Error('Pasta de perfil fora do esperado');
    fs.rmSync(dir, { recursive: true, force: true });
    profiles.splice(index, 1);
    return profile;
  });
}

// Modelo do menu de perfis. Puro: as ações vêm de fora.
function buildProfileMenuTemplate({ current, profiles, defaultDirAvailable = true, actions }) {
  const others = [
    ...(current.id !== MAIN_PROFILE.id && defaultDirAvailable ? [MAIN_PROFILE] : []),
    ...profiles.filter((p) => p.id !== current.id && !(p.type === 'bot' && p.archived === true))
  ];
  const deletable = profiles.filter((p) => p.id !== current.id && p.type !== 'bot');
  return [
    { label: `${current.type === 'bot' ? 'Bot' : 'Perfil'} atual: ${current.name}`, enabled: false },
    { type: 'separator' },
    ...others.map((p) => ({ label: p.type === 'bot' ? `Abrir bot: ${p.name}` : `Abrir ${p.name}`, click: () => actions.open(p) })),
    ...(others.length ? [{ type: 'separator' }] : []),
    { label: 'Novo perfil', click: () => actions.create() },
    { label: 'Novo bot', click: () => actions.createBot() },
    ...(deletable.length ? [{ label: 'Excluir perfil', submenu: deletable.map((p) => ({ label: p.name, click: () => actions.remove(p) })) }] : [])
  ];
}

module.exports = { MAIN_PROFILE, listProfiles, updateProfiles, createProfile, createBot, currentProfile, archiveBot, restoreBot, getLaunchableProfile, deleteProfile, profileDir, buildProfileMenuTemplate, resolveProfilesRoot };

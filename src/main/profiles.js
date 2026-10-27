const fs = require('fs');
const path = require('path');

// Perfis extras ficam em <root>/<id>, com a lista em <root>/perfis.json. O perfil "principal" é a pasta de dados padrão
// do app e nunca entra na lista (não pode ser apagado por aqui). Cada perfil roda como um processo próprio do app.
const MAIN_PROFILE = { id: 'principal', name: 'Principal' };
const MAX_NAME = 40;

function listFile(root) {
  return path.join(root, 'perfis.json');
}

function listProfiles(root) {
  try {
    const parsed = JSON.parse(fs.readFileSync(listFile(root), 'utf8'));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && /^[a-z0-9-]{1,40}$/.test(String(item.id)) && typeof item.name === 'string')
      .map((item) => ({ id: item.id, name: item.name.slice(0, MAX_NAME) }));
  } catch {
    return [];
  }
}

function saveProfiles(root, profiles) {
  fs.mkdirSync(root, { recursive: true });
  const temp = `${listFile(root)}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(profiles, null, 2));
  fs.renameSync(temp, listFile(root));
}

function profileDir(root, id) {
  if (!/^[a-z0-9-]{1,40}$/.test(String(id))) throw new Error('Identificador de perfil inválido');
  return path.join(root, id);
}

// Cria um perfil. Sem nome, usa "Perfil N" com o próximo número livre.
function createProfile(root, name) {
  const profiles = listProfiles(root);
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
  saveProfiles(root, [...profiles, profile]);
  return profile;
}

// Qual perfil está em uso, pela pasta de dados atual.
function currentProfile(root, userDataDir) {
  const resolved = path.resolve(userDataDir);
  for (const profile of listProfiles(root)) {
    if (path.resolve(profileDir(root, profile.id)) === resolved) return profile;
  }
  return MAIN_PROFILE;
}

// Apaga um perfil e os dados dele. Nunca apaga o que está em uso.
function deleteProfile(root, id, userDataDir) {
  const profiles = listProfiles(root);
  const profile = profiles.find((p) => p.id === id);
  if (!profile) throw new Error('Perfil não encontrado');
  const dir = path.resolve(profileDir(root, id));
  if (path.resolve(userDataDir) === dir) throw new Error('Não é possível apagar o perfil em uso');
  if (path.dirname(dir) !== path.resolve(root)) throw new Error('Pasta de perfil fora do esperado');
  fs.rmSync(dir, { recursive: true, force: true });
  saveProfiles(root, profiles.filter((p) => p.id !== id));
  return profile;
}

// Modelo do menu de perfis. Puro: as ações vêm de fora.
function buildProfileMenuTemplate({ current, profiles, defaultDirAvailable = true, actions }) {
  const others = [
    ...(current.id !== MAIN_PROFILE.id && defaultDirAvailable ? [MAIN_PROFILE] : []),
    ...profiles.filter((p) => p.id !== current.id)
  ];
  const deletable = profiles.filter((p) => p.id !== current.id);
  return [
    { label: `Perfil atual: ${current.name}`, enabled: false },
    { type: 'separator' },
    ...others.map((p) => ({ label: `Abrir ${p.name}`, click: () => actions.open(p) })),
    ...(others.length ? [{ type: 'separator' }] : []),
    { label: 'Novo perfil', click: () => actions.create() },
    ...(deletable.length ? [{ label: 'Excluir perfil', submenu: deletable.map((p) => ({ label: p.name, click: () => actions.remove(p) })) }] : [])
  ];
}

module.exports = { MAIN_PROFILE, listProfiles, createProfile, currentProfile, deleteProfile, profileDir, buildProfileMenuTemplate };

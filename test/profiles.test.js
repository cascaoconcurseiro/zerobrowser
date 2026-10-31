const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  MAIN_PROFILE,
  buildProfileMenuTemplate,
  createBot,
  createProfile,
  currentProfile,
  listProfiles,
  profileDir,
  resolveProfilesRoot
} = require('../src/main/profiles');

function withTempRoot(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zero-profiles-'));
  try { return run(root); }
  finally { fs.rmSync(root, { recursive: true, force: true }); }
}

test('packaged QA data can use an isolated profile registry only within the QA folder', () => {
  const localAppData = path.join(path.parse(process.cwd()).root, 'Users', 'Test', 'AppData', 'Local');
  const appData = path.join(localAppData, '..', 'Roaming');
  const qaRoot = path.join(localAppData, 'ZeroBrowserQA');
  const userData = path.join(qaRoot, '0.1.47-dev');
  const testRoot = path.join(qaRoot, 'profiles');

  assert.equal(resolveProfilesRoot({ appData, userData, testRoot, isPackaged: false, localAppData }), path.resolve(testRoot));
  assert.equal(resolveProfilesRoot({ appData, userData, testRoot, isPackaged: true, localAppData }), path.resolve(testRoot));
  assert.equal(resolveProfilesRoot({ appData, userData: path.join(localAppData, 'navegante'), testRoot, isPackaged: true, localAppData }), path.join(appData, 'zero-browser-perfis'));
  assert.equal(resolveProfilesRoot({ appData, userData, testRoot: path.join(localAppData, 'outside'), isPackaged: true, localAppData }), path.join(appData, 'zero-browser-perfis'));
  assert.equal(resolveProfilesRoot({ appData, userData, testRoot, isPackaged: true }), path.join(appData, 'zero-browser-perfis'));
});

test('bots persist isolated profile metadata with always-ask and no credential fields', () => withTempRoot((root) => {
  fs.mkdirSync(path.join(root, 'existing-profile'));
  fs.writeFileSync(path.join(root, 'perfis.json'), JSON.stringify([{ id: 'existing-profile', name: 'Perfil existente' }]));

  const bot = createBot(root, 'Pesquisa');
  const rawProfiles = JSON.parse(fs.readFileSync(path.join(root, 'perfis.json'), 'utf8'));

  assert.equal(bot.type, 'bot');
  assert.equal(bot.initialApprovalMode, 'always-ask');
  assert.deepEqual(Object.keys(bot).sort(), ['id', 'initialApprovalMode', 'name', 'type']);
  assert.equal(fs.existsSync(profileDir(root, bot.id)), true);
  assert.deepEqual(rawProfiles[0], { id: 'existing-profile', name: 'Perfil existente' });
  assert.deepEqual(listProfiles(root), [
    { id: 'existing-profile', name: 'Perfil existente' },
    bot
  ]);
  assert.equal(currentProfile(root, profileDir(root, bot.id)).type, 'bot');
}));

test('bot names are unique and generated bots have sequential names', () => withTempRoot((root) => {
  const first = createBot(root);
  const second = createBot(root);

  assert.equal(first.name, 'Bot 1');
  assert.equal(second.name, 'Bot 2');
  assert.throws(() => createBot(root, 'bot 1'), /Já existe/);
}));

test('profile menu lists bots, opens them, and does not offer bot deletion', () => {
  const opened = [];
  let createBotClicked = false;
  const bot = { id: 'pesquisa', name: 'Pesquisa', type: 'bot', initialApprovalMode: 'always-ask' };
  const profile = { id: 'pessoal', name: 'Pessoal' };
  const menu = buildProfileMenuTemplate({
    current: MAIN_PROFILE,
    profiles: [profile, bot],
    actions: {
      open: (item) => opened.push(item.id),
      create: () => {},
      createBot: () => { createBotClicked = true; },
      remove: () => {}
    }
  });

  menu.find((item) => item.label === 'Abrir bot: Pesquisa').click();
  menu.find((item) => item.label === 'Novo bot').click();
  const deletionMenu = menu.find((item) => item.label === 'Excluir perfil');

  assert.deepEqual(opened, ['pesquisa']);
  assert.equal(createBotClicked, true);
  assert.deepEqual(deletionMenu.submenu.map((item) => item.label), ['Pessoal']);
});

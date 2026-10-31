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
  profileDir
} = require('../src/main/profiles');

function withTempRoot(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zero-profiles-'));
  try { return run(root); }
  finally { fs.rmSync(root, { recursive: true, force: true }); }
}

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

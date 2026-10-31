const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const {
  MAIN_PROFILE,
  buildProfileMenuTemplate,
  archiveBot,
  createBot,
  createProfile,
  currentProfile,
  getLaunchableProfile,
  listProfiles,
  profileDir,
  restoreBot,
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

test('archiving a bot persists metadata without changing its data directory or avatar inputs', () => withTempRoot((root) => {
  const bot = createBot(root, 'Pesquisa');
  const directory = profileDir(root, bot.id);
  fs.writeFileSync(path.join(directory, 'sentinel.txt'), 'preserve');

  const archived = archiveBot(root, bot.id);
  assert.equal(archived.archived, true);
  assert.equal(fs.readFileSync(path.join(directory, 'sentinel.txt'), 'utf8'), 'preserve');
  assert.deepEqual(listProfiles(root).find((profile) => profile.id === bot.id), archived);
  assert.throws(() => getLaunchableProfile(root, bot.id), /Bot arquivado/);

  const restored = restoreBot(root, bot.id);
  assert.equal(Object.hasOwn(restored, 'archived'), false);
  assert.equal(fs.existsSync(directory), true);
  assert.equal(getLaunchableProfile(root, bot.id).id, bot.id);
}));

test('archive and restore reject regular profiles and unknown bots', () => withTempRoot((root) => {
  const profile = createProfile(root, 'Pessoal');
  assert.throws(() => archiveBot(root, profile.id), /Bot não encontrado/);
  assert.throws(() => restoreBot(root, 'ausente'), /Bot não encontrado/);
  assert.equal(getLaunchableProfile(root, profile.id).id, profile.id);
}));

test('profile menu and launch guard omit archived bots', () => withTempRoot((root) => {
  const opened = [];
  const bot = createBot(root, 'Pesquisa');
  archiveBot(root, bot.id);
  const menu = buildProfileMenuTemplate({
    current: MAIN_PROFILE,
    profiles: listProfiles(root),
    actions: { open: (profile) => opened.push(profile.id), create: () => {}, createBot: () => {}, remove: () => {} }
  });

  assert.equal(menu.some((item) => item.label === 'Abrir bot: Pesquisa'), false);
  assert.throws(() => getLaunchableProfile(root, bot.id), /Bot arquivado/);
  assert.deepEqual(opened, []);
}));

test('cross-process profile mutations serialize deterministically without losing either update', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zero-profiles-concurrent-'));
  const modulePath = path.resolve(__dirname, '../src/main/profiles.js');
  const childScript = `
    const { updateProfiles } = require(${JSON.stringify(modulePath)});
    const root = process.argv[1];
    const id = process.argv[2];
    const name = process.argv[3];
    require('node:fs').readSync(0, Buffer.alloc(1), 0, 1, null);
    updateProfiles(root, (profiles) => {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200);
      profiles.push({ id, name });
    });
  `;
  const children = [];
  try {
    const runWriter = (id, name) => new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['-e', childScript, root, id, name], { stdio: ['pipe', 'ignore', 'pipe'] });
      children.push(child);
      let stderr = '';
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk) => { stderr += chunk; });
      child.once('error', reject);
      child.once('close', (code) => code === 0 ? resolve() : reject(new Error(`Writer ${id} exited ${code}: ${stderr}`)));
      child.stdin.write('go');
      child.stdin.end();
    });

    await Promise.all([
      runWriter('worker-one', 'Worker One'),
      runWriter('worker-two', 'Worker Two')
    ]);

    assert.deepEqual(listProfiles(root).map((profile) => profile.id).sort(), ['worker-one', 'worker-two']);
  } finally {
    for (const child of children) if (child.exitCode === null && child.signalCode === null) child.kill();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

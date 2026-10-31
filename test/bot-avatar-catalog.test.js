const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { BotAvatarCatalog } = require('../src/main/bot-avatar-catalog');

const assetPath = path.join(__dirname, '../assets/bots');

function withCatalog(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zero-bot-art-'));
  const catalog = new BotAvatarCatalog(path.join(root, 'bots.sqlite'), assetPath);
  try { return run(catalog, root); }
  finally {
    catalog.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('pixel avatar atlas is stored once in SQLite and exposes 200 indexed images', () => withCatalog((catalog, root) => {
  assert.equal(catalog.seed(), 200);
  assert.equal(catalog.list().length, 200);
  assert.equal(catalog.count(), 200);
  const first = catalog.getAvatar('pixel-001');
  const last = catalog.getAvatar('pixel-200');
  assert.equal(first.sheetId, 'pixel-animals-01');
  assert.equal(first.frameIndex, 0);
  assert.equal(last.sheetId, 'pixel-animals-02');
  assert.equal(last.frameIndex, 99);
  const db = new (require('node:sqlite').DatabaseSync)(path.join(root, 'bots.sqlite'));
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM bot_avatar_sheets').get().count, 2);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM bot_avatars').get().count, 200);
  db.close();
  const dataUri = catalog.getSheetDataUri(first.sheetId);
  assert.match(dataUri, /^data:image\/png;base64,/);
  assert.deepEqual(Buffer.from(dataUri.split(',')[1], 'base64').subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
}));

test('bot profile records get unique stable avatar references in the database', () => withCatalog((catalog, root) => {
  catalog.seed();
  const profiles = [
    { id: 'bot-research', name: 'Pesquisa', type: 'bot' },
    { id: 'bot-shopping', name: 'Compras', type: 'bot' }
  ];
  const firstList = catalog.syncProfiles(profiles);
  const repeatedList = catalog.syncProfiles([{ ...profiles[0], name: 'Pesquisa Atualizada' }, profiles[1]]);

  assert.equal(firstList.length, 2);
  assert.notEqual(firstList.find((bot) => bot.id === 'bot-research').avatarId, firstList.find((bot) => bot.id === 'bot-shopping').avatarId);
  assert.equal(repeatedList.find((bot) => bot.id === 'bot-research').avatarId, firstList.find((bot) => bot.id === 'bot-research').avatarId);
  assert.equal(repeatedList.find((bot) => bot.id === 'bot-research').name, 'Pesquisa Atualizada');
  const db = new (require('node:sqlite').DatabaseSync)(path.join(root, 'bots.sqlite'));
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM bot_profiles').get().count, 2);
  db.close();
}));

test('avatar reassignment rejects unknown profiles and unknown image ids', () => withCatalog((catalog) => {
  catalog.seed();
  catalog.syncProfiles([{ id: 'bot-a', name: 'A', type: 'bot' }]);
  assert.equal(catalog.setProfileAvatar('missing', 'pixel-002'), false);
  assert.equal(catalog.setProfileAvatar('bot-a', 'missing'), false);
  assert.equal(catalog.setProfileAvatar('bot-a', 'pixel-200'), true);
  assert.equal(catalog.syncProfiles([{ id: 'bot-a', name: 'A', type: 'bot' }])[0].avatarId, 'pixel-200');
  assert.throws(() => catalog.assignProfile({ id: 'human', name: 'Pessoa', type: undefined }), /Perfil de Bot inválido/);
}));

test('profile synchronization removes deleted bots from the active roster', () => withCatalog((catalog) => {
  catalog.seed();
  catalog.syncProfiles([
    { id: 'bot-one', name: 'Um', type: 'bot' },
    { id: 'bot-two', name: 'Dois', type: 'bot' }
  ]);

  const active = catalog.syncProfiles([{ id: 'bot-two', name: 'Dois', type: 'bot' }]);
  assert.deepEqual(active.map((bot) => bot.id), ['bot-two']);
  assert.throws(() => catalog.syncProfiles(null), /precisa ser uma lista/);
  assert.deepEqual(catalog.syncProfiles([]), []);
}));

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const pkg = require('../package.json');
const lock = require('../package-lock.json');

test('app version, lockfile and whats-new notes stay in sync', () => {
  assert.equal(lock.version, pkg.version, 'package-lock.json acompanha package.json');
  assert.equal(lock.packages[''].version, pkg.version, 'a raiz do lock acompanha package.json');
  const notes = fs.readFileSync(path.join(__dirname, '../docs/NOVIDADES.md'), 'utf8');
  assert.ok(notes.includes(pkg.version), 'as novidades citam a versão instalada');
  for (const term of ['Journal de efeitos', 'Receitas por site', 'Clipboard', 'Clique visual', 'Limites conhecidos']) {
    assert.ok(notes.includes(term), `as novidades explicam ${term}`);
  }
});

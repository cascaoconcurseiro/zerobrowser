const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const packageJson = require(path.join(root, 'package.json'));
const mainSource = fs.readFileSync(path.join(root, 'src/main/main.js'), 'utf8');
const storeSource = fs.readFileSync(path.join(root, 'src/store/index.js'), 'utf8');

test('version bumps keep the same Windows user data, encrypted key store, and Gmail session partition', () => {
  assert.equal(packageJson.build.appId, 'com.wesley.navegante');
  assert.match(mainSource, /app\.setName\('navegante'\)/);
  assert.match(mainSource, /const PROFILE_PARTITION = 'persist:navegante'/);
  assert.match(storeSource, /name: 'navegante-config'/);
  assert.match(storeSource, /safeStorage\.encryptString/);
  assert.match(storeSource, /safeStorage\.decryptString/);
  assert.doesNotMatch(mainSource, /userData[^\n]*0\.1\./, 'userData não deve depender da versão do app');
});

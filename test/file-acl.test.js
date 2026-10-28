const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseWhoamiSid, aclArgs, restrictFileToCurrentUser, describeAcl, systemBin } = require('../src/automation/file-acl');

test('the SID is parsed from whoami csv output', () => {
  assert.equal(parseWhoamiSid('"wesley\\wesley","S-1-5-21-1-2-3-1001"\r\n'), 'S-1-5-21-1-2-3-1001');
  assert.equal(parseWhoamiSid('sem sid aqui'), '');
});

test('the ACL command removes inheritance and grants only the user and system', () => {
  const args = aclArgs('C:\\x\\pipe-token', 'S-1-5-21-1-2-3-1001');
  assert.ok(args.includes('/inheritance:r'));
  assert.ok(args.includes('*S-1-5-21-1-2-3-1001:(F)'));
  assert.ok(args.includes('*S-1-5-18:(F)'));
});

test('a failing icacls never breaks startup', () => {
  const failing = () => { throw new Error('icacls indisponível'); };
  const result = restrictFileToCurrentUser('C:\\x\\token', { execFile: failing, sid: 'S-1-5-21-1-2-3-1001' });
  assert.equal(result.ok, false);
  assert.match(result.reason, /icacls/);
  assert.equal(restrictFileToCurrentUser('C:\\x\\token', { execFile: failing, sid: 'nao-e-sid' }).ok, false);
});

test('on Windows the real ACL loses inheritance and keeps the owner', { skip: process.platform !== 'win32' }, () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'zero-acl-')), 'pipe-token');
  try {
    fs.writeFileSync(file, 'token');
    const result = restrictFileToCurrentUser(file);
    assert.equal(result.ok, true, result.reason);
    const acl = describeAcl(file);
    assert.ok(acl.includes(result.sid) || /WESLEY|AUTORIDADE NT\\SISTEMA|NT AUTHORITY\\SYSTEM/i.test(acl), acl);
    assert.ok(!/\(I\)/.test(acl), `ACL ainda tem entradas herdadas:\n${acl}`);
    assert.ok(systemBin('icacls').toLowerCase().includes('icacls'));
  } finally {
    fs.rmSync(path.dirname(file), { recursive: true, force: true });
  }
});

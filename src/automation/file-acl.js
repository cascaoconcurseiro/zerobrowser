// ACL do arquivo de token no Windows: só o dono (SID atual) pode ler, em vez de herdar as permissões da pasta.
// Usa o SID em vez de DOMINIO\usuario para não quebrar com perfil roaming/redirecionado nem com conta de domínio.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SID_PATTERN = /^S-1-\d+(-\d+)+$/i;

// PATH do usuário pode ter o whoami do Git/MSYS antes do do Windows; usa sempre o binário do sistema.
function systemBin(name) {
  const root = process.env.SystemRoot || process.env.windir || 'C:\Windows';
  const candidate = path.join(root, 'System32', `${name}.exe`);
  try {
    if (fs.existsSync(candidate)) return candidate;
  } catch {}
  return name;
}

function parseWhoamiSid(output) {
  const text = String(output || '');
  const match = text.match(/S-1-\d+(?:-\d+)+/i);
  return match ? match[0].toUpperCase() : '';
}

// Executa whoami só no Windows; devolve '' em qualquer falha (o chamador decide se segue sem ACL).
function currentUserSid({ execFile = execFileSync } = {}) {
  if (process.platform !== 'win32') return '';
  try {
    const output = execFile(systemBin('whoami'), ['/user', '/fo', 'csv', '/nh'], { encoding: 'utf8', windowsHide: true, timeout: 30000 });
    return parseWhoamiSid(output);
  } catch {
    return '';
  }
}

function aclArgs(filePath, sid) {
  // Remove herança e deixa apenas o dono; SYSTEM fica para backup/restauração do Windows.
  return [filePath, '/inheritance:r', '/grant:r', `*${sid}:(F)`, '/grant:r', '*S-1-5-18:(F)', '/Q'];
}

// Restringe o arquivo ao usuário atual. Nunca lança: devolve { ok, reason } para o chamador apenas registrar.
function restrictFileToCurrentUser(filePath, { execFile = execFileSync, sid = null } = {}) {
  if (process.platform !== 'win32') return { ok: false, reason: 'not-windows' };
  const userSid = sid || currentUserSid({ execFile });
  if (!SID_PATTERN.test(userSid)) return { ok: false, reason: 'sid-indisponivel' };
  try {
    execFile(systemBin('icacls'), aclArgs(filePath, userSid), { encoding: 'utf8', windowsHide: true, timeout: 30000 });
    return { ok: true, sid: userSid };
  } catch (error) {
    return { ok: false, reason: String(error?.message || error).slice(0, 160) };
  }
}

// Leitura da ACL efetiva, para teste/diagnóstico (uma linha por entrada).
function describeAcl(filePath, { execFile = execFileSync } = {}) {
  if (process.platform !== 'win32') return '';
  try {
    return String(execFile(systemBin('icacls'), [filePath], { encoding: 'utf8', windowsHide: true, timeout: 30000 }));
  } catch (error) {
    return String(error?.stdout || '');
  }
}

module.exports = { parseWhoamiSid, currentUserSid, aclArgs, restrictFileToCurrentUser, describeAcl, systemBin };

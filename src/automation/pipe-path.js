const { createHash } = require('crypto');
const os = require('os');
const path = require('path');
const { zeroEnv } = require('../env');

// Same folder Electron returns for app.getPath('userData'); the pipe name is case-insensitive about it.
function defaultDataDir() {
  return zeroEnv('DATA_DIR') || path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'navegante');
}

// One pipe per Windows user and profile directory, so two profiles never answer each other's clients.
function automationPipePath(dataDir = zeroEnv('DATA_DIR')) {
  const identity = `${process.env.USERDOMAIN || ''}\\${process.env.USERNAME || 'user'}\\${dataDir}`;
  const suffix = createHash('sha256').update(identity.toLowerCase()).digest('hex').slice(0, 16);
  return `\\\\.\\pipe\\navegante-automation-${suffix}`;
}

module.exports = { automationPipePath, defaultDataDir, pipeTokenPath };

// Token do pipe: fica ao lado dos dados do perfil, criado a cada início do serviço.
// Sem ele, qualquer processo local poderia falar MCP com o navegador.
function pipeTokenPath(dataDir = zeroEnv('DATA_DIR')) {
  return path.join(dataDir || defaultDataDir(), 'automation', 'pipe-token');
}

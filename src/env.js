// Variáveis de ambiente do Zero Browser. O nome novo (ZERO_*) vale primeiro; o antigo (NAVEGANTE_*) continua aceito
// para não quebrar scripts, testes e atalhos existentes.
function zeroEnv(name, env = process.env) {
  return env[`ZERO_${name}`] || env[`NAVEGANTE_${name}`] || '';
}

module.exports = { zeroEnv };

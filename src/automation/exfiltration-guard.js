const { isSameSite } = require('../main/browser-policy');

const MAX_QUERY_LENGTH = 120;
const MAX_PARAM_VALUE_LENGTH = 40;

// Uma página maliciosa pode mandar o agente abrir "https://atacante.example/?d=<dados da página>". Navegar para outro site
// sem dados na URL é normal; com credenciais, consulta longa ou valor longo, o usuário decide. Devolve o motivo ou null.
function navigationLeakReason(currentUrl, targetUrl) {
  let target;
  try {
    target = new URL(targetUrl);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(target.protocol)) return null;

  let current = null;
  try {
    current = new URL(currentUrl);
  } catch {}
  // Aba nova ou página interna: não há dados de página para vazar.
  if (!current || !['http:', 'https:'].includes(current.protocol)) return null;
  if (isSameSite(currentUrl, targetUrl)) return null;

  if (target.username || target.password) return 'Abrir outro site com usuário e senha na URL';
  const hasLongValue = [...target.searchParams.values()].some((value) => value.length > MAX_PARAM_VALUE_LENGTH);
  if (target.search.length > MAX_QUERY_LENGTH || target.hash.length > MAX_QUERY_LENGTH || hasLongValue) {
    return 'Abrir outro site com muitos dados na URL (pode enviar informações da página)';
  }
  if (target.protocol === 'http:' && target.search.length > 1) return 'Enviar dados na URL para outro site sem HTTPS';
  return null;
}

module.exports = { navigationLeakReason };

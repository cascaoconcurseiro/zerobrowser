function isGoogleHost(hostname) {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  return /(?:^|\.)google\.(?:com(?:\.[a-z]{2})?|[a-z]{2}|co\.[a-z]{2})$/.test(host);
}

// Só concede automaticamente localização a páginas Google em HTTPS; a origem vem de quem pediu (iframe incluído),
// não da URL da aba, para um frame de terceiro dentro de uma página Google não herdar a permissão.
function shouldAutoGrantGooglePermission(permission, requestingUrl) {
  if (permission !== 'geolocation') return false;

  try {
    const url = new URL(requestingUrl);
    return url.protocol === 'https:' && isGoogleHost(url.hostname);
  } catch {
    return false;
  }
}

module.exports = { shouldAutoGrantGooglePermission };

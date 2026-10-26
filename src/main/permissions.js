function isGoogleHost(hostname) {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  return /(?:^|\.)google\.(?:com(?:\.[a-z]{2})?|[a-z]{2}|co\.[a-z]{2})$/.test(host);
}

function shouldAutoGrantGooglePermission(permission, requestingUrl) {
  if (permission !== 'geolocation') return false;

  try {
    return isGoogleHost(new URL(requestingUrl).hostname);
  } catch {
    return false;
  }
}

module.exports = { shouldAutoGrantGooglePermission };

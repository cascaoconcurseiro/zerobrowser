const { getDomain } = require('tldts');

function getSchemefulSite(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
    const domain = getDomain(hostname, { allowPrivateDomains: true, extractHostname: false });
    return { scheme: url.protocol, site: domain || hostname };
  } catch {
    return null;
  }
}

function isSameSite(firstUrl, secondUrl) {
  const first = getSchemefulSite(firstUrl);
  const second = getSchemefulSite(secondUrl);
  return !!first && !!second && first.scheme === second.scheme && first.site === second.site;
}

function rewriteRequestHeaders(details, settings = {}) {
  const headers = { ...(details.requestHeaders || {}) };
  const requestUrl = details.url;
  const protocol = (() => { try { return new URL(requestUrl).protocol; } catch { return ''; } })();

  const dntHeader = Object.keys(headers).find((name) => name.toLowerCase() === 'dnt');
  if (settings.doNotTrack && ['http:', 'https:'].includes(protocol)) {
    if (dntHeader && dntHeader !== 'DNT') delete headers[dntHeader];
    headers.DNT = '1';
  } else if (dntHeader) {
    delete headers[dntHeader];
  }

  const isTopLevelNavigation = details.resourceType === 'mainFrame';
  const pageUrl = details.pageUrl || details.referrer || '';
  if (settings.blockThirdPartyCookies && !isTopLevelNavigation && pageUrl && !isSameSite(pageUrl, requestUrl)) {
    for (const name of Object.keys(headers)) {
      if (name.toLowerCase() === 'cookie') delete headers[name];
    }
  }
  return headers;
}

function rewriteResponseHeaders(details, settings = {}) {
  const headers = details.responseHeaders || {};
  const isTopLevelNavigation = details.resourceType === 'mainFrame';
  const pageUrl = details.pageUrl || details.referrer || '';
  if (!settings.blockThirdPartyCookies || isTopLevelNavigation || !pageUrl || isSameSite(pageUrl, details.url)) return headers;

  return Object.fromEntries(Object.entries(headers).filter(([name]) => name.toLowerCase() !== 'set-cookie'));
}

function makeUniqueDownloadPath(directory, filename, exists = require('node:fs').existsSync) {
  const path = require('node:path');
  const safeName = path.basename(String(filename || '').replace(/[\0]/g, '')) || 'download';
  const extension = path.extname(safeName);
  const stem = extension ? safeName.slice(0, -extension.length) : safeName;
  let candidate = path.join(directory, safeName);
  let suffix = 1;
  while (exists(candidate)) {
    candidate = path.join(directory, `${stem} (${suffix++})${extension}`);
  }
  return candidate;
}

module.exports = { getSchemefulSite, isSameSite, rewriteRequestHeaders, rewriteResponseHeaders, makeUniqueDownloadPath };

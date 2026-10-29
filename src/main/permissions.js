function permissionOrigin(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

function isTopLevelPermissionRequest(details) {
  return details?.isMainFrame === true;
}

function createSessionPermissionGrants() {
  const grants = new Set();
  const key = (permission, origin) => `${permission}\n${origin}`;
  return {
    has(permission, requestingOrigin, { isMainFrame, embeddingOrigin } = {}) {
      if (isMainFrame !== true || embeddingOrigin) return false;
      const origin = permissionOrigin(requestingOrigin);
      return Boolean(origin && grants.has(key(permission, origin)));
    },
    grant(permission, requestingOrigin, { isMainFrame } = {}) {
      if (isMainFrame !== true) return false;
      const origin = permissionOrigin(requestingOrigin);
      if (!origin || typeof permission !== 'string' || !permission) return false;
      grants.add(key(permission, origin));
      return true;
    }
  };
}

const grantsBySession = new WeakMap();

function permissionGrantsForSession(session) {
  if (!session || (typeof session !== 'object' && typeof session !== 'function')) {
    throw new TypeError('A sessão do navegador é obrigatória.');
  }
  let grants = grantsBySession.get(session);
  if (!grants) {
    grants = createSessionPermissionGrants();
    grantsBySession.set(session, grants);
  }
  return grants;
}

module.exports = { permissionOrigin, isTopLevelPermissionRequest, permissionGrantsForSession };

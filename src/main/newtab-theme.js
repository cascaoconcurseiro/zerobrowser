const path = require('path');
const { fileURLToPath } = require('url');

function isNewtabPage(url, newtabPath) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'file:') return false;
    return path.resolve(fileURLToPath(parsed)) === path.resolve(newtabPath);
  } catch {
    return false;
  }
}

function applyNewtabTheme(webContents, newtabPath, dark) {
  if (!webContents || webContents.isDestroyed() || !isNewtabPage(webContents.getURL(), newtabPath)) return Promise.resolve(false);
  const theme = dark ? 'dark' : 'light';
  return webContents.executeJavaScript(`document.documentElement.dataset.theme = ${JSON.stringify(theme)}`)
    .then(() => true, () => false);
}

module.exports = { isNewtabPage, applyNewtabTheme };

function isTrustedMainUiEvent(event, context = {}) {
  const { webContents, url } = context || {};
  if (!webContents || typeof url !== 'string' || !url) return false;
  try {
    const frame = event?.senderFrame;
    return !webContents.isDestroyed()
      && event.sender === webContents
      && frame === webContents.mainFrame
      && frame.url === url;
  } catch {
    return false;
  }
}

function assertTrustedMainUiEvent(event, getContext) {
  const context = typeof getContext === 'function' ? getContext() : null;
  if (!isTrustedMainUiEvent(event, context)) {
    throw new Error('Somente a interface principal confiável pode usar este canal.');
  }
}

function withTrustedMainUi(handler, assertTrustedUi) {
  return (event, ...args) => {
    assertTrustedUi(event);
    return handler(event, ...args);
  };
}

module.exports = { isTrustedMainUiEvent, assertTrustedMainUiEvent, withTrustedMainUi };

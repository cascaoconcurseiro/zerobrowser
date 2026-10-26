'use strict';

function browserShortcutForInput(input = {}) {
  if (input.type !== 'keyDown' || !(input.control || input.meta) || input.alt) return null;
  const key = String(input.key || '').toLowerCase();
  return ({ t: 'new-tab', w: 'close-tab', h: 'history', j: 'downloads', l: 'focus-address', r: 'reload', d: 'bookmark' })[key] || null;
}

module.exports = { browserShortcutForInput };

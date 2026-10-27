'use strict';

function browserShortcutForInput(input = {}) {
  if (input.type !== 'keyDown' || input.alt) return null;
  const key = String(input.key || '').toLowerCase();
  if (key === 'f5' && !(input.control || input.meta)) return 'reload';
  if (!(input.control || input.meta)) return null;
  if (key === 'tab') return input.shift ? 'previous-tab' : 'next-tab';
  if (input.shift && key === 't') return 'reopen-tab';
  if (/^[1-9]$/.test(key) && !input.shift) return `select-tab-${key}`;
  return ({ t: 'new-tab', w: 'close-tab', h: 'history', j: 'downloads', l: 'focus-address', r: 'reload', d: 'bookmark' })[key] || null;
}

module.exports = { browserShortcutForInput };

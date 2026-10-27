const MODIFIER_FLAGS = Object.freeze({
  Alt: 1,
  Control: 2,
  Meta: 4,
  Shift: 8
});

const KEY_ALIASES = Object.freeze({
  CTRL: 'Control', CONTROL: 'Control', ALT: 'Alt', SHIFT: 'Shift', META: 'Meta', CMD: 'Meta', COMMAND: 'Meta',
  ENTER: 'Enter', RETURN: 'Enter', TAB: 'Tab', ESC: 'Escape', ESCAPE: 'Escape', SPACE: ' ', BACKSPACE: 'Backspace',
  DELETE: 'Delete', INSERT: 'Insert', HOME: 'Home', END: 'End', PAGEUP: 'PageUp', PAGEDOWN: 'PageDown',
  UP: 'ArrowUp', DOWN: 'ArrowDown', LEFT: 'ArrowLeft', RIGHT: 'ArrowRight'
});

const KEY_CODES = Object.freeze({
  Enter: ['Enter', 13], Tab: ['Tab', 9], Escape: ['Escape', 27], Backspace: ['Backspace', 8], Delete: ['Delete', 46],
  Insert: ['Insert', 45], Home: ['Home', 36], End: ['End', 35], PageUp: ['PageUp', 33], PageDown: ['PageDown', 34],
  ArrowUp: ['ArrowUp', 38], ArrowDown: ['ArrowDown', 40], ArrowLeft: ['ArrowLeft', 37], ArrowRight: ['ArrowRight', 39],
  Control: ['ControlLeft', 17], Alt: ['AltLeft', 18], Shift: ['ShiftLeft', 16], Meta: ['MetaLeft', 91], ' ': ['Space', 32]
});

function normalizeKey(key) {
  const text = String(key || '');
  return KEY_ALIASES[text.toUpperCase()] || (text.length === 1 ? text : text);
}

function modifierFlags(modifiers = []) {
  return modifiers.reduce((flags, modifier) => {
    const key = normalizeKey(modifier);
    return flags | (MODIFIER_FLAGS[key] || 0);
  }, 0);
}

function assertPoint(point) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.y < 0 || point.x > 10000 || point.y > 10000) {
    throw new Error('Ponto CUA inválido; use coordenadas de viewport entre 0 e 10000.');
  }
}

function mouseButton(button) {
  const value = button || 'left';
  if (!['left', 'right', 'middle', 'back', 'forward'].includes(value)) throw new Error(`Botão de mouse não suportado: ${value}`);
  return value;
}

// Uma combinação: modificadores primeiro, tecla principal, texto e keyUp. Usado pelo keypress e pela sequência.
async function dispatchChord(send, rawKeys) {
  const keys = (rawKeys || []).map(normalizeKey);
  if (!keys.length || keys.length > 4) throw new Error('Informe de 1 a 4 teclas para pressionar.');
  const modifiers = keys.filter((key) => MODIFIER_FLAGS[key]);
  const mainKeys = keys.filter((key) => !MODIFIER_FLAGS[key]);
  if (mainKeys.length > 1) throw new Error('Informe apenas uma tecla principal por combinação.');
  const key = mainKeys[0] || modifiers.pop();
  if (!key) throw new Error('Combinação de teclas vazia.');
  const keyInfo = KEY_CODES[key] || (key.length === 1 ? [key.toUpperCase(), key.toUpperCase().charCodeAt(0)] : null);
  if (!keyInfo) throw new Error(`Tecla não suportada: ${key}`);
  let currentFlags = modifierFlags(modifiers);
  const pressedModifiers = [];
  try {
    for (const modifier of modifiers) {
      const [code, windowsVirtualKeyCode] = KEY_CODES[modifier];
      await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: modifier, code, windowsVirtualKeyCode, nativeVirtualKeyCode: windowsVirtualKeyCode, modifiers: currentFlags });
      pressedModifiers.push({ modifier, code, windowsVirtualKeyCode });
    }
    const [code, windowsVirtualKeyCode] = keyInfo;
    const text = key.length === 1 && !modifiers.length ? key : undefined;
    await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code, windowsVirtualKeyCode, nativeVirtualKeyCode: windowsVirtualKeyCode, modifiers: currentFlags });
    if (text && !/^[\u0000-\u001f\u007f]$/.test(text)) {
      await send('Input.dispatchKeyEvent', { type: 'char', key, code, text, unmodifiedText: text, windowsVirtualKeyCode, nativeVirtualKeyCode: windowsVirtualKeyCode, modifiers: currentFlags });
    }
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode, nativeVirtualKeyCode: windowsVirtualKeyCode, modifiers: currentFlags });
    return keys;
  } finally {
    for (const { modifier, code, windowsVirtualKeyCode } of pressedModifiers.reverse()) {
      currentFlags &= ~MODIFIER_FLAGS[modifier];
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: modifier, code, windowsVirtualKeyCode, nativeVirtualKeyCode: windowsVirtualKeyCode, modifiers: currentFlags }).catch(() => {});
    }
  }
}

// Sequência com repetição (setas ×N, Tab, Ctrl+seta), como uma pessoa navegando numa grade.
async function performKeySequence(webContents, steps, { delayMs = 25 } = {}) {
  if (!webContents || webContents.isDestroyed()) throw new Error('Aba indisponível');
  if (!Array.isArray(steps) || !steps.length) throw new Error('Informe ao menos uma combinação.');
  const plan = steps.map((step) => {
    if (!step || !Array.isArray(step.keys) || !step.keys.length || step.keys.length > 4) throw new Error('Cada passo precisa de 1 a 4 teclas.');
    const repeat = step.repeat === undefined ? 1 : step.repeat;
    if (!Number.isInteger(repeat) || repeat < 1 || repeat > 50) throw new Error('repeat deve ser inteiro entre 1 e 50.');
    return { keys: step.keys, repeat };
  });
  if (plan.reduce((sum, step) => sum + step.repeat, 0) > 200) throw new Error('Sequência acima de 200 combinações.');
  const debuggerApi = webContents.debugger;
  const attachedHere = !debuggerApi.isAttached();
  if (attachedHere) debuggerApi.attach('1.3');
  const send = (method, params) => debuggerApi.sendCommand(method, params);
  let chords = 0;
  try {
    for (const step of plan) {
      for (let i = 0; i < step.repeat; i += 1) {
        await dispatchChord(send, step.keys);
        chords += 1;
        if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    return { success: true, chords };
  } finally {
    if (attachedHere && debuggerApi.isAttached()) {
      try { debuggerApi.detach(); } catch {}
    }
  }
}

async function performCuaInput(webContents, action) {
  if (!webContents || webContents.isDestroyed()) throw new Error('Aba indisponível');
  const kind = String(action.kind || '').replace(/^cua_/, '');
  const flags = modifierFlags(action.modifiers || action.keys?.filter((key) => MODIFIER_FLAGS[normalizeKey(key)]) || []);
  const debuggerApi = webContents.debugger;
  const attachedHere = !debuggerApi.isAttached();
  if (attachedHere) debuggerApi.attach('1.3');

  const send = (method, params) => debuggerApi.sendCommand(method, params);
  const mouseEvent = (type, point, extra = {}) => send('Input.dispatchMouseEvent', {
    type, x: point.x, y: point.y, modifiers: flags, ...extra
  });

  try {
    switch (kind) {
      case 'click':
      case 'double_click': {
        const point = { x: action.x, y: action.y };
        assertPoint(point);
        const button = mouseButton(action.button);
        const count = kind === 'double_click' ? 2 : Math.max(1, Math.min(3, Number(action.clickCount) || 1));
        await mouseEvent('mouseMoved', point);
        await mouseEvent('mousePressed', point, { button, clickCount: count });
        await mouseEvent('mouseReleased', point, { button, clickCount: count });
        return { success: true, kind: action.kind, point, button, clickCount: count };
      }
      case 'move': {
        const point = { x: action.x, y: action.y };
        assertPoint(point);
        await mouseEvent('mouseMoved', point);
        return { success: true, kind: action.kind, point };
      }
      case 'scroll': {
        const point = { x: action.x, y: action.y };
        assertPoint(point);
        const deltaX = Number(action.deltaX) || 0;
        const deltaY = Number(action.deltaY) || 0;
        if (Math.abs(deltaX) > 10000 || Math.abs(deltaY) > 10000) throw new Error('Delta de rolagem excede o limite de 10000 px.');
        await mouseEvent('mouseWheel', point, { deltaX, deltaY });
        return { success: true, kind: action.kind, point, deltaX, deltaY };
      }
      case 'drag': {
        const path = action.path;
        if (!Array.isArray(path) || path.length < 2 || path.length > 100) throw new Error('O caminho de arraste precisa ter entre 2 e 100 pontos.');
        path.forEach(assertPoint);
        const button = mouseButton(action.button);
        const start = path[0];
        await mouseEvent('mouseMoved', start);
        await mouseEvent('mousePressed', start, { button, clickCount: 1 });
        try {
          for (const point of path.slice(1)) await mouseEvent('mouseMoved', point, { button, buttons: button === 'left' ? 1 : 0 });
        } finally {
          await mouseEvent('mouseReleased', path[path.length - 1], { button, clickCount: 1 });
        }
        return { success: true, kind: action.kind, points: path.length, button };
      }
      case 'keypress': {
        const keys = await dispatchChord(send, action.keys || []);
        return { success: true, kind: action.kind, keys };
      }
      case 'type': {
        const text = String(action.text ?? '');
        if (text.length > 10000) throw new Error('Texto excede o limite de 10000 caracteres por ação.');
        await send('Input.insertText', { text });
        return { success: true, kind: action.kind, characters: text.length };
      }
      default:
        throw new Error(`Ação CUA não suportada: ${action.kind}`);
    }
  } finally {
    if (attachedHere && debuggerApi.isAttached()) debuggerApi.detach();
  }
}

module.exports = { performCuaInput, performKeySequence, dispatchChord, normalizeKey, modifierFlags, assertPoint };

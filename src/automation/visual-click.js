// Clique visual: o modelo estima a posição na captura em coordenadas normalizadas 0–1000 e o host converte para
// pixels do viewport. Resolve canvas/ícones que o snapshot AX não descreve, com verificação opcional por texto.

const VISUAL_CLICK_TOOL = {
  type: 'function',
  function: {
    name: 'visual_click',
    description: 'Clica em coordenadas estimadas da última see_page, em 0–1000 do viewport (x,y). Use quando o controle não estiver nos nodes (canvas, ícone, mapa). Pode declarar expect {text,absent,url} para conferir o efeito.',
    parameters: {
      type: 'object',
      properties: {
        x: { type: 'number', minimum: 0, maximum: 1000 },
        y: { type: 'number', minimum: 0, maximum: 1000 },
        button: { type: 'string', enum: ['left', 'right', 'middle'] },
        expect: {
          type: 'object',
          properties: { url: { type: 'string' }, text: { type: 'string' }, absent: { type: 'string' } },
          additionalProperties: false
        }
      },
      required: ['x', 'y'],
      additionalProperties: false
    }
  }
};

function validateVisualClick({ x, y, button, expect } = {}) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return 'x e y devem ser números entre 0 e 1000.';
  if (x < 0 || x > 1000 || y < 0 || y > 1000) return 'x e y devem estar entre 0 e 1000.';
  if (button !== undefined && !['left', 'right', 'middle'].includes(button)) return 'button inválido.';
  if (expect !== undefined) {
    if (!expect || typeof expect !== 'object' || Array.isArray(expect) || !Object.keys(expect).length) return 'expect deve ser um objeto com url, text ou absent.';
    if (Object.keys(expect).some((key) => !['url', 'text', 'absent'].includes(key))) return 'expect aceita url, text ou absent.';
  }
  return null;
}

// Converte 0–1000 para pixels CSS do viewport, arredondando para dentro da tela.
function pointFromNormalized({ x, y }, viewport) {
  const width = Math.max(1, Number(viewport?.width) || 0);
  const height = Math.max(1, Number(viewport?.height) || 0);
  return {
    x: Math.min(width - 1, Math.max(0, Math.round((Number(x) / 1000) * width))),
    y: Math.min(height - 1, Math.max(0, Math.round((Number(y) / 1000) * height)))
  };
}

module.exports = { VISUAL_CLICK_TOOL, validateVisualClick, pointFromNormalized };

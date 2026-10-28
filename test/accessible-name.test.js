const test = require('node:test');
const assert = require('node:assert/strict');
const { accessibleName } = require('../src/automation/accessible-name');

function el(tag, { attrs = {}, text = '', value = '', labels = [], children = [], type = '', hidden = false } = {}) {
  const node = {
    tagName: tag.toUpperCase(),
    type,
    value,
    hidden,
    labels,
    children,
    getAttribute: (name) => (Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null)
  };
  Object.defineProperty(node, 'textContent', {
    get() { return text + children.map((child) => child.textContent).join(' '); }
  });
  return node;
}

function docWith(nodes) {
  return { getElementById: (id) => nodes[id] || null, defaultView: null };
}

test('accname follows labelledby, aria-label and native labels in order', () => {
  const label = el('span', { text: 'Nome do cliente' });
  const input = el('input', { attrs: { 'aria-labelledby': 'l1', 'aria-label': 'Outro' }, type: 'text' });
  const doc = docWith({ l1: label });
  input.ownerDocument = doc;
  label.ownerDocument = doc;
  assert.equal(accessibleName(input), 'Nome do cliente', 'labelledby vence aria-label');

  const aria = el('input', { attrs: { 'aria-label': 'E-mail' }, type: 'email' });
  assert.equal(accessibleName(aria), 'E-mail');

  const wrapped = el('input', { type: 'text', labels: [el('label', { text: 'Telefone' })] });
  assert.equal(accessibleName(wrapped), 'Telefone');
});

test('accname falls back through value, alt, title, placeholder and content', () => {
  assert.equal(accessibleName(el('input', { type: 'submit', value: 'Salvar' })), 'Salvar');
  assert.equal(accessibleName(el('img', { attrs: { alt: 'Gráfico de vendas' } })), 'Gráfico de vendas');
  assert.equal(accessibleName(el('span', { attrs: { title: 'Ajuda' } })), 'Ajuda');
  assert.equal(accessibleName(el('input', { attrs: { placeholder: 'Buscar' }, type: 'search' })), 'Buscar');
  assert.equal(accessibleName(el('button', { text: 'Finalizar compra' })), 'Finalizar compra');
  assert.equal(accessibleName(el('a', { text: 'Voltar' })), 'Voltar');
  assert.equal(accessibleName(el('input', { type: 'text', value: 'texto digitado' })), 'texto digitado');
  assert.equal(accessibleName(el('input', { type: 'password', value: 'segredo' }), { sensitive: true }), '');
});

test('accname ignores hidden labelledby targets and survives cycles', () => {
  const hidden = el('span', { text: 'Oculto', hidden: true });
  const input = el('input', { attrs: { 'aria-labelledby': 'h' }, type: 'text' });
  input.ownerDocument = docWith({ h: hidden });
  hidden.ownerDocument = input.ownerDocument;
  assert.equal(accessibleName(input), '', 'alvo oculto não nomeia');

  const loop = el('div', { attrs: { 'aria-labelledby': 'loop', role: 'button' } });
  loop.ownerDocument = docWith({ loop });
  assert.equal(accessibleName(loop), '');
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { reviewAction, reviewFinal } = require('../src/automation/guardian');

test('guardian refuses navigation outside HTTP/HTTPS and URLs with credentials', () => {
  assert.equal(reviewAction({ name: 'navigate', args: { url: 'https://a.test/x' }, pageUrl: 'https://a.test' }).decision, 'allow');
  assert.equal(reviewAction({ name: 'navigate', args: { url: 'javascript:alert(1)' } }).decision, 'deny');
  assert.match(reviewAction({ name: 'navigate', args: { url: 'file:///c:/x' } }).reasons[0], /HTTP/);
  assert.equal(reviewAction({ name: 'navigate', args: { url: 'https://user:pass@a.test' } }).decision, 'deny');
  assert.equal(reviewAction({ name: 'tabs', args: { action: 'new', url: 'chrome://settings' } }).decision, 'deny');
});

test('guardian only lets uploads reach the task origin or a declared login origin', () => {
  const base = { name: 'upload_file', args: { index: 3, file: 'nota.txt' } };
  assert.equal(reviewAction({ ...base, pageUrl: 'https://loja.test/carrinho', taskOrigin: 'https://loja.test' }).decision, 'allow');
  assert.equal(reviewAction({ ...base, pageUrl: 'https://login.loja.test/', taskOrigin: 'https://loja.test', authenticationOrigins: ['https://login.loja.test'] }).decision, 'allow');
  const foreign = reviewAction({ ...base, pageUrl: 'https://atacante.test/', taskOrigin: 'https://loja.test' });
  assert.equal(foreign.decision, 'deny');
  assert.match(foreign.reasons[0], /origem diferente/);
  const unknown = reviewAction({ ...base, pageUrl: 'https://loja.test' });
  assert.equal(unknown.decision, 'allow');
  assert.ok(unknown.flags.some((flag) => /sem origem de tarefa/.test(flag)));
});

test('guardian checks recipes and cross-site forms', () => {
  assert.equal(reviewAction({
    name: 'recipe', args: { action: 'save', steps: [{ tool: 'navigate', args: { url: 'ftp://a.test' } }] }
  }).decision, 'deny');
  assert.equal(reviewAction({
    name: 'recipe', args: { action: 'save', authority: 'read', steps: [{ tool: 'sheets', args: { action: 'write', range: 'A1' } }] }
  }).decision, 'deny');
  assert.equal(reviewAction({
    name: 'formAction', args: { url: 'https://outro.test/post' }, pageUrl: 'https://banco.test/'
  }).decision, 'deny');
});

test('guardian flags risky-but-allowed input without blocking it', () => {
  const flags = (result) => result.flags.join(' ').toLowerCase();
  assert.match(flags(reviewAction({ name: 'clipboard', args: { action: 'write', text: 'x' } })), /transferência/);
  assert.match(flags(reviewAction({ name: 'visual_click', args: { x: 1, y: 2 } })), /coordenada/);
  assert.match(flags(reviewAction({ name: 'key_sequence', args: { steps: [{ keys: ['Tab'] }, { keys: ['Enter'] }] } })), /enter/);
});

test('final review separates claims from proof', () => {
  assert.equal(reviewFinal({ message: 'Abri a página e li os valores.' }).decision, 'ok');
  assert.equal(reviewFinal({ message: 'Pronto, salvei tudo.' }).decision, 'warn');
  assert.equal(reviewFinal({ message: 'Pronto, salvei tudo.', verification: { ok: true } }).decision, 'ok');
  const contradiction = reviewFinal({ message: 'Enviei o formulário.', verification: { ok: false } });
  assert.equal(contradiction.decision, 'contradiction');
  assert.match(contradiction.reasons[0], /contrato/);
});

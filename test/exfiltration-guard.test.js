const test = require('node:test');
const assert = require('node:assert/strict');
const { navigationLeakReason } = require('../src/automation/exfiltration-guard');

const page = 'https://banco.example.com/extrato';

test('navegar para outro site sem dados na URL é livre', () => {
  assert.equal(navigationLeakReason(page, 'https://www.google.com/search?q=clima'), null);
  assert.equal(navigationLeakReason(page, 'https://outro.example.org/'), null);
});

test('mesmo site com dados na URL é livre', () => {
  assert.equal(navigationLeakReason(page, `https://banco.example.com/busca?q=${'a'.repeat(300)}`), null);
});

test('outro site com consulta longa pede aprovação', () => {
  assert.ok(navigationLeakReason(page, `https://atacante.example/?d=${'x'.repeat(200)}`));
  assert.ok(navigationLeakReason(page, `https://atacante.example/?d=${'x'.repeat(50)}`));
});

test('usuário e senha na URL de outro site pedem aprovação', () => {
  assert.ok(navigationLeakReason(page, 'https://user:pass@atacante.example/'));
});

test('dados na URL sem HTTPS pedem aprovação', () => {
  assert.ok(navigationLeakReason(page, 'http://outro.example.org/?a=1'));
});

test('aba nova ou página interna não tem o que vazar', () => {
  assert.equal(navigationLeakReason('', `https://atacante.example/?d=${'x'.repeat(200)}`), null);
  assert.equal(navigationLeakReason('zero://newtab', `https://atacante.example/?d=${'x'.repeat(200)}`), null);
  assert.equal(navigationLeakReason(page, 'javascript:alert(1)'), null);
});

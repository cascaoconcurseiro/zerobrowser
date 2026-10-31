const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyRequest } = require('../src/renderer/orchestrator-routing');

const bots = [
  { id: 'price-hunter', name: 'Bot Caçador de Preços', specialty: 'price-hunter', specialtyTitle: 'Pesquisador de Preços' },
  { id: 'market-radar', name: 'Bot Radar de Mercado', specialty: 'market-radar', specialtyTitle: 'Radar Financeiro' },
  { id: 'inbox-triage', name: 'Bot Triagem Executiva', specialty: 'inbox-triage', specialtyTitle: 'Triagem de E-mail e Agenda' }
];

test('orchestrator routes clear price requests to the price specialist', () => {
  assert.equal(classifyRequest('Compare preços e frete desta loja', bots).bot.id, 'price-hunter');
});

test('orchestrator routes clear market requests to the market specialist', () => {
  assert.equal(classifyRequest('Acompanhe a cotação e o ticker na bolsa de valores', bots).bot.id, 'market-radar');
});

test('orchestrator routes inbox requests to the email specialist', () => {
  assert.equal(classifyRequest('Faça triagem das mensagens não lidas na caixa de entrada', bots).bot.id, 'inbox-triage');
});

test('ordinary and ambiguous requests stay with the general agent', () => {
  assert.equal(classifyRequest('Resuma esta página em cinco tópicos', bots).kind, 'general');
  assert.equal(classifyRequest('Compare preços e faça triagem dos meus e-mails', bots).reason, 'ambiguous');
});

test('unavailable specialist does not pretend a route exists', () => {
  assert.deepEqual(classifyRequest('Compare preços e frete', []), { kind: 'general', bot: null, reason: 'specialist-unavailable' });
});

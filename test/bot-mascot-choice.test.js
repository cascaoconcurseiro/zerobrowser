const test = require('node:test');
const assert = require('node:assert/strict');
const { BotTaskStore } = require('../src/bots/bot-store');

test('Bot especialista guarda o mascote escolhido entre 1 e 40', () => {
  const store = new BotTaskStore();
  const chosen = store.createBot({ name: 'Bot Teste A', specialty: 'price-hunter', mascot: 7 });
  assert.equal(chosen.mascot, 7);
  const invalid = store.createBot({ name: 'Bot Teste B', specialty: 'price-hunter', mascot: 99 });
  assert.equal(invalid.mascot, null);
  const missing = store.createBot({ name: 'Bot Teste C', specialty: 'price-hunter' });
  assert.equal(missing.mascot, null);
});

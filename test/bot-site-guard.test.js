'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createBotSiteGuard } = require('../src/bots/bot-site-guard');

function fakeSession() {
  const registered = [];
  return {
    registered,
    webRequest: {
      onBeforeRequest(handler) {
        registered.push(handler);
      }
    }
  };
}

function callHandler(handler, details) {
  return new Promise((resolve) => {
    handler(details, (response) => resolve(response));
  });
}

test('a sessão do Bot cancela a navegação principal para site fora da lista', async () => {
  const blocked = [];
  const guard = createBotSiteGuard({
    bot: { id: 'bot-1', allowedSites: ['https://loja.exemplo.com.br'] },
    onBlocked: (event) => blocked.push(event)
  });
  const ses = fakeSession();

  assert.equal(guard.guardSession(ses), true);
  assert.equal(ses.registered.length, 1, 'uma barreira por sessão');

  const handler = ses.registered[0];
  const allowed = await callHandler(handler, { resourceType: 'mainFrame', url: 'https://loja.exemplo.com.br/produto/1' });
  assert.deepEqual(allowed, {});
  assert.equal(blocked.length, 0);

  const denied = await callHandler(handler, { resourceType: 'mainFrame', url: 'https://site-nao-permitido.com/' });
  assert.deepEqual(denied, { cancel: true });
  assert.equal(blocked.length, 1);
  assert.equal(blocked[0].botId, 'bot-1');
  assert.match(blocked[0].message, /não está na lista do Bot/);
  assert.match(blocked[0].message, /site-nao-permitido\.com/);
});

test('imagem, script e fonte de outro domínio não derrubam a página do Bot', async () => {
  const guard = createBotSiteGuard({ bot: { id: 'bot-1', allowedSites: ['https://loja.exemplo.com.br'] } });
  const ses = fakeSession();
  guard.guardSession(ses);

  const response = await callHandler(ses.registered[0], { resourceType: 'script', url: 'https://cdn.outro.com/app.js' });
  assert.deepEqual(response, {});
});

test('loadURL do agente para outro site também é cancelado', async () => {
  const guard = createBotSiteGuard({ bot: { id: 'bot-1', allowedSites: ['loja.exemplo.com.br'] } });
  const ses = fakeSession();
  guard.guardSession(ses);

  const response = await callHandler(ses.registered[0], { resourceType: 'mainFrame', url: 'https://outro-site.com/' });
  assert.deepEqual(response, { cancel: true });
});

test('a barreira segue a lista nova quando a ficha do Bot é editada', async () => {
  const guard = createBotSiteGuard({ bot: { id: 'bot-1', allowedSites: ['a.com'] } });
  assert.equal(guard.allows('https://a.com/'), true);
  assert.equal(guard.allows('https://b.com/'), false);

  guard.updatePolicy({ id: 'bot-1', allowedSites: ['b.com'] });
  assert.equal(guard.allows('https://a.com/'), false);
  assert.equal(guard.allows('https://b.com/'), true);
  assert.deepEqual(guard.allowedSites, ['b.com']);
});

test('a mesma sessão não recebe duas barreiras', () => {
  const guard = createBotSiteGuard({ bot: { id: 'bot-1', allowedSites: [] } });
  const ses = fakeSession();
  assert.equal(guard.guardSession(ses), true);
  assert.equal(guard.guardSession(ses), false);
  assert.equal(ses.registered.length, 1);
});

test('sessão sem webRequest não quebra a abertura da aba', () => {
  const guard = createBotSiteGuard({ bot: { id: 'bot-1', allowedSites: [] } });
  assert.equal(guard.guardSession({}), false);
  assert.equal(guard.guardSession(null), false);
});

test('block() devolve a mensagem para o recibo', () => {
  const guard = createBotSiteGuard({ bot: { id: 'bot-1', allowedSites: ['exemplo.com.br'] } });
  assert.equal(guard.allows('about:blank'), true);
  const message = guard.block('https://fora.com/');
  assert.match(message, /fora\.com/);
});

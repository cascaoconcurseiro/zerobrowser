'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  USER_PARTITION,
  botPartitionFor,
  isBotPartition,
  isUrlAllowedForBot,
  siteBlockedMessage
} = require('../src/bots/site-policy');

test('cada Bot recebe um perfil isolado e nunca o perfil do usuário', () => {
  const a = botPartitionFor('bot-a');
  const b = botPartitionFor('bot-b');
  assert.equal(a, 'persist:navegante-bot-bot-a');
  assert.notEqual(a, b);
  assert.notEqual(a, USER_PARTITION);
  assert.notEqual(b, USER_PARTITION);
  assert.equal(isBotPartition(a), true);
  assert.equal(isBotPartition(USER_PARTITION), false);
});

test('nome de Bot com caracteres estranhos não muda o perfil nem quebra o caminho', () => {
  assert.equal(botPartitionFor('Bot 1 / Maria*'), 'persist:navegante-bot-bot-1-maria');
  assert.equal(botPartitionFor('../../etc/passwd'), 'persist:navegante-bot-etc-passwd');
  assert.equal(botPartitionFor(''), 'persist:navegante-bot-sem-id');
  assert.equal(botPartitionFor('bot-a'), botPartitionFor('BOT-A'));
});

test('site fora da lista do Bot é bloqueado', () => {
  const allowed = ['https://loja.exemplo.com.br/produto/1'];
  assert.equal(isUrlAllowedForBot('https://loja.exemplo.com.br/produto/1', allowed), true);
  assert.equal(isUrlAllowedForBot('https://loja.exemplo.com.br/produto/2', allowed), false);
  assert.equal(isUrlAllowedForBot('https://outra-loja.com.br/produto/1', allowed), false);
});

test('a entrada de site vale para o site e para os subdomínios dele', () => {
  const allowed = ['exemplo.com.br'];
  assert.equal(isUrlAllowedForBot('https://exemplo.com.br/', allowed), true);
  assert.equal(isUrlAllowedForBot('https://www.exemplo.com.br/oferta', allowed), true);
  assert.equal(isUrlAllowedForBot('https://compras.exemplo.com.br/carrinho', allowed), true);
});

test('domínio parecido não passa: só subdomínio de verdade', () => {
  const allowed = ['exemplo.com.br'];
  assert.equal(isUrlAllowedForBot('https://exemplo.com.br.attacker.com/', allowed), false);
  assert.equal(isUrlAllowedForBot('https://naoexemplo.com.br/', allowed), false);
  assert.equal(isUrlAllowedForBot('https://exemplo.com.br.evil.io/', allowed), false);
});

test('endereço com esquema perigoso é sempre bloqueado', () => {
  for (const url of ['file:///C:/Windows/win.ini', 'javascript:alert(1)', 'data:text/html,oi', 'chrome://settings', 'devtools://devtools/bundled/inspector.html']) {
    assert.equal(isUrlAllowedForBot(url, ['exemplo.com.br']), false, url);
    assert.equal(isUrlAllowedForBot(url, []), false, url);
    assert.equal(isUrlAllowedForBot(url, ['*']), false, url);
  }
});

test('aba vazia é permitida; endereço inválido não', () => {
  assert.equal(isUrlAllowedForBot('about:blank', ['exemplo.com.br']), true);
  assert.equal(isUrlAllowedForBot('', ['exemplo.com.br']), false);
  assert.equal(isUrlAllowedForBot('não é endereço', ['exemplo.com.br']), false);
});

test('sem lista, o Bot navega em http e https mas mantém o bloqueio de esquema', () => {
  assert.equal(isUrlAllowedForBot('https://qualquer.site/', []), true);
  assert.equal(isUrlAllowedForBot('http://qualquer.site/', []), true);
  assert.equal(isUrlAllowedForBot('file:///etc/passwd', []), false);
});

test('curinga e protocolo declarado são respeitados', () => {
  assert.equal(isUrlAllowedForBot('https://qualquer.site/', ['*']), true);
  assert.equal(isUrlAllowedForBot('http://loja.com/', ['https://loja.com']), false);
  assert.equal(isUrlAllowedForBot('https://loja.com/', ['https://loja.com']), true);
  assert.equal(isUrlAllowedForBot('http://loja.com/', ['loja.com']), true);
});

test('entrada com caminho limita a navegação àquela pasta', () => {
  const allowed = ['https://site.com/loja/'];
  assert.equal(isUrlAllowedForBot('https://site.com/loja/produto', allowed), true);
  assert.equal(isUrlAllowedForBot('https://site.com/admin', allowed), false);
});

test('mensagem de bloqueio diz qual site e qual é a lista', () => {
  assert.match(siteBlockedMessage('https://outra-loja.com/', ['exemplo.com.br']), /outra-loja\.com/);
  assert.match(siteBlockedMessage('https://outra-loja.com/', ['exemplo.com.br']), /exemplo\.com\.br/);
  assert.match(siteBlockedMessage('file:///etc/passwd', []), /http e https/);
});

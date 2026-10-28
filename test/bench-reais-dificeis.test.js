const test = require('node:test');
const assert = require('node:assert/strict');
const { tarefasReaisDificeis, citouPagina } = require('../bench/tarefas-reais-dificeis');

test('citation check accepts a sentence that exists on the final page', () => {
  const page = 'Show HN: my new project - comments. Ask HN: what are you working on?';
  assert.equal(citouPagina('A primeira história é "Ask HN: what are you working on?".', page), true);
  assert.equal(citouPagina('A primeira história é Ask HN: what are you working on?', page), true);
});

test('citation check rejects a generic answer that is not on the page', () => {
  const page = 'Show HN: my new project - comments.';
  assert.equal(citouPagina('A primeira história fala sobre inteligência artificial.', page), false);
  assert.equal(citouPagina('Resposta qualquer', ''), false);
});

test('the hard real-site suite covers the intended difficulties', () => {
  const ids = tarefasReaisDificeis.map((task) => task.id);
  for (const id of ['x01-hackernews-listagem', 'x02-github-releases', 'x03-g1-cookies', 'x04-uol-manchete', 'x05-govbr-noticia', 'x06-mdn-closures']) {
    assert.ok(ids.includes(id), id);
  }
  for (const task of tarefasReaisDificeis) {
    assert.ok(task.hosts?.length, `${task.id} precisa de hosts para a política public-sites`);
    assert.equal(task.verificarPagina, true, `${task.id} precisa manter a aba para conferir o texto`);
    assert.equal(typeof task.verificar, 'function');
  }
});

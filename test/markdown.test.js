const test = require('node:test');
const assert = require('node:assert/strict');
const { parseBlocks, parseInline } = require('../src/renderer/markdown');

test('paragraphs are split on blank lines, not glued into one block', () => {
  const blocks = parseBlocks('Primeiro parágrafo.\n\nSegundo parágrafo.\nAinda o segundo.');
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].type, 'p');
  assert.equal(blocks[1].lines.length, 2);
  assert.deepEqual(blocks[1].lines[1], [{ type: 'text', value: 'Ainda o segundo.' }]);
});

test('lists, headings and code fences keep their structure', () => {
  const text = [
    '## Resultado',
    '',
    '- um',
    '- **dois**',
    '',
    '1. primeiro',
    '2. segundo',
    '',
    '```js',
    'const total = 12;',
    '```'
  ].join('\n');
  const blocks = parseBlocks(text);
  assert.deepEqual(blocks.map((block) => block.type), ['heading', 'ul', 'ol', 'code']);
  assert.deepEqual(blocks[1].items[1], [{ type: 'strong', value: 'dois' }]);
  assert.equal(blocks[3].text, 'const total = 12;');
});

test('inline bold and code do not leak the markers and HTML stays text', () => {
  const tokens = parseInline('Total **R$ 10** e `code` <b>x</b>');
  assert.deepEqual(tokens.map((token) => token.type), ['text', 'strong', 'text', 'code', 'text']);
  assert.equal(tokens[1].value, 'R$ 10');
  assert.equal(tokens[3].value, 'code');
  assert.equal(tokens[4].value, ' <b>x</b>', 'tags viram texto, não HTML');
});

test('empty or whitespace text renders nothing', () => {
  assert.deepEqual(parseBlocks(''), []);
  assert.deepEqual(parseBlocks('   \n\n  '), []);
  assert.deepEqual(parseBlocks(null), []);
});

test('a long answer with real newlines becomes several readable blocks', () => {
  const answer = [
    'Encontrei os dados na planilha.',
    '',
    'Resumo:',
    '- 3 linhas lidas',
    '- total 1.234,50',
    '',
    'Se quiser, salvo como receita.'
  ].join('\n');
  const blocks = parseBlocks(answer);
  assert.ok(blocks.length >= 3, 'não pode virar um bloco único');
  assert.equal(blocks[0].type, 'p');
  assert.equal(blocks[1].type, 'p');
  assert.equal(blocks[2].type, 'ul');
});

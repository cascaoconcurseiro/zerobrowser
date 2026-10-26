const test = require('node:test');
const assert = require('node:assert/strict');
const { summarizeBatchCoverage } = require('../src/automation/batch-coverage');

test('batch coverage distinguishes an index page from matching source pages', () => {
  const pages = [
    { url: 'http://127.0.0.1/task', matches: 0 },
    ...['norte', 'sul', 'leste', 'oeste', 'litoral'].map((branch) => ({ url: `http://127.0.0.1/task?f=${branch}`, matches: 2 }))
  ];
  assert.deepEqual(summarizeBatchCoverage(pages, 'Cadeira Ergo'), {
    pagesRead: 6,
    pagesWithMatches: 5,
    pagesWithoutMatches: 1
  });
});

test('batch coverage reports complete matches and excludes failed pages', () => {
  const pages = [
    ...['centro', 'norte', 'sul', 'leste', 'oeste', 'litoral'].map((branch) => ({ url: `http://127.0.0.1/task?f=${branch}`, matches: 2 })),
    { url: 'http://127.0.0.1/failed', error: 'unavailable' }
  ];
  assert.deepEqual(summarizeBatchCoverage(pages, 'Cadeira Ergo'), {
    pagesRead: 6,
    pagesWithMatches: 6,
    pagesWithoutMatches: 0
  });
});

test('batch coverage without a query treats every successfully read page as included', () => {
  assert.deepEqual(summarizeBatchCoverage([{ text: 'one' }, { error: 'failed' }], ''), {
    pagesRead: 1,
    pagesWithMatches: 1,
    pagesWithoutMatches: 0
  });
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { summarizeBatchCoverage } = require('../src/automation/batch-coverage');

test('batch coverage distinguishes an index page from matching source pages', () => {
  const pages = [
    { url: 'http://127.0.0.1/task', matches: 0, matchesReturned: 0 },
    ...['norte', 'sul', 'leste', 'oeste', 'litoral'].map((branch) => ({ url: `http://127.0.0.1/task?f=${branch}`, matches: 2, matchesReturned: 2 }))
  ];
  assert.deepEqual(summarizeBatchCoverage(pages, 'Cadeira Ergo'), {
    complete: true,
    pagesConsidered: 6,
    pagesRead: 6,
    pagesFailed: 0,
    pagesWithMatches: 5,
    pagesWithoutMatches: 1,
    pagesTruncated: 0,
    tabsOmitted: 0,
    matchesFound: 10,
    matchesReturned: 10,
    matchesOmitted: 0
  });
});

test('batch coverage reports complete matches and excludes failed pages', () => {
  const pages = [
    ...['centro', 'norte', 'sul', 'leste', 'oeste', 'litoral'].map((branch) => ({ url: `http://127.0.0.1/task?f=${branch}`, matches: 2, matchesReturned: 2 })),
    { url: 'http://127.0.0.1/failed', error: 'unavailable' }
  ];
  assert.deepEqual(summarizeBatchCoverage(pages, 'Cadeira Ergo'), {
    complete: false,
    pagesConsidered: 7,
    pagesRead: 6,
    pagesFailed: 1,
    pagesWithMatches: 6,
    pagesWithoutMatches: 0,
    pagesTruncated: 0,
    tabsOmitted: 0,
    matchesFound: 12,
    matchesReturned: 12,
    matchesOmitted: 0
  });
});

test('batch coverage without a query treats every successfully read page as included', () => {
  assert.deepEqual(summarizeBatchCoverage([{ text: 'one' }, { error: 'failed' }], ''), {
    complete: false,
    pagesConsidered: 2,
    pagesRead: 1,
    pagesFailed: 1,
    pagesWithMatches: 1,
    pagesWithoutMatches: 0,
    pagesTruncated: 0,
    tabsOmitted: 0
  });
});

test('batch coverage exposes omitted tabs, matches, and truncated page text', () => {
  assert.deepEqual(summarizeBatchCoverage([
    { matches: 10, matchesReturned: 3, truncated: true },
    { matches: 0, matchesReturned: 0 }
  ], 'item', { tabsOmitted: 2 }), {
    complete: false,
    pagesConsidered: 2,
    pagesRead: 2,
    pagesFailed: 0,
    pagesWithMatches: 1,
    pagesWithoutMatches: 1,
    pagesTruncated: 1,
    tabsOmitted: 2,
    matchesFound: 10,
    matchesReturned: 3,
    matchesOmitted: 7
  });
});

test('the last chunk of a paginated read is complete even though earlier chunks held matches', () => {
  const coverage = summarizeBatchCoverage([
    { matches: 10, matchesReturned: 3, matchesRemaining: 0 }
  ], 'item');
  assert.equal(coverage.complete, true, 'nada falta depois deste trecho');
  assert.equal(coverage.matchesFound, 10);
  assert.equal(coverage.matchesReturned, 3);
  assert.equal(coverage.matchesOmitted, 0, 'trechos anteriores já entregues não contam como omissão');
  assert.equal(coverage.pagesTruncated, 0);
});

test('a chunk with matches still ahead is incomplete and counts only what remains', () => {
  const coverage = summarizeBatchCoverage([
    { matches: 10, matchesReturned: 3, matchesRemaining: 5, truncated: true }
  ], 'item');
  assert.equal(coverage.complete, false);
  assert.equal(coverage.matchesOmitted, 5);
  assert.equal(coverage.pagesTruncated, 1);
});

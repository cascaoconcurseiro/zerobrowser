function summarizeBatchCoverage(pages, query, { tabsOmitted = 0 } = {}) {
  const considered = Array.isArray(pages) ? pages : [];
  const available = considered.filter((page) => !page?.error);
  const failed = considered.length - available.length;
  const pagesWithMatches = String(query || '').trim()
    ? available.filter((page) => Number(page?.matches) > 0).length
    : available.length;
  const pagesTruncated = available.filter((page) => page?.truncated === true).length;
  const hasQuery = Boolean(String(query || '').trim());
  const matchesFound = hasQuery ? available.reduce((sum, page) => sum + (Number(page?.matches) || 0), 0) : 0;
  const matchesReturned = hasQuery ? available.reduce((sum, page) => sum + (Number(page?.matchesReturned) || 0), 0) : 0;
  // `matchesOmitted` é o que ainda falta depois deste trecho, não o que ficou em trechos anteriores: uma continuação
  // que chega ao fim da página pode ser completa. Páginas sem `matchesRemaining` mantêm o cálculo antigo.
  const matchesOmitted = hasQuery
    ? available.reduce((sum, page) => sum + (Number.isFinite(page?.matchesRemaining)
      ? Number(page.matchesRemaining)
      : Math.max(0, (Number(page?.matches) || 0) - (Number(page?.matchesReturned) || 0))), 0)
    : 0;
  const coverage = {
    complete: failed === 0 && pagesTruncated === 0 && tabsOmitted === 0 && matchesOmitted === 0,
    pagesConsidered: considered.length,
    pagesRead: available.length,
    pagesFailed: failed,
    pagesWithMatches,
    pagesWithoutMatches: available.length - pagesWithMatches,
    pagesTruncated,
    tabsOmitted
  };
  if (hasQuery) {
    coverage.matchesFound = matchesFound;
    coverage.matchesReturned = matchesReturned;
    coverage.matchesOmitted = matchesOmitted;
  }
  return coverage;
}

module.exports = { summarizeBatchCoverage };

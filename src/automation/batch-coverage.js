function summarizeBatchCoverage(pages, query) {
  const available = (Array.isArray(pages) ? pages : []).filter((page) => !page?.error);
  if (!String(query || '').trim()) {
    return { pagesRead: available.length, pagesWithMatches: available.length, pagesWithoutMatches: 0 };
  }
  const pagesWithMatches = available.filter((page) => Number(page?.matches) > 0).length;
  return {
    pagesRead: available.length,
    pagesWithMatches,
    pagesWithoutMatches: available.length - pagesWithMatches
  };
}

module.exports = { summarizeBatchCoverage };

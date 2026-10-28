// Parser mínimo do texto do modelo para o painel: parágrafos, listas, títulos, negrito e código.
// Sem DOM e sem HTML: devolve blocos e trechos; o renderer monta os nós (nada de innerHTML com texto do modelo).

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ZeroMarkdown = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const LIST_ITEM = /^\s*[-*•]\s+/;
  const ORDERED_ITEM = /^\s*\d+[.)]\s+/;
  const HEADING = /^#{1,4}\s+/;
  const INLINE = /(\*\*[^*]+\*\*|`[^`]+`)/g;

  function parseInline(value) {
    const text = String(value ?? '');
    const tokens = [];
    let last = 0;
    let match;
    INLINE.lastIndex = 0;
    while ((match = INLINE.exec(text))) {
      if (match.index > last) tokens.push({ type: 'text', value: text.slice(last, match.index) });
      const token = match[0];
      if (token.startsWith('**')) tokens.push({ type: 'strong', value: token.slice(2, -2) });
      else tokens.push({ type: 'code', value: token.slice(1, -1) });
      last = INLINE.lastIndex;
    }
    if (last < text.length) tokens.push({ type: 'text', value: text.slice(last) });
    return tokens;
  }

  function parseBlocks(text) {
    const normalized = String(text ?? '').replace(/\r\n/g, '\n');
    if (!normalized.trim()) return [];
    const blocks = [];
    let paragraph = [];
    let list = null;
    const flushParagraph = () => {
      if (paragraph.length) {
        blocks.push({ type: 'p', lines: paragraph.map((line) => parseInline(line)) });
        paragraph = [];
      }
    };
    const flushList = () => {
      if (list) {
        blocks.push(list);
        list = null;
      }
    };
    const lines = normalized.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^```/.test(line)) {
        flushParagraph();
        flushList();
        const first = line.replace(/^```\w*/, '');
        const body = first ? [first] : [];
        i += 1;
        while (i < lines.length && !/^```\s*$/.test(lines[i])) {
          body.push(lines[i]);
          i += 1;
        }
        blocks.push({ type: 'code', text: body.join('\n') });
        continue;
      }
      if (!line.trim()) {
        flushParagraph();
        flushList();
        continue;
      }
      if (LIST_ITEM.test(line)) {
        flushParagraph();
        if (!list || list.type !== 'ul') {
          flushList();
          list = { type: 'ul', items: [] };
        }
        list.items.push(parseInline(line.replace(LIST_ITEM, '')));
        continue;
      }
      if (ORDERED_ITEM.test(line)) {
        flushParagraph();
        if (!list || list.type !== 'ol') {
          flushList();
          list = { type: 'ol', items: [] };
        }
        list.items.push(parseInline(line.replace(ORDERED_ITEM, '')));
        continue;
      }
      if (HEADING.test(line) && !paragraph.length && !list) {
        blocks.push({ type: 'heading', tokens: parseInline(line.replace(HEADING, '')) });
        continue;
      }
      flushList();
      paragraph.push(line);
    }
    flushParagraph();
    flushList();
    return blocks;
  }

  return { parseBlocks, parseInline };
});

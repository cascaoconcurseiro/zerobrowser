const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Library, BAR_ID, OTHER_ID } = require('../src/main/library');

test('favoritos: criar, mover, renomear e remover mantém a árvore em ordem', () => {
  const lib = new Library();
  const a = lib.bookmarks.create({ parentId: BAR_ID, title: 'A', url: 'https://a.com/' });
  const folder = lib.bookmarks.create({ parentId: BAR_ID, title: 'Pasta' });
  const b = lib.bookmarks.create({ parentId: BAR_ID, title: 'B', url: 'https://b.com/', index: 0 });
  assert.deepStrictEqual(lib.bookmarks.getChildren(BAR_ID).map((n) => n.title), ['B', 'A', 'Pasta']);

  lib.bookmarks.move(a.id, { parentId: folder.id });
  assert.deepStrictEqual(lib.bookmarks.getChildren(BAR_ID).map((n) => [n.title, n.index]), [['B', 0], ['Pasta', 1]]);
  assert.strictEqual(lib.bookmarks.getChildren(folder.id)[0].url, 'https://a.com/');
  assert.throws(() => lib.bookmarks.move(folder.id, { parentId: folder.id }));

  lib.bookmarks.update(b.id, { title: 'Bê' });
  assert.strictEqual(lib.bookmarks.get(b.id)[0].title, 'Bê');
  assert.ok(lib.bookmarks.isBookmarked('https://a.com/'));

  lib.bookmarks.remove(folder.id);
  assert.ok(!lib.bookmarks.isBookmarked('https://a.com/'));
  const tree = lib.bookmarks.getTree()[0];
  assert.deepStrictEqual(tree.children.map((n) => n.folderType), ['bookmarks-bar', 'other']);
  assert.throws(() => lib.bookmarks.remove(OTHER_ID));
  lib.close();
});

test('histórico: conta visitas, busca por texto e apaga por intervalo', () => {
  const lib = new Library();
  const now = Date.now();
  lib.history.add({ url: 'https://exemplo.com/', title: 'Exemplo', time: now - 1000 });
  lib.history.add({ url: 'https://exemplo.com/', transition: 'typed', time: now });
  lib.history.add({ url: 'https://outro.org/docs', title: 'Documentação', time: now - 3 * 86400000 });
  assert.strictEqual(lib.history.add({ url: 'about:blank' }), null);

  const [item] = lib.history.search({ text: 'exemplo' });
  assert.strictEqual(item.visitCount, 2);
  assert.strictEqual(item.typedCount, 1);
  assert.strictEqual(item.title, 'Exemplo');
  assert.strictEqual(lib.history.search({}).length, 1, 'sem texto: só as últimas 24 horas');
  assert.strictEqual(lib.history.search({ text: 'docs' }).length, 1);

  lib.history.deleteRange({ startTime: now - 4 * 86400000, endTime: now - 86400000 });
  assert.strictEqual(lib.history.search({ text: 'docs' }).length, 0);
  lib.history.deleteAll();
  assert.strictEqual(lib.history.search({ text: 'exemplo' }).length, 0);
  lib.close();
});

test('busca da biblioteca ignora acentos e diferenças de caixa em português', () => {
  const lib = new Library();
  lib.history.add({ url: 'https://example.test/', title: 'SÃO PAULO' });
  lib.bookmarks.create({ title: 'Ação e Cidadania', url: 'https://example.test/acao' });

  assert.equal(lib.history.search({ text: 'sao paulo' }).length, 1);
  assert.equal(lib.history.search({ text: 'SÃO' }).length, 1);
  assert.equal(lib.bookmarks.search({ query: 'acao cidadania' }).length, 1);
  assert.equal(lib.bookmarks.search({ query: 'AÇÃO' }).length, 1);
  lib.close();
});

test('histórico e favoritos persistem depois de fechar e reabrir o SQLite', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zero-library-reopen-'));
  const dbPath = path.join(dir, 'biblioteca.sqlite');
  try {
    const beforeRestart = new Library(dbPath);
    beforeRestart.history.add({ url: 'https://example.test/sao-paulo', title: 'SÃO PAULO' });
    beforeRestart.bookmarks.create({ parentId: BAR_ID, title: 'Ação', url: 'https://example.test/acao' });
    beforeRestart.close();

    const afterRestart = new Library(dbPath);
    assert.equal(afterRestart.history.search({ text: 'sao paulo' })[0]?.title, 'SÃO PAULO');
    assert.equal(afterRestart.bookmarks.search({ query: 'acao' })[0]?.title, 'Ação');
    afterRestart.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('sugestões: favorito e site que começa com o texto vêm primeiro', () => {
  const lib = new Library();
  lib.history.add({ url: 'https://blog.com/github-dicas', title: 'Dicas' });
  lib.history.add({ url: 'https://github.com/', title: 'GitHub' });
  lib.bookmarks.create({ title: 'Docs do GitHub', url: 'https://docs.github.com/' });
  const list = lib.suggest('github');
  assert.strictEqual(list[0].url, 'https://github.com/');
  assert.ok(list.some((s) => s.kind === 'bookmark'));
  assert.strictEqual(new Set(list.map((s) => s.url)).size, list.length);
  lib.close();
});

test('importação: HTML do Chrome e JSON do Chromium sem duplicar URLs', () => {
  const { parseBookmarksHtml, parseChromiumBookmarks, importTree } = require('../src/main/library/import');
  const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p>
    <DT><H3 PERSONAL_TOOLBAR_FOLDER="true">Barra de favoritos</H3>
    <DL><p><DT><A HREF="https://a.com/" ADD_DATE="1700000000">A &amp; cia</A>
      <DT><H3>Trabalho</H3><DL><p><DT><A HREF="https://b.com/">B</A></DL><p>
    </DL><p>
    <DT><A HREF="https://c.com/">C</A>
    <DT><A HREF="javascript:alert(1)">ruim</A>
  </DL>`;
  const tree = parseBookmarksHtml(html);
  assert.deepStrictEqual(tree.bar.map((n) => n.title), ['A & cia', 'Trabalho']);
  assert.strictEqual(tree.bar[1].children[0].url, 'https://b.com/');
  assert.deepStrictEqual(tree.other.map((n) => n.url), ['https://c.com/']);

  const lib = new Library();
  assert.deepStrictEqual(importTree(lib, tree, 'teste'), { added: 3, skipped: 0 });
  assert.strictEqual(lib.bookmarks.getChildren(BAR_ID).length, 2);
  const json = JSON.stringify({ roots: { bookmark_bar: { children: [{ type: 'url', name: 'A', url: 'https://a.com/', date_added: '13300000000000000' }] }, other: { children: [{ type: 'url', name: 'D', url: 'https://d.com/' }] } } });
  assert.deepStrictEqual(importTree(lib, parseChromiumBookmarks(json), 'Brave'), { added: 1, skipped: 1 });
  lib.close();
});

test('ícones: favorito usa o ícone do mesmo site visto no histórico; esquemas estranhos são ignorados', () => {
  const lib = new Library();
  lib.history.add({ url: 'https://site.com/pagina', title: 'Página' });
  lib.history.setFavicon('https://site.com/pagina', 'https://site.com/favicon.ico');
  lib.history.add({ url: 'https://outro.com/', title: 'Outro' });
  lib.history.setFavicon('https://outro.com/', 'javascript:alert(1)');
  const node = lib.bookmarks.create({ parentId: BAR_ID, title: 'Site', url: 'https://site.com/' });
  assert.strictEqual(node.favicon, 'https://site.com/favicon.ico');
  assert.strictEqual(lib.suggest('outro')[0].favicon, null);
  lib.close();
});

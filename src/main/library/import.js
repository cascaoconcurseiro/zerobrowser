// Importa favoritos de outros navegadores para a Library. Lê só o arquivo "Bookmarks" (JSON) de cada perfil
// Chromium, ou um HTML exportado (formato Netscape, usado por todos os navegadores). Senhas e cookies não são lidos.
const fs = require('fs');
const path = require('path');
const os = require('os');

function chromiumSources() {
  const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  const browsers = [
    ['Brave', path.join(local, 'BraveSoftware', 'Brave-Browser', 'User Data')],
    ['Chrome', path.join(local, 'Google', 'Chrome', 'User Data')],
    ['Edge', path.join(local, 'Microsoft', 'Edge', 'User Data')]
  ];
  const sources = [];
  for (const [browser, userData] of browsers) {
    let profiles = [];
    try {
      profiles = fs.readdirSync(userData).filter((name) => name === 'Default' || /^Profile \d+$/.test(name));
    } catch {
      continue;
    }
    for (const profile of profiles) {
      const file = path.join(userData, profile, 'Bookmarks');
      if (fs.existsSync(file)) sources.push({ id: `${browser}:${profile}`, browser, profile, file });
    }
  }
  return sources;
}

// Converte o JSON do Chromium em nós { title, url?, children? }.
function parseChromiumBookmarks(text) {
  const data = JSON.parse(text);
  const convert = (node) => (node.type === 'url'
    ? { title: node.name || node.url, url: node.url, dateAdded: chromeTime(node.date_added) }
    : { title: node.name || '', children: (node.children || []).map(convert) });
  const roots = data.roots || {};
  return {
    bar: roots.bookmark_bar ? convert(roots.bookmark_bar).children : [],
    other: [roots.other, roots.synced].filter(Boolean).flatMap((root) => convert(root).children)
  };
}

// O Chromium guarda datas em microssegundos desde 1601.
function chromeTime(value) {
  const micros = Number(value);
  return micros ? Math.round(micros / 1000 - 11644473600000) : Date.now();
}

function decodeEntities(text) {
  return text.replace(/&(amp|lt|gt|quot|#39|#(\d+));/g, (_, name, code) => (code ? String.fromCharCode(Number(code))
    : { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" }[name]));
}

// Formato Netscape: <DT><H3>Pasta</H3><DL>...</DL> e <DT><A HREF="...">Título</A>.
function parseBookmarksHtml(html) {
  const root = { title: '', children: [] };
  const stack = [root];
  let pendingFolder = null;
  const tokens = html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>|<a\s([^>]*)>([\s\S]*?)<\/a>|<dl[^>]*>|<\/dl>/gi);
  for (const [token, folderTitle, attrs, linkTitle] of tokens) {
    const current = stack[stack.length - 1];
    if (folderTitle !== undefined) {
      pendingFolder = { title: decodeEntities(folderTitle.trim()), children: [] };
      current.children.push(pendingFolder);
    } else if (attrs !== undefined) {
      const href = /href\s*=\s*"([^"]*)"/i.exec(attrs)?.[1];
      const added = /add_date\s*=\s*"(\d+)"/i.exec(attrs)?.[1];
      if (href && /^https?:/i.test(href)) {
        current.children.push({ title: decodeEntities(linkTitle.replace(/<[^>]+>/g, '').trim()) || href, url: decodeEntities(href), dateAdded: added ? Number(added) * 1000 : Date.now() });
      }
    } else if (/^<dl/i.test(token)) {
      if (pendingFolder) { stack.push(pendingFolder); pendingFolder = null; }
    } else if (stack.length > 1) {
      stack.pop();
    }
  }
  // Exportações do Chrome/Brave/Edge têm a barra de favoritos como primeira pasta de topo.
  const barIndex = root.children.findIndex((node) => node.children && /barra de favoritos|bookmarks bar|favorites bar/i.test(node.title));
  if (barIndex >= 0) {
    const [bar] = root.children.splice(barIndex, 1);
    return { bar: bar.children, other: root.children };
  }
  return { bar: [], other: root.children };
}

// Grava a árvore numa pasta "Importados de X" dentro de Outros favoritos, pulando URLs que já existem.
function importTree(library, tree, label) {
  const { BAR_ID, OTHER_ID } = require('./index');
  let added = 0;
  let skipped = 0;
  const insert = (nodes, parentId) => {
    for (const node of nodes) {
      if (node.url) {
        if (library.bookmarks.isBookmarked(node.url)) { skipped += 1; continue; }
        library.bookmarks.create({ parentId, title: node.title, url: node.url });
        added += 1;
      } else if (node.children?.length) {
        const folder = library.bookmarks.create({ parentId, title: node.title || 'Pasta' });
        insert(node.children, folder.id);
      }
    }
  };
  library.transaction(() => {
    // A barra vai para a barra do Zero Browser só se ela estiver vazia; senão, para dentro da pasta importada.
    const barEmpty = library.bookmarks.getChildren(BAR_ID).length === 0;
    const container = library.bookmarks.create({ parentId: OTHER_ID, title: `Importados de ${label}` });
    if (barEmpty) insert(tree.bar, BAR_ID);
    else if (tree.bar.length) insert([{ title: 'Barra de favoritos', children: tree.bar }], container.id);
    insert(tree.other, container.id);
    if (library.bookmarks.getChildren(container.id).length === 0) library.bookmarks.remove(container.id);
  });
  return { added, skipped };
}

function importFromSource(library, source) {
  const tree = parseChromiumBookmarks(fs.readFileSync(source.file, 'utf8'));
  const label = source.profile === 'Default' ? source.browser : `${source.browser} (${source.profile})`;
  return importTree(library, tree, label);
}

function importFromHtmlFile(library, file) {
  return importTree(library, parseBookmarksHtml(fs.readFileSync(file, 'utf8')), path.basename(file));
}

module.exports = { chromiumSources, parseChromiumBookmarks, parseBookmarksHtml, importTree, importFromSource, importFromHtmlFile };

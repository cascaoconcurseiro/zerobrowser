// Favoritos e histórico do Zero Browser num SQLite local (node:sqlite, embutido no Electron). O formato dos nós segue
// o chrome.bookmarks / chrome.history, para servir tanto a interface quanto o Flame sem conversão.
const { DatabaseSync } = require('node:sqlite');

const ROOT_ID = 0;
const BAR_ID = 1;
const OTHER_ID = 2;
const SKIPPED_SCHEMES = /^(about|chrome-extension|chrome|devtools|navegante|data|blob|file|javascript):/i;

class Library {
  constructor(dbPath = ':memory:') {
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS bookmarks (
        id INTEGER PRIMARY KEY,
        parent_id INTEGER,
        position INTEGER NOT NULL DEFAULT 0,
        title TEXT NOT NULL DEFAULT '',
        url TEXT,
        date_added INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS bookmarks_parent ON bookmarks(parent_id, position);
      CREATE INDEX IF NOT EXISTS bookmarks_url ON bookmarks(url);
      CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY,
        url TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL DEFAULT '',
        visit_count INTEGER NOT NULL DEFAULT 0,
        typed_count INTEGER NOT NULL DEFAULT 0,
        last_visit INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS history_last_visit ON history(last_visit);
      CREATE TABLE IF NOT EXISTS visits (
        id INTEGER PRIMARY KEY,
        history_id INTEGER NOT NULL,
        visit_time INTEGER NOT NULL,
        transition TEXT NOT NULL DEFAULT 'link'
      );
      CREATE INDEX IF NOT EXISTS visits_history ON visits(history_id, visit_time);
    `);
    // Ícone do site, lembrado das visitas (bancos criados antes desta coluna ganham ela aqui).
    const historyColumns = this.db.prepare('PRAGMA table_info(history)').all().map((c) => c.name);
    if (!historyColumns.includes('favicon')) this.db.exec('ALTER TABLE history ADD COLUMN favicon TEXT');
    const now = Date.now();
    const insertRoot = this.db.prepare('INSERT OR IGNORE INTO bookmarks (id, parent_id, position, title, date_added) VALUES (?, ?, ?, ?, ?)');
    insertRoot.run(ROOT_ID, null, 0, '', now);
    insertRoot.run(BAR_ID, ROOT_ID, 0, 'Barra de favoritos', now);
    insertRoot.run(OTHER_ID, ROOT_ID, 1, 'Outros favoritos', now);
    this.listeners = new Set();
    this.bookmarks = this.createBookmarksApi();
    this.history = this.createHistoryApi();
  }

  // Avisa quem mostra favoritos/histórico (interface e Flame) quando algo muda.
  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  changed(area, event, payload) {
    for (const listener of this.listeners) {
      try { listener(area, event, payload); } catch {}
    }
  }

  close() {
    this.db.close();
  }

  // --- Favoritos -------------------------------------------------------------------------------------------

  row(id) {
    return this.db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(Number(id));
  }

  node(row) {
    const node = { id: String(row.id), title: row.title, dateAdded: row.date_added };
    if (row.parent_id !== null) {
      node.parentId = String(row.parent_id);
      node.index = row.position;
    }
    if (row.url) {
      node.url = row.url;
      const icon = this.faviconFor(row.url);
      if (icon) node.favicon = icon;
    }
    else if (row.id === BAR_ID) node.folderType = 'bookmarks-bar';
    else if (row.id === OTHER_ID) node.folderType = 'other';
    return node;
  }

  // Mesmo endereço ou, se não houver, qualquer página visitada do mesmo site.
  faviconFor(url) {
    const exact = this.db.prepare('SELECT favicon FROM history WHERE url = ? AND favicon IS NOT NULL').get(url);
    if (exact) return exact.favicon;
    let origin;
    try { origin = new URL(url).origin; } catch { return null; }
    return this.db.prepare("SELECT favicon FROM history WHERE url LIKE ? AND favicon IS NOT NULL ORDER BY last_visit DESC LIMIT 1").get(`${origin}/%`)?.favicon || null;
  }

  children(id) {
    return this.db.prepare('SELECT * FROM bookmarks WHERE parent_id = ? ORDER BY position, id').all(Number(id));
  }

  subtree(row) {
    const node = this.node(row);
    if (!row.url) node.children = this.children(row.id).map((child) => this.subtree(child));
    return node;
  }

  requireFolder(id) {
    const folder = this.row(id);
    if (!folder || folder.url) throw new Error(`Pasta de favoritos não encontrada: ${id}`);
    return folder;
  }

  // Reescreve as posições de uma pasta em ordem 0..n, colocando `movedId` em `index`.
  reorder(parentId, movedId, index) {
    const ids = this.children(parentId).map((r) => r.id).filter((id) => id !== movedId);
    const at = index === undefined || index === null ? ids.length : Math.max(0, Math.min(Number(index), ids.length));
    if (movedId !== undefined) ids.splice(at, 0, movedId);
    const update = this.db.prepare('UPDATE bookmarks SET position = ?, parent_id = ? WHERE id = ?');
    ids.forEach((id, position) => update.run(position, Number(parentId), id));
  }

  createBookmarksApi() {
    const lib = this;
    return {
      getTree: () => [lib.subtree(lib.row(ROOT_ID))],
      get: (ids) => (Array.isArray(ids) ? ids : [ids]).map((id) => {
        const row = lib.row(id);
        if (!row) throw new Error(`Favorito não encontrado: ${id}`);
        return lib.node(row);
      }),
      getChildren: (id) => lib.children(id).map((row) => lib.node(row)),
      getSubTree: (id) => {
        const row = lib.row(id);
        if (!row) throw new Error(`Favorito não encontrado: ${id}`);
        return [lib.subtree(row)];
      },
      getRecent: (count = 10) => lib.db.prepare('SELECT * FROM bookmarks WHERE url IS NOT NULL ORDER BY date_added DESC, id DESC LIMIT ?')
        .all(Math.max(1, Number(count) || 10)).map((row) => lib.node(row)),
      search: (query) => {
        const q = typeof query === 'string' ? { query } : query || {};
        const clauses = ['url IS NOT NULL'];
        const params = [];
        if (q.url) { clauses.push('url = ?'); params.push(q.url); }
        if (q.title) { clauses.push('title = ?'); params.push(q.title); }
        for (const word of String(q.query || '').toLowerCase().split(/\s+/).filter(Boolean)) {
          clauses.push('(lower(title) LIKE ? OR lower(url) LIKE ?)');
          params.push(`%${word}%`, `%${word}%`);
        }
        return lib.db.prepare(`SELECT * FROM bookmarks WHERE ${clauses.join(' AND ')} ORDER BY date_added DESC LIMIT 200`).all(...params).map((row) => lib.node(row));
      },
      create: ({ parentId = OTHER_ID, index, title = '', url } = {}) => {
        lib.requireFolder(parentId);
        const result = lib.db.prepare('INSERT INTO bookmarks (parent_id, position, title, url, date_added) VALUES (?, ?, ?, ?, ?)')
          .run(Number(parentId), 1e9, String(title), url ? String(url) : null, Date.now());
        const id = Number(result.lastInsertRowid);
        lib.reorder(parentId, id, index);
        const node = lib.node(lib.row(id));
        lib.changed('bookmarks', 'onCreated', [node.id, node]);
        return node;
      },
      update: (id, changes = {}) => {
        const row = lib.row(id);
        if (!row || row.parent_id === null || row.id === BAR_ID || row.id === OTHER_ID) throw new Error('Este favorito não pode ser alterado');
        const title = changes.title !== undefined ? String(changes.title) : row.title;
        const url = row.url && changes.url !== undefined ? String(changes.url) : row.url;
        lib.db.prepare('UPDATE bookmarks SET title = ?, url = ? WHERE id = ?').run(title, url, row.id);
        const node = lib.node(lib.row(id));
        lib.changed('bookmarks', 'onChanged', [node.id, { title: node.title, url: node.url }]);
        return node;
      },
      move: (id, { parentId, index } = {}) => {
        const row = lib.row(id);
        if (!row || row.id <= OTHER_ID) throw new Error('Este favorito não pode ser movido');
        const target = parentId !== undefined ? Number(parentId) : row.parent_id;
        lib.requireFolder(target);
        for (let cursor = lib.row(target); cursor; cursor = cursor.parent_id === null ? null : lib.row(cursor.parent_id)) {
          if (cursor.id === row.id) throw new Error('Não dá para mover uma pasta para dentro dela mesma');
        }
        const oldParent = row.parent_id;
        lib.reorder(target, row.id, index);
        if (oldParent !== target) lib.reorder(oldParent);
        const node = lib.node(lib.row(id));
        lib.changed('bookmarks', 'onMoved', [node.id, { parentId: node.parentId, index: node.index, oldParentId: String(oldParent) }]);
        return node;
      },
      remove: (id) => {
        const row = lib.row(id);
        if (!row || row.id <= OTHER_ID) throw new Error('Este favorito não pode ser removido');
        const removeTree = (rowId) => {
          for (const child of lib.children(rowId)) removeTree(child.id);
          lib.db.prepare('DELETE FROM bookmarks WHERE id = ?').run(rowId);
        };
        removeTree(row.id);
        lib.reorder(row.parent_id);
        lib.changed('bookmarks', 'onRemoved', [String(row.id), { parentId: String(row.parent_id), index: row.position }]);
      },
      isBookmarked: (url) => Boolean(url && lib.db.prepare('SELECT 1 FROM bookmarks WHERE url = ? LIMIT 1').get(String(url))),
      findByUrl: (url) => lib.db.prepare('SELECT * FROM bookmarks WHERE url = ?').all(String(url)).map((row) => lib.node(row))
    };
  }

  // --- Histórico -------------------------------------------------------------------------------------------

  historyItem(row) {
    return { id: String(row.id), url: row.url, title: row.title, lastVisitTime: row.last_visit, visitCount: row.visit_count, typedCount: row.typed_count };
  }

  createHistoryApi() {
    const lib = this;
    return {
      // Chamado a cada navegação da página principal de uma aba.
      add: ({ url, title = '', transition = 'link', time = Date.now() } = {}) => {
        if (!url || SKIPPED_SCHEMES.test(url)) return null;
        const typed = transition === 'typed' ? 1 : 0;
        lib.db.prepare(`INSERT INTO history (url, title, visit_count, typed_count, last_visit) VALUES (?, ?, 1, ?, ?)
          ON CONFLICT(url) DO UPDATE SET visit_count = visit_count + 1, typed_count = typed_count + excluded.typed_count,
          last_visit = MAX(last_visit, excluded.last_visit), title = CASE WHEN excluded.title <> '' THEN excluded.title ELSE title END`)
          .run(url, String(title), typed, time);
        const row = lib.db.prepare('SELECT * FROM history WHERE url = ?').get(url);
        lib.db.prepare('INSERT INTO visits (history_id, visit_time, transition) VALUES (?, ?, ?)').run(row.id, time, transition);
        const item = lib.historyItem(row);
        lib.changed('history', 'onVisited', [item]);
        return item;
      },
      setFavicon: (url, favicon) => {
        if (!url || !/^(https?:|data:image\/)/i.test(String(favicon || ''))) return;
        lib.db.prepare('UPDATE history SET favicon = ? WHERE url = ?').run(String(favicon).slice(0, 4096), url);
      },
      setTitle: (url, title) => {
        if (!url || !title) return;
        lib.db.prepare('UPDATE history SET title = ? WHERE url = ?').run(String(title), url);
      },
      search: ({ text = '', startTime, endTime, maxResults = 100 } = {}) => {
        const clauses = [];
        const params = [];
        // Como no Chrome: sem texto e sem startTime, só as últimas 24 horas.
        const start = startTime ?? (text ? 0 : Date.now() - 24 * 3600 * 1000);
        clauses.push('last_visit >= ?');
        params.push(start);
        if (endTime !== undefined) { clauses.push('last_visit <= ?'); params.push(endTime); }
        for (const word of String(text).toLowerCase().split(/\s+/).filter(Boolean)) {
          clauses.push('(lower(title) LIKE ? OR lower(url) LIKE ?)');
          params.push(`%${word}%`, `%${word}%`);
        }
        const limit = maxResults === 0 ? -1 : Math.max(1, Number(maxResults) || 100);
        return lib.db.prepare(`SELECT * FROM history WHERE ${clauses.join(' AND ')} ORDER BY last_visit DESC LIMIT ?`)
          .all(...params, limit).map((row) => lib.historyItem(row));
      },
      getVisits: (url) => {
        const row = lib.db.prepare('SELECT id FROM history WHERE url = ?').get(String(url));
        if (!row) return [];
        return lib.db.prepare('SELECT * FROM visits WHERE history_id = ? ORDER BY visit_time DESC LIMIT 500').all(row.id)
          .map((v) => ({ id: String(row.id), visitId: String(v.id), visitTime: v.visit_time, transition: v.transition }));
      },
      deleteUrl: (url) => {
        const row = lib.db.prepare('SELECT id FROM history WHERE url = ?').get(String(url));
        if (!row) return;
        lib.db.prepare('DELETE FROM visits WHERE history_id = ?').run(row.id);
        lib.db.prepare('DELETE FROM history WHERE id = ?').run(row.id);
        lib.changed('history', 'onVisitRemoved', [{ allHistory: false, urls: [url] }]);
      },
      deleteRange: ({ startTime = 0, endTime = Date.now() } = {}) => {
        lib.db.prepare('DELETE FROM visits WHERE visit_time BETWEEN ? AND ?').run(startTime, endTime);
        // Recalcula quem ainda tem visitas fora do intervalo; quem ficou sem nenhuma sai do histórico.
        lib.db.exec(`DELETE FROM history WHERE id NOT IN (SELECT DISTINCT history_id FROM visits);
          UPDATE history SET visit_count = (SELECT COUNT(*) FROM visits WHERE history_id = history.id),
          last_visit = (SELECT MAX(visit_time) FROM visits WHERE history_id = history.id);`);
        lib.changed('history', 'onVisitRemoved', [{ allHistory: false, urls: [] }]);
      },
      deleteAll: () => {
        lib.db.exec('DELETE FROM visits; DELETE FROM history;');
        lib.changed('history', 'onVisitRemoved', [{ allHistory: true, urls: [] }]);
      }
    };
  }

  // Sugestões da barra de endereço: favoritos primeiro, depois histórico por frequência e recência.
  suggest(text, limit = 8) {
    const words = String(text || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const where = words.map(() => '(lower(title) LIKE ? OR lower(url) LIKE ?)').join(' AND ');
    const params = words.flatMap((w) => [`%${w}%`, `%${w}%`]);
    const bookmarks = this.db.prepare(`SELECT title, url FROM bookmarks WHERE url IS NOT NULL AND ${where} LIMIT ?`).all(...params, limit)
      .map((row) => ({ kind: 'bookmark', title: row.title, url: row.url, favicon: this.faviconFor(row.url) }));
    const now = Date.now();
    const history = this.db.prepare(`SELECT title, url, favicon, visit_count, typed_count, last_visit FROM history WHERE ${where}
      ORDER BY (visit_count + typed_count * 2) * 1.0 / (1 + (? - last_visit) / 86400000.0) DESC LIMIT ?`).all(...params, now, limit * 2)
      .map((row) => ({ kind: 'history', title: row.title, url: row.url, favicon: row.favicon || this.faviconFor(row.url) }));
    const seen = new Set();
    const first = words[0];
    // Quem começa com o que foi digitado (sem esquema e www) sobe para o topo, como a barra do Chrome.
    const startsWith = (url) => url.replace(/^https?:\/\/(www\.)?/i, '').toLowerCase().startsWith(first);
    return [...bookmarks, ...history]
      .filter((item) => (seen.has(item.url) ? false : seen.add(item.url)))
      .sort((a, b) => Number(startsWith(b.url)) - Number(startsWith(a.url)))
      .slice(0, limit);
  }

  // Inserção em lote numa transação (importação).
  transaction(fn) {
    this.db.exec('BEGIN');
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
}

module.exports = { Library, BAR_ID, OTHER_ID, ROOT_ID };

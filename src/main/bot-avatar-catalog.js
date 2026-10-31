const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const SPRITE_COLUMNS = 10;
const SPRITE_ROWS = 10;
// Paleta de 8 tons dessaturados com contraste >= 3:1 contra fundos claros (#ffffff, #f3f4f2) e escuros (#202321, #282c29).
const BOT_ACCENT_PALETTE = [
  '#168f72',
  '#2480d2',
  '#8966d4',
  '#c65684',
  '#c5623f',
  '#668730',
  '#1a879d',
  '#a17522'
];
const BOT_STATE_COLORS = {
  attention: '#a86f14',
  error: '#cc4b43',
  paused: '#757d78'
};
// 24 símbolos simples de 1 traço (PLANO_DESIGN_UX.md §11b).
const BOT_STROKE_SYMBOLS = [
  { id: 'search', label: 'Busca', path: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.3-4.3' },
  { id: 'cart', label: 'Carrinho', path: 'M6 6h15l-1.5 9h-11L6 4H3m6 16a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm8 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z' },
  { id: 'chart', label: 'Gráfico', path: 'M4 19h16M7 15v-4m5 4V7m5 8v-6' },
  { id: 'mail', label: 'E-mail', path: 'M4 6h16v12H4V6Zm0 2 8 5 8-5' },
  { id: 'calendar', label: 'Agenda', path: 'M4 7h16v13H4V7Zm4-3v4m8-4v4M4 11h16' },
  { id: 'bell', label: 'Alerta', path: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9Zm-4.3 13a2 2 0 0 1-3.4 0' },
  { id: 'book', label: 'Leitura', path: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5V5a2 2 0 0 1 2-2h14v17H6.5' },
  { id: 'shield', label: 'Segurança', path: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z' },
  { id: 'bolt', label: 'Rápido', path: 'M13 2 3 14h9l-1 8 10-12h-9l1-8Z' },
  { id: 'globe', label: 'Web', path: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20Z' },
  { id: 'tag', label: 'Preço', path: 'M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8ZM7 7h.01' },
  { id: 'clock', label: 'Rotina', path: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-14v4l3 2' },
  { id: 'folder', label: 'Arquivo', path: 'M3 7v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-7l-2-2H5a2 2 0 0 0-2 2Z' },
  { id: 'code', label: 'Código', path: 'm16 18 6-6-6-6M8 6l-6 6 6 6' },
  { id: 'terminal', label: 'Console', path: 'm4 17 6-6-6-6m8 14h8' },
  { id: 'database', label: 'Dados', path: 'M12 8c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3Zm8 4c0 1.7-3.6 3-8 3s-8-1.3-8-3m16-7v14c0 1.7-3.6 3-8 3s-8-1.3-8-3V5' },
  { id: 'compass', label: 'Explorar', path: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm4.2-14.2-2.1 6.3-6.3 2.1 2.1-6.3 6.3-2.1Z' },
  { id: 'briefcase', label: 'Trabalho', path: 'M4 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Zm4 0V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' },
  { id: 'heart', label: 'Saúde', path: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8Z' },
  { id: 'star', label: 'Destaque', path: 'm12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1L12 2Z' },
  { id: 'home', label: 'Casa', path: 'm3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Zm6 13V12h6v10' },
  { id: 'filter', label: 'Filtro', path: 'M22 3H2l8 9.5V19l4 2v-8.5L22 3Z' },
  { id: 'clipboard', label: 'Recibo', path: 'M9 4h6v3H9V4ZM6 6h3v1h6V6h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z' },
  { id: 'focus', label: 'Foco', path: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-7v3m0 17v3m10-12h-3M5 12H2' },
  { id: 'key', label: 'Chave', path: 'M7 14a5 5 0 1 1 3.9-1.9L22 23m-4-4 2-2m-5-1 2-2' }
];

function formatBotInitials(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'BT';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function suggestNextFreeBotIdentity(existingBots = []) {
  const usedPairs = new Set();
  for (const bot of existingBots || []) {
    const symbolId = bot?.symbolId || bot?.avatar?.symbolId;
    const accent = bot?.accent || bot?.avatar?.accent;
    if (symbolId && accent) usedPairs.add(`${symbolId}::${accent.toLowerCase()}`);
  }
  for (let i = 0; i < BOT_STROKE_SYMBOLS.length * BOT_ACCENT_PALETTE.length; i++) {
    const symbol = BOT_STROKE_SYMBOLS[i % BOT_STROKE_SYMBOLS.length];
    const accent = BOT_ACCENT_PALETTE[Math.floor(i / BOT_STROKE_SYMBOLS.length) % BOT_ACCENT_PALETTE.length];
    const key = `${symbol.id}::${accent.toLowerCase()}`;
    if (!usedPairs.has(key)) {
      return { symbolId: symbol.id, symbolLabel: symbol.label, symbolPath: symbol.path, accent };
    }
  }
  const fallback = BOT_STROKE_SYMBOLS[0];
  return { symbolId: fallback.id, symbolLabel: fallback.label, symbolPath: fallback.path, accent: BOT_ACCENT_PALETTE[0] };
}
const ACCENTS = BOT_ACCENT_PALETTE;
const SHEETS = [
  { id: 'pixel-animals-01', file: 'pixel-animal-atlas-01.png', first: 1 },
  { id: 'pixel-animals-02', file: 'pixel-animal-atlas-02.png', first: 101 }
];

class BotAvatarCatalog {
  constructor(dbPath, assetsPath) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.assetsPath = assetsPath;
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS bot_avatar_sheets (
        id TEXT PRIMARY KEY,
        mime_type TEXT NOT NULL,
        sha256 TEXT NOT NULL,
        image BLOB NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS bot_avatars (
        id TEXT PRIMARY KEY,
        sheet_id TEXT NOT NULL REFERENCES bot_avatar_sheets(id) ON DELETE CASCADE,
        frame_index INTEGER NOT NULL,
        columns_count INTEGER NOT NULL,
        rows_count INTEGER NOT NULL,
        label TEXT NOT NULL,
        accent TEXT NOT NULL,
        UNIQUE(sheet_id, frame_index)
      );
      CREATE TABLE IF NOT EXISTS bot_profiles (
        profile_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        avatar_id TEXT NOT NULL REFERENCES bot_avatars(id),
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS bot_profiles_avatar ON bot_profiles(avatar_id);
    `);
  }

  seed() {
    const upsertSheet = this.db.prepare(`INSERT INTO bot_avatar_sheets(id, mime_type, sha256, image, updated_at)
      VALUES (?, 'image/png', ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET mime_type=excluded.mime_type, sha256=excluded.sha256, image=excluded.image, updated_at=excluded.updated_at`);
    const insertAvatar = this.db.prepare(`INSERT INTO bot_avatars(id, sheet_id, frame_index, columns_count, rows_count, label, accent)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET sheet_id=excluded.sheet_id, frame_index=excluded.frame_index,
        columns_count=excluded.columns_count, rows_count=excluded.rows_count, label=excluded.label, accent=excluded.accent`);

    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const sheet of SHEETS) {
        const image = fs.readFileSync(path.join(this.assetsPath, sheet.file));
        const sha256 = crypto.createHash('sha256').update(image).digest('hex');
        const current = this.db.prepare('SELECT sha256 FROM bot_avatar_sheets WHERE id = ?').get(sheet.id);
        if (!current || current.sha256 !== sha256) upsertSheet.run(sheet.id, sha256, image, Date.now());

        for (let frame = 0; frame < SPRITE_COLUMNS * SPRITE_ROWS; frame++) {
          const number = sheet.first + frame;
          const id = `pixel-${String(number).padStart(3, '0')}`;
          insertAvatar.run(id, sheet.id, frame, SPRITE_COLUMNS, SPRITE_ROWS, `Pixel ${String(number).padStart(3, '0')}`, ACCENTS[frame % ACCENTS.length]);
        }
      }
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
    return this.count();
  }

  count() {
    return Number(this.db.prepare('SELECT COUNT(*) AS total FROM bot_avatars').get().total);
  }

  list() {
    return this.db.prepare(`SELECT id, sheet_id AS sheetId, frame_index AS frameIndex,
      columns_count AS columns, rows_count AS rows, label, accent
      FROM bot_avatars ORDER BY id`).all();
  }

  getAvatar(id) {
    const avatar = this.db.prepare(`SELECT id, sheet_id AS sheetId, frame_index AS frameIndex,
      columns_count AS columns, rows_count AS rows, label, accent FROM bot_avatars WHERE id = ?`).get(String(id)) || null;
    if (!avatar) return null;
    const number = Number(String(avatar.id).match(/(\d+)$/)?.[1]);
    if (Number.isInteger(number) && number > 0) {
      const identityIndex = number - 1;
      const symbol = BOT_STROKE_SYMBOLS[Math.floor(identityIndex / BOT_ACCENT_PALETTE.length) % BOT_STROKE_SYMBOLS.length];
      avatar.symbolId = symbol.id;
      avatar.symbolLabel = symbol.label;
      avatar.symbolPath = symbol.path;
      avatar.accent = BOT_ACCENT_PALETTE[identityIndex % BOT_ACCENT_PALETTE.length];
    }
    return avatar;
  }

  getSheetDataUri(sheetId) {
    const row = this.db.prepare('SELECT mime_type, image FROM bot_avatar_sheets WHERE id = ?').get(String(sheetId));
    if (!row) return null;
    return `data:${row.mime_type};base64,${Buffer.from(row.image).toString('base64')}`;
  }

  assignProfile(profile) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const avatarId = this.assignProfileInTransaction(profile);
      this.db.exec('COMMIT');
      return avatarId;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  assignProfileInTransaction(profile) {
    if (!profile || profile.type !== 'bot' || !/^[a-z0-9-]{1,40}$/.test(String(profile.id))) {
      throw new TypeError('Perfil de Bot inválido para atribuição de avatar');
    }
    const existing = this.db.prepare('SELECT avatar_id FROM bot_profiles WHERE profile_id = ?').get(profile.id);
    const avatarId = existing?.avatar_id || this.db.prepare(`SELECT a.id FROM bot_avatars a
      LEFT JOIN bot_profiles p ON p.avatar_id = a.id
      WHERE p.avatar_id IS NULL ORDER BY a.id LIMIT 1`).get()?.id ||
      this.db.prepare('SELECT id FROM bot_avatars ORDER BY id LIMIT 1').get()?.id;
    if (!avatarId) throw new Error('Catálogo de avatares vazio');
    this.db.prepare(`INSERT INTO bot_profiles(profile_id, name, avatar_id, updated_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(profile_id) DO UPDATE SET name=excluded.name, updated_at=excluded.updated_at`)
      .run(profile.id, String(profile.name).slice(0, 40), avatarId, Date.now());
    return avatarId;
  }

  syncProfiles(profiles) {
    if (!Array.isArray(profiles)) throw new TypeError('A lista de perfis Bot precisa ser uma lista');
    const activeIds = new Set(profiles.filter((profile) => profile?.type === 'bot').map((profile) => String(profile.id)));
    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const profile of profiles) this.assignProfileInTransaction(profile);
      const removeStale = this.db.prepare('DELETE FROM bot_profiles WHERE profile_id = ?');
      for (const { profile_id: profileId } of this.db.prepare('SELECT profile_id FROM bot_profiles').all()) {
        if (!activeIds.has(profileId)) removeStale.run(profileId);
      }
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
    return this.db.prepare(`SELECT profile_id AS id, name, avatar_id AS avatarId FROM bot_profiles ORDER BY name COLLATE NOCASE`).all();
  }

  setProfileAvatar(profileId, avatarId) {
    const profile = this.db.prepare('SELECT profile_id FROM bot_profiles WHERE profile_id = ?').get(String(profileId));
    if (!profile || !this.getAvatar(avatarId)) return false;
    this.db.prepare('UPDATE bot_profiles SET avatar_id = ?, updated_at = ? WHERE profile_id = ?').run(String(avatarId), Date.now(), String(profileId));
    return true;
  }

  close() {
    this.db.close();
  }
}

module.exports = {
  BotAvatarCatalog,
  SPRITE_COLUMNS,
  SPRITE_ROWS,
  BOT_ACCENT_PALETTE,
  BOT_STATE_COLORS,
  BOT_STROKE_SYMBOLS,
  formatBotInitials,
  suggestNextFreeBotIdentity
};

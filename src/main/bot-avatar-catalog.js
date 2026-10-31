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
    return this.db.prepare(`SELECT id, sheet_id AS sheetId, frame_index AS frameIndex,
      columns_count AS columns, rows_count AS rows, label, accent FROM bot_avatars WHERE id = ?`).get(String(id)) || null;
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

module.exports = { BotAvatarCatalog, SPRITE_COLUMNS, SPRITE_ROWS, BOT_ACCENT_PALETTE, BOT_STATE_COLORS };

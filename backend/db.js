const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'sajucat.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// ── 테이블 생성 ──
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    email TEXT,
    nickname TEXT,
    nickname_confirmed INTEGER DEFAULT 0,
    profile_image TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    last_login TEXT DEFAULT (datetime('now')),
    UNIQUE(provider, provider_id)
  );

  CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS saju_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    gender TEXT,
    birth_year INTEGER,
    birth_month INTEGER,
    birth_day INTEGER,
    birth_hour INTEGER,
    birth_city TEXT,
    ilgan TEXT,
    ilji TEXT,
    saju_json TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS user_activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    detail TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    chat_type TEXT NOT NULL,
    profile_key TEXT,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// ── Prepared statements ──
const q = {
  // Users
  findUser: db.prepare('SELECT * FROM users WHERE provider = ? AND provider_id = ?'),
  getUser: db.prepare('SELECT * FROM users WHERE id = ?'),
  createUser: db.prepare('INSERT INTO users (provider, provider_id, email, nickname, profile_image) VALUES (?, ?, ?, ?, ?)'),
  updateLogin: db.prepare("UPDATE users SET last_login = datetime('now'), email = COALESCE(?, email), profile_image = COALESCE(?, profile_image) WHERE id = ?"),
  setNickname: db.prepare('UPDATE users SET nickname = ?, nickname_confirmed = 1 WHERE id = ?'),

  // Sessions
  getSession: db.prepare("SELECT * FROM sessions WHERE sid = ? AND expires > datetime('now')"),
  setSession: db.prepare('INSERT OR REPLACE INTO sessions (sid, user_id, expires) VALUES (?, ?, ?)'),
  deleteSession: db.prepare('DELETE FROM sessions WHERE sid = ?'),
  cleanExpired: db.prepare("DELETE FROM sessions WHERE expires <= datetime('now')"),

  // Saju
  saveSaju: db.prepare('INSERT INTO saju_results (user_id, gender, birth_year, birth_month, birth_day, birth_hour, birth_city, ilgan, ilji, saju_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
  getLatestSaju: db.prepare('SELECT * FROM saju_results WHERE user_id = ? ORDER BY created_at DESC LIMIT 1'),

  // Activity
  logActivity: db.prepare('INSERT INTO user_activity (user_id, action, detail) VALUES (?, ?, ?)'),

  // Chat messages
  saveChat: db.prepare('INSERT INTO chat_messages (user_id, chat_type, profile_key, role, content) VALUES (?, ?, ?, ?, ?)'),
  getChatHistory: db.prepare('SELECT role, content, created_at FROM chat_messages WHERE user_id = ? AND chat_type = ? AND (profile_key = ? OR (profile_key IS NULL AND ? IS NULL)) ORDER BY id ASC'),
  getLastChatProfile: db.prepare('SELECT DISTINCT profile_key FROM chat_messages WHERE user_id = ? AND chat_type = ? AND profile_key IS NOT NULL ORDER BY id DESC LIMIT 1'),
  clearChat: db.prepare('DELETE FROM chat_messages WHERE user_id = ? AND chat_type = ? AND (profile_key = ? OR (profile_key IS NULL AND ? IS NULL))'),
};

module.exports = { db, q };

const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// DB는 server.js에서 주입받음
let db;
function initGuest(database) {
  db = database;

  // 게스트 세션 테이블
  db.exec(`CREATE TABLE IF NOT EXISTS guest_sessions (
    id TEXT PRIMARY KEY,
    created_at TEXT DEFAULT (datetime('now')),
    last_visit TEXT DEFAULT (datetime('now')),
    visit_count INTEGER DEFAULT 1,
    ip TEXT,
    user_agent TEXT,
    gender TEXT,
    birth_year INTEGER,
    birth_month INTEGER,
    birth_day INTEGER,
    birth_hour INTEGER,
    birth_city TEXT,
    longitude REAL,
    saju_json TEXT,
    migrated_to INTEGER DEFAULT NULL
  )`);

  // 행동 추적 테이블 (로그인/비로그인 공용)
  db.exec(`CREATE TABLE IF NOT EXISTS tracking (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    user_id INTEGER,
    action TEXT NOT NULL,
    detail TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  // 인덱스
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tracking_session ON tracking(session_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tracking_user ON tracking(user_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tracking_action ON tracking(action)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_guest_created ON guest_sessions(created_at)`);
}

// 게스트 ID 생성 or 기존 반환
function getOrCreateGuest(req, res) {
  let guestId = req.cookies && req.cookies.guestId;

  if (guestId) {
    // 기존 게스트 — 방문 수 증가
    const row = db.prepare('SELECT id, saju_json FROM guest_sessions WHERE id = ? AND migrated_to IS NULL').get(guestId);
    if (row) {
      db.prepare('UPDATE guest_sessions SET last_visit = datetime(\'now\'), visit_count = visit_count + 1 WHERE id = ?').run(guestId);
      return { guestId, hasSaju: !!row.saju_json, existing: true };
    }
  }

  // 새 게스트
  guestId = crypto.randomUUID();
  const ip = req.headers['x-forwarded-for'] || req.ip || '';
  const ua = (req.headers['user-agent'] || '').substring(0, 300);

  db.prepare('INSERT INTO guest_sessions (id, ip, user_agent) VALUES (?, ?, ?)').run(guestId, ip, ua);

  // 쿠키: 1년, httpOnly
  res.cookie('guestId', guestId, {
    maxAge: 365 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax'
  });

  return { guestId, hasSaju: false, existing: false };
}

// GET /api/guest/init — 첫 진입 시 호출
router.get('/guest/init', (req, res) => {
  try {
    const result = getOrCreateGuest(req, res);
    res.json(result);
  } catch (e) {
    console.error('guest/init error:', e);
    res.status(500).json({ error: 'server error' });
  }
});

// POST /api/guest/save — 사주 결과 저장
router.post('/guest/save', (req, res) => {
  try {
    const guestId = req.cookies && req.cookies.guestId;
    if (!guestId) return res.status(400).json({ error: 'no guest session' });

    const { gender, birthYear, birthMonth, birthDay, birthHour, city, longitude, sajuJson } = req.body;

    db.prepare(`UPDATE guest_sessions SET
      gender = ?, birth_year = ?, birth_month = ?, birth_day = ?,
      birth_hour = ?, birth_city = ?, longitude = ?, saju_json = ?,
      last_visit = datetime('now')
      WHERE id = ?`
    ).run(gender, birthYear, birthMonth, birthDay, birthHour, city, longitude,
      typeof sajuJson === 'string' ? sajuJson : JSON.stringify(sajuJson), guestId);

    res.json({ ok: true });
  } catch (e) {
    console.error('guest/save error:', e);
    res.status(500).json({ error: 'server error' });
  }
});

// GET /api/guest/load — 재방문 시 사주 로드
router.get('/guest/load', (req, res) => {
  try {
    const guestId = req.cookies && req.cookies.guestId;
    if (!guestId) return res.json({ hasSaju: false });

    const row = db.prepare('SELECT * FROM guest_sessions WHERE id = ? AND migrated_to IS NULL').get(guestId);
    if (!row || !row.saju_json) return res.json({ hasSaju: false });

    res.json({
      hasSaju: true,
      gender: row.gender,
      birthYear: row.birth_year,
      birthMonth: row.birth_month,
      birthDay: row.birth_day,
      birthHour: row.birth_hour,
      city: row.birth_city,
      longitude: row.longitude,
      sajuJson: row.saju_json,
      visitCount: row.visit_count
    });
  } catch (e) {
    console.error('guest/load error:', e);
    res.status(500).json({ error: 'server error' });
  }
});

// POST /api/guest/migrate — 로그인 시 게스트→유저 이관
router.post('/guest/migrate', (req, res) => {
  try {
    const guestId = req.cookies && req.cookies.guestId;
    const { userId } = req.body;
    if (!guestId || !userId) return res.status(400).json({ error: 'missing data' });

    db.prepare('UPDATE guest_sessions SET migrated_to = ? WHERE id = ?').run(userId, guestId);
    res.json({ ok: true });
  } catch (e) {
    console.error('guest/migrate error:', e);
    res.status(500).json({ error: 'server error' });
  }
});

// POST /api/track — 행동 추적 (로그인/비로그인 공용)
router.post('/track', (req, res) => {
  try {
    const guestId = req.cookies && req.cookies.guestId;
    const { userId, action, detail } = req.body;

    if (!action) return res.status(400).json({ error: 'action required' });

    db.prepare('INSERT INTO tracking (session_id, user_id, action, detail) VALUES (?, ?, ?, ?)')
      .run(guestId || null, userId || null, action, detail || null);

    res.json({ ok: true });
  } catch (e) {
    // 추적 실패는 silent — UX 방해하지 않음
    res.json({ ok: false });
  }
});

module.exports = { router, initGuest };

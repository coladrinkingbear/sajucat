const express = require('express');
const router = express.Router();
let db;

function initShare(database) {
  db = database;
  db.exec(`
    CREATE TABLE IF NOT EXISTS shared_saju (
      id TEXT PRIMARY KEY,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      form_data TEXT NOT NULL,
      view_count INTEGER DEFAULT 0
    )
  `);
}

// 6자리 짧은 ID 생성
function shortId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let id = '';
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

// POST /api/share — 사주 데이터 저장, 짧은 URL 반환
router.post('/share', (req, res) => {
  try {
    const { form } = req.body;
    if (!form || !form.year || !form.month || !form.day) {
      return res.status(400).json({ error: 'form data required' });
    }

    // 중복 방지: 같은 form 데이터면 기존 ID 반환
    const formJson = JSON.stringify(form);
    const existing = db.prepare('SELECT id FROM shared_saju WHERE form_data = ?').get(formJson);
    if (existing) {
      return res.json({ id: existing.id, url: 'https://sajucat.co.kr/?s=' + existing.id });
    }

    // 새 ID 생성 (충돌 방지 루프)
    let id;
    for (let i = 0; i < 10; i++) {
      id = shortId();
      const dup = db.prepare('SELECT id FROM shared_saju WHERE id = ?').get(id);
      if (!dup) break;
    }

    db.prepare('INSERT INTO shared_saju (id, form_data) VALUES (?, ?)').run(id, formJson);
    res.json({ id, url: 'https://sajucat.co.kr/?s=' + id });
  } catch (e) {
    console.error('share create error:', e);
    res.status(500).json({ error: 'server error' });
  }
});

// GET /api/share/:id — 공유된 사주 데이터 반환
router.get('/share/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM shared_saju WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'not found' });

    // 조회수 증가
    db.prepare('UPDATE shared_saju SET view_count = view_count + 1 WHERE id = ?').run(req.params.id);

    res.json({
      id: row.id,
      form: JSON.parse(row.form_data),
      views: row.view_count + 1,
      created: row.created_at
    });
  } catch (e) {
    console.error('share get error:', e);
    res.status(500).json({ error: 'server error' });
  }
});

module.exports = { router, initShare };

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { q } = require('./db');

// ── Config ──
const COOKIE = 'saju_sid';
const MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30일

const G_ID = process.env.GOOGLE_CLIENT_ID || '';
const G_SEC = process.env.GOOGLE_CLIENT_SECRET || '';
const K_ID = process.env.KAKAO_CLIENT_ID || '';
const K_SEC = process.env.KAKAO_CLIENT_SECRET || '';
const N_ID = process.env.NAVER_CLIENT_ID || '';
const N_SEC = process.env.NAVER_CLIENT_SECRET || '';
const BASE = process.env.BASE_URL || 'https://sajucat.co.kr';

// ── 자동 닉네임 생성 ──
const ADJ = ['춤추는','졸린','배고픈','울고있는','신난','수줍은','용감한','게으른','똑똑한','엉뚱한','귀여운','씩씩한','조용한','활발한','느긋한','재빠른','멋진','깜찍한','당당한','수상한','떠들썩한','느릿느릿','반짝이는','점잖은','장난치는','까칠한','나른한','씩씩한','도도한','천진난만한'];
const ANI = ['고양이','강아지','북극곰','판다','토끼','여우','펭귄','코알라','수달','다람쥐','햄스터','부엉이','돌고래','해달','레서판다','미어캣','알파카','카피바라','너구리','고슴도치','오리너구리','벵갈호랑이','아기사자','점박이물범','아기코끼리'];
function randomNick() {
  return ADJ[Math.floor(Math.random()*ADJ.length)] + ' ' + ANI[Math.floor(Math.random()*ANI.length)];
}

// ── 세션 미들웨어 ──
function sessionMw(req, res, next) {
  const sid = req.cookies?.[COOKIE];
  if (sid) {
    const sess = q.getSession.get(sid);
    if (sess) { req.userId = sess.user_id; req.sid = sid; }
  }
  next();
}

function setCookie(res, sid) {
  res.cookie(COOKIE, sid, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: MAX_AGE, path: '/' });
}

function makeSession(userId) {
  const sid = crypto.randomBytes(32).toString('hex');
  const exp = new Date(Date.now() + MAX_AGE).toISOString();
  q.setSession.run(sid, userId, exp);
  return sid;
}

function loginOrCreate(provider, pid, email, image) {
  let u = q.findUser.get(provider, pid);
  if (u) {
    q.updateLogin.run(email || null, image || null, u.id);
    return { user: q.getUser.get(u.id), isNew: false };
  }
  const nick = randomNick();
  const info = q.createUser.run(provider, pid, email || null, nick, image || null);
  return { user: q.getUser.get(info.lastInsertRowid), isNew: true };
}

// ══════════════════════════════════════
// Google OAuth
// ══════════════════════════════════════
router.get('/google', (req, res) => {
  res.redirect('https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: G_ID, redirect_uri: BASE + '/auth/google/callback',
    response_type: 'code', scope: 'openid email profile', prompt: 'select_account'
  }));
});

router.get('/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.redirect('/?err=no_code');
    const tr = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: G_ID, client_secret: G_SEC, redirect_uri: BASE + '/auth/google/callback', grant_type: 'authorization_code' })
    });
    const tok = await tr.json();
    if (!tok.access_token) return res.redirect('/?err=token');
    const ur = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: 'Bearer ' + tok.access_token } });
    const p = await ur.json();
    const { user, isNew } = loginOrCreate('google', p.id, p.email, p.picture);
    setCookie(res, makeSession(user.id));
    res.redirect(isNew ? '/?login=new' : '/?login=ok');
  } catch (e) { console.error('Google auth:', e.message); res.redirect('/?err=auth'); }
});

// ══════════════════════════════════════
// Kakao OAuth
// ══════════════════════════════════════
router.get('/kakao', (req, res) => {
  res.redirect('https://kauth.kakao.com/oauth/authorize?' + new URLSearchParams({
    client_id: K_ID, redirect_uri: BASE + '/auth/kakao/callback', response_type: 'code'
  }));
});

router.get('/kakao/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.redirect('/?err=no_code');
    const tr = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', client_id: K_ID, client_secret: K_SEC, redirect_uri: BASE + '/auth/kakao/callback', code })
    });
    const tok = await tr.json();
    if (!tok.access_token) return res.redirect('/?err=token');
    const ur = await fetch('https://kapi.kakao.com/v2/user/me', { headers: { Authorization: 'Bearer ' + tok.access_token } });
    const p = await ur.json();
    const { user, isNew } = loginOrCreate('kakao', String(p.id), p.kakao_account?.email, p.properties?.profile_image);
    setCookie(res, makeSession(user.id));
    res.redirect(isNew ? '/?login=new' : '/?login=ok');
  } catch (e) { console.error('Kakao auth:', e.message); res.redirect('/?err=auth'); }
});

// ══════════════════════════════════════
// Naver OAuth
// ══════════════════════════════════════
router.get('/naver', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  res.redirect('https://nid.naver.com/oauth2.0/authorize?' + new URLSearchParams({
    client_id: N_ID, redirect_uri: BASE + '/auth/naver/callback', response_type: 'code', state
  }));
});

router.get('/naver/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code) return res.redirect('/?err=no_code');
    const tr = await fetch('https://nid.naver.com/oauth2.0/token?' + new URLSearchParams({
      grant_type: 'authorization_code', client_id: N_ID, client_secret: N_SEC, code, state
    }));
    const tok = await tr.json();
    if (!tok.access_token) return res.redirect('/?err=token');
    const ur = await fetch('https://openapi.naver.com/v1/nid/me', { headers: { Authorization: 'Bearer ' + tok.access_token } });
    const d = await ur.json();
    const p = d.response;
    const { user, isNew } = loginOrCreate('naver', p.id, p.email, p.profile_image);
    setCookie(res, makeSession(user.id));
    res.redirect(isNew ? '/?login=new' : '/?login=ok');
  } catch (e) { console.error('Naver auth:', e.message); res.redirect('/?err=auth'); }
});

// ══════════════════════════════════════
// API 엔드포인트
// ══════════════════════════════════════

// 현재 로그인 상태 확인
router.get('/me', sessionMw, (req, res) => {
  if (!req.userId) return res.json({ loggedIn: false });
  const u = q.getUser.get(req.userId);
  if (!u) return res.json({ loggedIn: false });
  const saju = q.getLatestSaju.get(req.userId);
  const mansinChat = q.getChatHistory.all(req.userId, 'mansin', null, null);
  const lastYeonin = q.getLastChatProfile.get(req.userId, 'yeonin');
  res.json({
    loggedIn: true,
    user: { id: u.id, nickname: u.nickname, nickConfirmed: !!u.nickname_confirmed, provider: u.provider, image: u.profile_image },
    lastSaju: saju ? { gender: saju.gender, year: saju.birth_year, month: saju.birth_month, day: saju.birth_day, hour: saju.birth_hour, city: saju.birth_city, ilgan: saju.ilgan, ilji: saju.ilji } : null,
    hasMansinChat: mansinChat.length > 0,
    lastYeoninProfile: lastYeonin ? lastYeonin.profile_key : null
  });
});

// 닉네임 설정
router.post('/nickname', sessionMw, express.json(), (req, res) => {
  if (!req.userId) return res.status(401).json({ error: '로그인 필요' });
  const n = (req.body.nickname || '').trim();
  if (!n || n.length > 20) return res.status(400).json({ error: '닉네임 1~20자' });
  q.setNickname.run(n, req.userId);
  res.json({ ok: true, nickname: n });
});

// 사주 결과 저장
router.post('/saju', sessionMw, express.json(), (req, res) => {
  if (!req.userId) return res.status(401).json({ error: '로그인 필요' });
  const { gender, year, month, day, hour, city, ilgan, ilji, data } = req.body;
  q.saveSaju.run(req.userId, gender, year, month, day, hour, city, ilgan, ilji, JSON.stringify(data || {}));
  res.json({ ok: true });
});

// 활동 기록
router.post('/activity', sessionMw, express.json(), (req, res) => {
  if (!req.userId) return res.status(401).json({ error: '로그인 필요' });
  q.logActivity.run(req.userId, req.body.action || '', JSON.stringify(req.body.detail || {}));
  res.json({ ok: true });
});

// 로그아웃
router.post('/logout', sessionMw, (req, res) => {
  if (req.sid) q.deleteSession.run(req.sid);
  res.clearCookie(COOKIE);
  res.json({ ok: true });
});

// 채팅 기록 저장 (배치)
router.post('/chat-save', sessionMw, express.json(), (req, res) => {
  if (!req.userId) return res.status(401).json({ error: '로그인 필요' });
  const { chatType, profileKey, messages } = req.body;
  if (!chatType || !Array.isArray(messages)) return res.status(400).json({ error: 'invalid' });
  const insert = q.saveChat;
  for (const m of messages) {
    insert.run(req.userId, chatType, profileKey || null, m.role, m.content);
  }
  res.json({ ok: true, count: messages.length });
});

// 채팅 기록 불러오기
router.get('/chat-history', sessionMw, (req, res) => {
  if (!req.userId) return res.status(401).json({ error: '로그인 필요' });
  const { chatType, profileKey } = req.query;
  if (!chatType) return res.status(400).json({ error: 'chatType required' });
  const pk = profileKey || null;
  const rows = q.getChatHistory.all(req.userId, chatType, pk, pk);
  res.json({ messages: rows });
});

// 마지막 인연 프로필
router.get('/chat-last-profile', sessionMw, (req, res) => {
  if (!req.userId) return res.status(401).json({ error: '로그인 필요' });
  const row = q.getLastChatProfile.get(req.userId, 'yeonin');
  res.json({ profileKey: row ? row.profile_key : null });
});

// 채팅 초기화
router.post('/chat-clear', sessionMw, express.json(), (req, res) => {
  if (!req.userId) return res.status(401).json({ error: '로그인 필요' });
  const { chatType, profileKey } = req.body;
  const pk = profileKey || null;
  q.clearChat.run(req.userId, chatType, pk, pk);
  res.json({ ok: true });
});

// 랜덤 닉네임 새로 받기
router.get('/random-nick', (req, res) => {
  res.json({ nickname: randomNick() });
});

module.exports = { router, sessionMw };

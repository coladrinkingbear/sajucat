require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: true, credentials: true }));
app.set('trust proxy', 1);
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

// DB init — db.js의 단일 커넥션 공유 (guest/share 테이블도 같은 backend/sajucat.db에 생성)
const { db } = require('./db');

// Rate limiters
app.use('/api/enrich', rateLimit({ windowMs: 60000, max: 10, message: { error: '잠시 후 다시 시도하세요' } }));
app.use('/api/chat', rateLimit({ windowMs: 60000, max: 15, message: { error: '잠시 후 다시 시도하세요' } }));
app.use('/api/yeonin-chat', rateLimit({ windowMs: 60000, max: 15, message: { error: '잠시 후 다시 시도하세요' } }));

// Auth routes
const { router: authRouter } = require('./auth');
app.use('/auth', authRouter);

// Guest + tracking routes
const { router: guestRouter, initGuest } = require('./routes/guest');
initGuest(db);
app.use('/api', guestRouter);

// Share routes
const { router: shareRouter, initShare } = require('./routes/share');
initShare(db);
app.use('/api', shareRouter);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// API routes
app.use('/api', require('./routes/enrich'));

app.listen(PORT, () => console.log('Server on', PORT));

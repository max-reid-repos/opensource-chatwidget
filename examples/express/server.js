/**
 * Express.js Chat Widget Backend
 * 
 * A complete, working backend for the chat widget.
 * Uses SQLite for storage (no external database needed).
 * 
 * Run: npm install && npm start
 * Open: http://localhost:3000
 */

import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files (the widget + demo page)
app.use(express.static(join(__dirname, 'public')));

// ============================================
// DATABASE SETUP
// ============================================

const db = new Database(join(__dirname, 'chat.db'));
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS chat_visitor_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visitor_id TEXT UNIQUE NOT NULL,
    ip_address TEXT NOT NULL,
    user_agent TEXT,
    fingerprint TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visitor_id TEXT NOT NULL,
    text TEXT NOT NULL,
    sender TEXT NOT NULL CHECK (sender IN ('visitor', 'admin')),
    category TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS chat_rate_limits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visitor_id TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    count INTEGER DEFAULT 1,
    reset_at DATETIME NOT NULL,
    UNIQUE(visitor_id, endpoint)
  );
`);

// ============================================
// SECURITY HELPERS
// ============================================

const TOKEN_SECRET = process.env.CHAT_TOKEN_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_EXPIRY_HOURS = 24 * 7; // 7 days

function generateVisitorId() {
  return `visitor_${crypto.randomBytes(16).toString('hex')}`;
}

function createFingerprint(ip, userAgent) {
  return crypto.createHash('sha256').update(`${ip}:${userAgent}`).digest('hex');
}

function signToken(payload) {
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', TOKEN_SECRET).update(payloadBase64).digest('base64url');
  return `${payloadBase64}.${signature}`;
}

function verifyToken(token) {
  try {
    const [payloadBase64, signature] = token.split('.');
    if (!payloadBase64 || !signature) return null;

    const expectedSig = crypto.createHmac('sha256', TOKEN_SECRET).update(payloadBase64).digest('base64url');
    if (signature !== expectedSig) return null;

    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf-8'));
    
    // Check expiry
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() 
    || req.headers['x-real-ip'] 
    || req.ip 
    || '0.0.0.0';
}

function getUserAgent(req) {
  return req.headers['user-agent'] || 'unknown';
}

// ============================================
// RATE LIMITING
// ============================================

const RATE_LIMITS = {
  sendMessage: { max: 10, windowMinutes: 5 },
  loadMessages: { max: 120, windowMinutes: 1 },
  createSession: { max: 5, windowMinutes: 60 },
};

function checkRateLimit(visitorId, endpoint) {
  const limit = RATE_LIMITS[endpoint];
  if (!limit) return { allowed: true };

  const stmt = db.prepare(`
    SELECT count, reset_at FROM chat_rate_limits
    WHERE visitor_id = ? AND endpoint = ? AND reset_at > datetime('now')
    LIMIT 1
  `);
  const record = stmt.get(visitorId, endpoint);

  if (!record) return { allowed: true };
  if (record.count >= limit.max) {
    const resetIn = Math.ceil((new Date(record.reset_at).getTime() - Date.now()) / 1000);
    return { allowed: false, resetIn };
  }
  return { allowed: true };
}

function incrementRateLimit(visitorId, endpoint) {
  const limit = RATE_LIMITS[endpoint];
  const resetAt = new Date(Date.now() + limit.windowMinutes * 60 * 1000).toISOString();

  const stmt = db.prepare(`
    INSERT INTO chat_rate_limits (visitor_id, endpoint, count, reset_at)
    VALUES (?, ?, 1, ?)
    ON CONFLICT(visitor_id, endpoint) DO UPDATE SET
      count = CASE WHEN reset_at <= datetime('now') THEN 1 ELSE count + 1 END,
      reset_at = CASE WHEN reset_at <= datetime('now') THEN excluded.reset_at ELSE reset_at END
  `);
  stmt.run(visitorId, endpoint, resetAt);
}

// ============================================
// API ROUTES
// ============================================

// POST /api/chat/init - Create visitor session
app.post('/api/chat/init', (req, res) => {
  const ip = getClientIp(req);
  const userAgent = getUserAgent(req);
  const tempId = `ip_${ip}`;

  // Rate limit session creation
  const rateCheck = checkRateLimit(tempId, 'createSession');
  if (!rateCheck.allowed) {
    return res.status(429).json({ error: 'Too many session attempts', resetIn: rateCheck.resetIn });
  }

  const visitorId = generateVisitorId();
  const fingerprint = createFingerprint(ip, userAgent);
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (TOKEN_EXPIRY_HOURS * 3600);

  const token = signToken({ visitorId, fingerprint, iat: now, exp });

  // Store session
  const stmt = db.prepare(`
    INSERT INTO chat_visitor_sessions (visitor_id, ip_address, user_agent, fingerprint, expires_at)
    VALUES (?, ?, ?, ?, datetime(?, 'unixepoch'))
  `);
  stmt.run(visitorId, ip, userAgent, fingerprint, exp);

  incrementRateLimit(tempId, 'createSession');

  res.json({ success: true, visitorId, token, expiresIn: TOKEN_EXPIRY_HOURS * 3600 });
});

// GET /api/chat/messages - Get messages for visitor
app.get('/api/chat/messages', (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(401).json({ error: 'Token required' });

  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Invalid or expired token' });

  // Rate limit
  const rateCheck = checkRateLimit(payload.visitorId, 'loadMessages');
  if (!rateCheck.allowed) {
    return res.status(429).json({ error: 'Too many requests', resetIn: rateCheck.resetIn });
  }

  // Verify session exists
  const session = db.prepare(`
    SELECT visitor_id FROM chat_visitor_sessions
    WHERE visitor_id = ? AND expires_at > datetime('now')
  `).get(payload.visitorId);

  if (!session) return res.status(401).json({ error: 'Session expired' });

  // Get messages
  const messages = db.prepare(`
    SELECT id, text, sender, category, created_at as timestamp
    FROM chat_messages
    WHERE visitor_id = ?
    ORDER BY created_at ASC
  `).all(payload.visitorId);

  incrementRateLimit(payload.visitorId, 'loadMessages');

  res.json({ messages });
});

// POST /api/chat/send - Send a message
app.post('/api/chat/send', (req, res) => {
  const { token, text, category } = req.body;

  if (!token) return res.status(401).json({ error: 'Token required' });
  if (!text || typeof text !== 'string') return res.status(400).json({ error: 'Text required' });
  if (text.length > 2000) return res.status(400).json({ error: 'Message too long' });

  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Invalid or expired token' });

  // Rate limit
  const rateCheck = checkRateLimit(payload.visitorId, 'sendMessage');
  if (!rateCheck.allowed) {
    return res.status(429).json({ error: 'Too many messages', resetIn: rateCheck.resetIn });
  }

  // Store message
  const stmt = db.prepare(`
    INSERT INTO chat_messages (visitor_id, text, sender, category)
    VALUES (?, ?, 'visitor', ?)
  `);
  const result = stmt.run(payload.visitorId, text.trim(), category || null);

  incrementRateLimit(payload.visitorId, 'sendMessage');

  // Check if first message → send auto-response
  const count = db.prepare(`
    SELECT COUNT(*) as c FROM chat_messages WHERE visitor_id = ? AND sender = 'visitor'
  `).get(payload.visitorId);

  let autoResponse = null;
  if (count.c === 1) {
    autoResponse = "Thanks for your message! We'll get back to you soon.";
    db.prepare(`
      INSERT INTO chat_messages (visitor_id, text, sender, category)
      VALUES (?, ?, 'admin', ?)
    `).run(payload.visitorId, autoResponse, category || null);
  }

  res.json({ 
    success: true, 
    messageId: result.lastInsertRowid.toString(),
    autoResponse,
    timestamp: new Date().toISOString()
  });
});

// GET /api/chat/status - Check online status
app.get('/api/chat/status', (req, res) => {
  // You can make this dynamic (check if admin is online, etc.)
  res.json({ online: true });
});

// ============================================
// ADMIN ROUTES (for testing)
// ============================================

// GET /api/admin/conversations - List all conversations
app.get('/api/admin/conversations', (req, res) => {
  const conversations = db.prepare(`
    SELECT 
      visitor_id,
      COUNT(*) as message_count,
      MAX(created_at) as last_message,
      MIN(created_at) as first_message
    FROM chat_messages
    GROUP BY visitor_id
    ORDER BY last_message DESC
  `).all();

  res.json({ conversations });
});

// POST /api/admin/reply - Send admin reply
app.post('/api/admin/reply', (req, res) => {
  const { visitorId, text } = req.body;

  if (!visitorId || !text) {
    return res.status(400).json({ error: 'visitorId and text required' });
  }

  const stmt = db.prepare(`
    INSERT INTO chat_messages (visitor_id, text, sender)
    VALUES (?, ?, 'admin')
  `);
  const result = stmt.run(visitorId, text.trim());

  res.json({ success: true, messageId: result.lastInsertRowid.toString() });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`Chat widget backend running at http://localhost:${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser to see the demo`);
});

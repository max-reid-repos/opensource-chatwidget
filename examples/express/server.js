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
    email TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visitor_id TEXT NOT NULL,
    text TEXT NOT NULL,
    sender TEXT NOT NULL CHECK (sender IN ('visitor', 'admin')),
    category TEXT,
    sent_via_telegram INTEGER DEFAULT 0,
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

// Lightweight migrations for existing local databases
try {
  const sessionColumns = db.pragma('table_info(chat_visitor_sessions)');
  if (!sessionColumns.some((col) => col.name === 'email')) {
    db.exec('ALTER TABLE chat_visitor_sessions ADD COLUMN email TEXT');
  }

  const messageColumns = db.pragma('table_info(chat_messages)');
  if (!messageColumns.some((col) => col.name === 'sent_via_telegram')) {
    db.exec('ALTER TABLE chat_messages ADD COLUMN sent_via_telegram INTEGER DEFAULT 0');
  }
} catch (error) {
  console.error('[Migration] Failed applying chat schema updates:', error);
}

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

function verifyVisitorRequest(req, token) {
  const payload = verifyToken(token);
  if (!payload) {
    return { valid: false, status: 401, error: 'Invalid or expired token' };
  }

  // Verify fingerprint matches request in production
  const currentFingerprint = createFingerprint(getClientIp(req), getUserAgent(req));
  if (payload.fingerprint !== currentFingerprint && process.env.NODE_ENV === 'production') {
    return { valid: false, status: 401, error: 'Fingerprint mismatch' };
  }

  // Verify session still exists
  const session = db.prepare(`
    SELECT visitor_id FROM chat_visitor_sessions
    WHERE visitor_id = ? AND expires_at > datetime('now')
    LIMIT 1
  `).get(payload.visitorId);

  if (!session) {
    return { valid: false, status: 401, error: 'Session expired' };
  }

  return { valid: true, visitorId: payload.visitorId };
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ============================================
// RATE LIMITING
// ============================================

const RATE_LIMITS = {
  sendMessage: { max: 10, windowMinutes: 5 },
  loadMessages: { max: 120, windowMinutes: 1 },
  createSession: { max: 5, windowMinutes: 60 },
  updateEmail: { max: 20, windowMinutes: 60 },
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
// OPTIONAL TELEGRAM HELPERS
// ============================================

const TELEGRAM_API = 'https://api.telegram.org/bot';

function isTelegramEnabled() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getVisitorEmail(visitorId) {
  const row = db.prepare(`
    SELECT email FROM chat_visitor_sessions
    WHERE visitor_id = ?
    LIMIT 1
  `).get(visitorId);
  return row?.email || null;
}

function formatTelegramVisitorMessage(visitorId, message, category, email, isNewConversation = false) {
  const safeMessage = escapeHtml(message);
  const safeEmail = email ? escapeHtml(email) : null;
  const safeCategory = category ? escapeHtml(category) : 'general';
  const header = isNewConversation
    ? `🆕 <b>New Conversation</b>\n🏷️ <b>${safeCategory}</b>`
    : `💬 <b>${safeCategory}</b>`;
  const emailLine = safeEmail ? `\n📧 <b>${safeEmail}</b>` : '';

  return `${header}

🧑 <code>${visitorId}</code>${emailLine}

${safeMessage}

<i>Reply to this message to respond in chat.</i>`;
}

async function sendTelegramMessage(text) {
  if (!isTelegramEnabled()) return { ok: false };

  try {
    const response = await fetch(`${TELEGRAM_API}${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'HTML',
      }),
    });

    const data = await response.json();
    if (!response.ok || !data?.ok) {
      console.error('[Telegram] sendMessage failed:', data?.description || `HTTP ${response.status}`);
      return { ok: false };
    }

    return { ok: true };
  } catch (error) {
    console.error('[Telegram] sendMessage error:', error);
    return { ok: false };
  }
}

async function notifyTelegramVisitorMessage(visitorId, message, category, isNewConversation = false) {
  if (!isTelegramEnabled()) return;

  const email = getVisitorEmail(visitorId);
  const formatted = formatTelegramVisitorMessage(
    visitorId,
    message,
    category,
    email,
    isNewConversation
  );
  await sendTelegramMessage(formatted);
}

function extractVisitorIdFromText(text) {
  const match = String(text || '').match(/(visitor_[a-zA-Z0-9]+)/);
  return match ? match[1] : null;
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
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  if (!token) return res.status(401).json({ error: 'Token required' });

  const verification = verifyVisitorRequest(req, token);
  if (!verification.valid) {
    return res.status(verification.status).json({ error: verification.error });
  }

  const visitorId = verification.visitorId;

  // Rate limit
  const rateCheck = checkRateLimit(visitorId, 'loadMessages');
  if (!rateCheck.allowed) {
    return res.status(429).json({ error: 'Too many requests', resetIn: rateCheck.resetIn });
  }

  // Get messages
  const messages = db.prepare(`
    SELECT id, text, sender, category, sent_via_telegram, created_at as timestamp
    FROM chat_messages
    WHERE visitor_id = ?
    ORDER BY created_at ASC, id ASC
  `).all(visitorId);

  incrementRateLimit(visitorId, 'loadMessages');

  res.json({
    messages: messages.map((message) => ({
      id: String(message.id),
      text: message.text,
      sender: message.sender,
      category: message.category,
      sent_via_telegram: message.sent_via_telegram === 1,
      timestamp: message.timestamp,
    })),
  });
});

// POST /api/chat/email - Save visitor email on session
app.post('/api/chat/email', (req, res) => {
  const { token, email } = req.body || {};

  if (!token || typeof token !== 'string') return res.status(401).json({ error: 'Token required' });

  const normalizedEmail = normalizeEmail(email);
  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  const verification = verifyVisitorRequest(req, token);
  if (!verification.valid) {
    return res.status(verification.status).json({ error: verification.error });
  }

  const visitorId = verification.visitorId;

  const rateCheck = checkRateLimit(visitorId, 'updateEmail');
  if (!rateCheck.allowed) {
    return res.status(429).json({
      error: 'Too many email update attempts. Please wait before trying again.',
      resetIn: rateCheck.resetIn,
    });
  }

  const result = db.prepare(`
    UPDATE chat_visitor_sessions
    SET email = ?
    WHERE visitor_id = ?
  `).run(normalizedEmail, visitorId);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Visitor session not found' });
  }

  incrementRateLimit(visitorId, 'updateEmail');
  res.json({ success: true, email: normalizedEmail });
});

// POST /api/chat/send - Send a message
app.post('/api/chat/send', async (req, res) => {
  const { token, text, category } = req.body || {};

  if (!token || typeof token !== 'string') return res.status(401).json({ error: 'Token required' });
  if (!text || typeof text !== 'string') return res.status(400).json({ error: 'Text required' });
  if (text.length > 2000) return res.status(400).json({ error: 'Message too long' });
  if (category != null && typeof category !== 'string') {
    return res.status(400).json({ error: 'Category must be a string' });
  }

  const verification = verifyVisitorRequest(req, token);
  if (!verification.valid) {
    return res.status(verification.status).json({ error: verification.error });
  }

  const visitorId = verification.visitorId;
  const sanitizedText = text.trim();
  if (!sanitizedText) return res.status(400).json({ error: 'Text required' });

  // Rate limit
  const rateCheck = checkRateLimit(visitorId, 'sendMessage');
  if (!rateCheck.allowed) {
    return res.status(429).json({ error: 'Too many messages', resetIn: rateCheck.resetIn });
  }

  // Evaluate conversation state before inserting the new message.
  const hasAnyPreviousMessages = Boolean(db.prepare(`
    SELECT 1 FROM chat_messages WHERE visitor_id = ? LIMIT 1
  `).get(visitorId));
  const hasExistingAdminMessage = Boolean(db.prepare(`
    SELECT 1 FROM chat_messages WHERE visitor_id = ? AND sender = 'admin' LIMIT 1
  `).get(visitorId));

  // Store visitor message
  const result = db.prepare(`
    INSERT INTO chat_messages (visitor_id, text, sender, category, sent_via_telegram)
    VALUES (?, ?, 'visitor', ?, 0)
  `).run(visitorId, sanitizedText, category || null);

  incrementRateLimit(visitorId, 'sendMessage');

  // Optional Telegram notification (fire-and-forget)
  if (isTelegramEnabled()) {
    notifyTelegramVisitorMessage(
      visitorId,
      sanitizedText,
      category || 'general',
      !hasAnyPreviousMessages
    ).catch((error) => {
      console.error('[Telegram] Visitor notification failed:', error);
    });
  }

  // Auto-response should only happen once per visitor conversation unless an admin has replied.
  let autoResponse = null;
  if (!hasExistingAdminMessage) {
    autoResponse = "Thanks for your message! We'll get back to you soon.";
    db.prepare(`
      INSERT INTO chat_messages (visitor_id, text, sender, category, sent_via_telegram)
      VALUES (?, ?, 'admin', ?, 0)
    `).run(visitorId, autoResponse, category || null);
  }

  res.json({
    success: true,
    messageId: result.lastInsertRowid.toString(),
    autoResponse,
    timestamp: new Date().toISOString(),
  });
});

// GET /api/chat/status - Check online status
app.get('/api/chat/status', (req, res) => {
  // You can make this dynamic (check if admin is online, etc.)
  res.json({ online: true });
});

// POST /api/telegram/webhook - Ingest Telegram admin replies (optional)
app.post('/api/telegram/webhook', (req, res) => {
  if (!isTelegramEnabled()) {
    return res.status(404).json({ error: 'Telegram integration not enabled' });
  }

  const configuredSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const requestSecret = req.headers['x-telegram-bot-api-secret-token'];
  if (configuredSecret && requestSecret !== configuredSecret) {
    return res.status(401).json({ error: 'Invalid webhook secret' });
  }

  try {
    const message = req.body?.message;
    if (!message?.text) {
      return res.json({ ok: true });
    }

    // Ignore bot-originated messages to avoid loops.
    if (message?.from?.is_bot) {
      return res.json({ ok: true });
    }

    const commandMatch = String(message.text).match(/^\/reply\s+(visitor_[a-zA-Z0-9]+)\s+([\s\S]+)/i);
    const visitorId = commandMatch
      ? commandMatch[1]
      : extractVisitorIdFromText(message.reply_to_message?.text);
    const replyText = commandMatch ? commandMatch[2].trim() : String(message.text || '').trim();

    if (!visitorId || !replyText) {
      return res.json({ ok: true });
    }

    const exists = db.prepare(`
      SELECT 1 FROM chat_messages WHERE visitor_id = ? LIMIT 1
    `).get(visitorId);

    if (!exists) {
      return res.status(404).json({ error: 'Visitor not found' });
    }

    const firstMessage = db.prepare(`
      SELECT category
      FROM chat_messages
      WHERE visitor_id = ?
      ORDER BY created_at ASC, id ASC
      LIMIT 1
    `).get(visitorId);

    const category = firstMessage?.category || null;

    db.prepare(`
      INSERT INTO chat_messages (visitor_id, text, sender, category, sent_via_telegram)
      VALUES (?, ?, 'admin', ?, 1)
    `).run(visitorId, replyText, category);

    return res.json({ ok: true });
  } catch (error) {
    console.error('[Telegram] Webhook processing failed:', error);
    return res.status(500).json({ error: 'Failed to process webhook' });
  }
});

// ============================================
// ADMIN ROUTES (for testing)
// ============================================

// GET /api/admin/conversations - List all conversations
app.get('/api/admin/conversations', (req, res) => {
  const conversations = db.prepare(`
    SELECT
      m.visitor_id,
      s.email as visitor_email,
      COUNT(m.id) as message_count,
      MAX(m.created_at) as last_message,
      MIN(m.created_at) as first_message
    FROM chat_messages m
    LEFT JOIN chat_visitor_sessions s ON s.visitor_id = m.visitor_id
    GROUP BY m.visitor_id
    ORDER BY last_message DESC
  `).all();

  res.json({ conversations });
});

// POST /api/admin/reply - Send admin reply
app.post('/api/admin/reply', (req, res) => {
  const { visitorId, text } = req.body;

  if (!visitorId || !text || typeof text !== 'string') {
    return res.status(400).json({ error: 'visitorId and text required' });
  }

  const trimmedText = text.trim();
  if (!trimmedText) {
    return res.status(400).json({ error: 'Text required' });
  }

  const exists = db.prepare(`
    SELECT 1 FROM chat_messages WHERE visitor_id = ? LIMIT 1
  `).get(visitorId);

  if (!exists) {
    return res.status(404).json({ error: 'Visitor not found' });
  }

  const firstMessage = db.prepare(`
    SELECT category FROM chat_messages WHERE visitor_id = ? ORDER BY created_at ASC, id ASC LIMIT 1
  `).get(visitorId);
  const category = firstMessage?.category || null;

  const stmt = db.prepare(`
    INSERT INTO chat_messages (visitor_id, text, sender, category, sent_via_telegram)
    VALUES (?, ?, 'admin', ?, 0)
  `);
  const result = stmt.run(visitorId, trimmedText, category);

  res.json({ success: true, messageId: result.lastInsertRowid.toString() });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`Chat widget backend running at http://localhost:${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser to see the demo`);
});


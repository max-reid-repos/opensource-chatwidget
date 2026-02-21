/**
 * Chat Security Module
 *
 * SECURITY FIX: Visitor identity verification using signed tokens
 * - Prevents spoofing of visitor IDs
 * - Server-issued tokens tied to IP address and fingerprint
 * - Rate limiting to prevent abuse
 *
 * Addresses vulnerability: Chat widget identity is fully spoofable
 */

import crypto from 'crypto';
import { dbHelpers } from './db';
import db from './db';

const VISITOR_TOKEN_SECRET = process.env.CHAT_TOKEN_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_EXPIRY_HOURS = 24 * 7; // 7 days

interface VisitorSession {
  visitorId: string;
  ipAddress: string;
  userAgent: string;
  fingerprint: string;
  createdAt: Date;
  expiresAt: Date;
}

interface VisitorTokenPayload {
  visitorId: string;
  fingerprint: string;
  iat: number; // issued at
  exp: number; // expiry
}

export class ChatSecurity {
  /**
   * Generate a cryptographically secure visitor ID
   */
  private static generateVisitorId(): string {
    return `visitor_${crypto.randomBytes(16).toString('hex')}`;
  }

  /**
   * Create a fingerprint from client information
   */
  private static createFingerprint(ipAddress: string, userAgent: string): string {
    const data = `${ipAddress}:${userAgent}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Sign a visitor token with HMAC
   */
  private static signToken(payload: VisitorTokenPayload): string {
    const payloadJson = JSON.stringify(payload);
    const payloadBase64 = Buffer.from(payloadJson).toString('base64url');

    const signature = crypto
      .createHmac('sha256', VISITOR_TOKEN_SECRET)
      .update(payloadBase64)
      .digest('base64url');

    return `${payloadBase64}.${signature}`;
  }

  /**
   * Verify and decode a visitor token
   */
  private static verifyToken(token: string): VisitorTokenPayload | null {
    try {
      const [payloadBase64, signature] = token.split('.');

      if (!payloadBase64 || !signature) {
        return null;
      }

      // Verify signature
      const expectedSignature = crypto
        .createHmac('sha256', VISITOR_TOKEN_SECRET)
        .update(payloadBase64)
        .digest('base64url');

      if (signature !== expectedSignature) {
        return null;
      }

      // Decode payload
      const payloadJson = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
      const payload: VisitorTokenPayload = JSON.parse(payloadJson);

      // Check expiry
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) {
        return null;
      }

      return payload;
    } catch (error) {
      console.error('Token verification error:', error);
      return null;
    }
  }

  /**
   * Create a new visitor session
   * Returns a signed token that the client must use for all subsequent requests
   */
  static createVisitorSession(ipAddress: string, userAgent: string): { visitorId: string; token: string } {
    const visitorId = this.generateVisitorId();
    const fingerprint = this.createFingerprint(ipAddress, userAgent);

    const now = Math.floor(Date.now() / 1000);
    const exp = now + (TOKEN_EXPIRY_HOURS * 3600);

    const payload: VisitorTokenPayload = {
      visitorId,
      fingerprint,
      iat: now,
      exp
    };

    const token = this.signToken(payload);

    // Store session in database
    const stmt = db.prepare(`
      INSERT INTO chat_visitor_sessions (visitor_id, ip_address, user_agent, fingerprint, expires_at)
      VALUES (?, ?, ?, ?, datetime(?, 'unixepoch'))
    `);

    stmt.run(visitorId, ipAddress, userAgent, fingerprint, exp);

    return { visitorId, token };
  }

  /**
   * Verify a visitor token and return the visitor ID
   * Also validates that the fingerprint matches the current request
   */
  static verifyVisitorToken(token: string, ipAddress: string, userAgent: string): { valid: boolean; visitorId?: string; error?: string } {
    const payload = this.verifyToken(token);

    if (!payload) {
      return { valid: false, error: 'Invalid or expired token' };
    }

    // Verify fingerprint matches current request
    // In development, skip fingerprint check as IP can change with WSL/localhost
    const currentFingerprint = this.createFingerprint(ipAddress, userAgent);
    if (payload.fingerprint !== currentFingerprint) {
      if (process.env.NODE_ENV === 'production') {
        return { valid: false, error: 'Fingerprint mismatch - possible token theft' };
      }
      // In development, log but allow (IP changes with WSL/localhost)
      console.warn('[Chat Security] Fingerprint mismatch in development mode - allowing for local testing');
    }

    // Verify session exists in database
    const stmt = db.prepare(`
      SELECT visitor_id FROM chat_visitor_sessions
      WHERE visitor_id = ? AND expires_at > datetime('now')
      LIMIT 1
    `);

    const session = stmt.get(payload.visitorId) as { visitor_id: string } | undefined;

    if (!session) {
      return { valid: false, error: 'Session not found or expired' };
    }

    return { valid: true, visitorId: payload.visitorId };
  }

  /**
   * Clean up expired visitor sessions
   */
  static cleanupExpiredSessions(): number {
    const stmt = db.prepare(`
      DELETE FROM chat_visitor_sessions
      WHERE expires_at <= datetime('now')
    `);

    const result = stmt.run();
    return result.changes;
  }
}

/**
 * Rate Limiting for Chat Endpoints
 * Prevents spam and abuse of public chat APIs
 */

interface RateLimitRecord {
  visitorId: string;
  endpoint: string;
  count: number;
  resetAt: Date;
}

export class ChatRateLimiter {
  // Rate limits per visitor
  private static readonly LIMITS = {
    sendMessage: { max: 10, windowMinutes: 5 },      // 10 messages per 5 minutes
    loadMessages: { max: 120, windowMinutes: 1 },    // 120 loads per minute (supports 5-sec polling)
    createSession: { max: 5, windowMinutes: 60 }     // 5 session creations per hour
  };

  /**
   * Check if a visitor has exceeded rate limits
   */
  static check(visitorId: string, endpoint: keyof typeof ChatRateLimiter.LIMITS): { allowed: boolean; resetIn?: number } {
    const limit = this.LIMITS[endpoint];
    const now = new Date();

    // Get current count from database
    const stmt = db.prepare(`
      SELECT count, reset_at FROM chat_rate_limits
      WHERE visitor_id = ? AND endpoint = ? AND reset_at > datetime('now')
      LIMIT 1
    `);

    const record = stmt.get(visitorId, endpoint) as RateLimitRecord | undefined;

    if (!record) {
      // No existing record, allow and create new one
      return { allowed: true };
    }

    if (record.count >= limit.max) {
      const resetAt = new Date(record.resetAt);
      const resetIn = Math.ceil((resetAt.getTime() - now.getTime()) / 1000);
      return { allowed: false, resetIn };
    }

    return { allowed: true };
  }

  /**
   * Increment rate limit counter for a visitor
   */
  static increment(visitorId: string, endpoint: keyof typeof ChatRateLimiter.LIMITS) {
    const limit = this.LIMITS[endpoint];
    const now = new Date();
    const resetAt = new Date(now.getTime() + limit.windowMinutes * 60 * 1000);

    // Upsert rate limit record
    const stmt = db.prepare(`
      INSERT INTO chat_rate_limits (visitor_id, endpoint, count, reset_at)
      VALUES (?, ?, 1, ?)
      ON CONFLICT(visitor_id, endpoint) DO UPDATE SET
        count = CASE
          WHEN reset_at <= datetime('now') THEN 1
          ELSE count + 1
        END,
        reset_at = CASE
          WHEN reset_at <= datetime('now') THEN excluded.reset_at
          ELSE reset_at
        END
    `);

    stmt.run(visitorId, endpoint, resetAt.toISOString());
  }

  /**
   * Clean up expired rate limit records
   */
  static cleanup(): number {
    const stmt = db.prepare(`
      DELETE FROM chat_rate_limits
      WHERE reset_at <= datetime('now')
    `);

    const result = stmt.run();
    return result.changes;
  }

  /**
   * Get current usage for a visitor (for debugging/monitoring)
   */
  static getUsage(visitorId: string): Record<string, { count: number; max: number; resetAt: Date }> {
    const stmt = db.prepare(`
      SELECT endpoint, count, reset_at FROM chat_rate_limits
      WHERE visitor_id = ? AND reset_at > datetime('now')
    `);

    const records = stmt.all(visitorId) as Array<{ endpoint: string; count: number; reset_at: string }>;

    const usage: Record<string, { count: number; max: number; resetAt: Date }> = {};

    for (const record of records) {
      const endpoint = record.endpoint as keyof typeof ChatRateLimiter.LIMITS;
      const limit = this.LIMITS[endpoint];

      usage[endpoint] = {
        count: record.count,
        max: limit.max,
        resetAt: new Date(record.reset_at)
      };
    }

    return usage;
  }
}

/**
 * Helper function to extract IP address from Next.js request
 */
export function getClientIp(request: Request): string {
  const headers = request.headers;

  // Try various headers in order of preference
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  // Fallback to a placeholder (should not happen in production)
  return '0.0.0.0';
}

/**
 * Helper function to extract User-Agent from Next.js request
 */
export function getClientUserAgent(request: Request): string {
  return request.headers.get('user-agent') || 'unknown';
}

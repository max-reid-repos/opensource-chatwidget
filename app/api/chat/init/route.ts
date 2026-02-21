/**
 * Chat Session Initialization Endpoint
 *
 * SECURITY FIX: Replace client-side localStorage visitor IDs with server-issued signed tokens
 * - Creates secure visitor sessions tied to IP and User-Agent
 * - Returns signed token that must be used for all subsequent chat requests
 * - Prevents visitor ID spoofing
 */

import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { ChatSecurity, ChatRateLimiter, getClientIp, getClientUserAgent } from '@/lib/chat-security';

export async function POST(request: NextRequest) {
  try {
    const ipAddress = getClientIp(request);
    const userAgent = getClientUserAgent(request);

    // Rate limit session creation to prevent abuse
    // Use IP as temporary identifier for rate limiting session creation
    const tempId = `ip_${ipAddress}`;
    const rateCheck = ChatRateLimiter.check(tempId, 'createSession');

    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: 'Too many session creation attempts',
          resetIn: rateCheck.resetIn
        },
        { status: 429 }
      );
    }

    // Create visitor session
    const { visitorId, token } = ChatSecurity.createVisitorSession(ipAddress, userAgent);

    // Increment rate limit
    ChatRateLimiter.increment(tempId, 'createSession');

    return NextResponse.json({
      success: true,
      visitorId,
      token,
      expiresIn: 7 * 24 * 3600 // 7 days in seconds
    });

  } catch (error) {
    console.error('Error creating chat session:', error);
    return NextResponse.json(
      { error: 'Failed to create chat session' },
      { status: 500 }
    );
  }
}

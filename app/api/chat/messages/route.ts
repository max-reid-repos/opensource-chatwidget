/**
 * Chat Messages Retrieval Endpoint
 *
 * SECURITY FIX: Verify visitor token before returning messages
 * - Prevents reading other visitors' chat transcripts
 * - Rate limiting to prevent abuse
 * - Token verification with fingerprint matching
 */

import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { dbHelpers } from '@/lib/db';
import { ChatSecurity, ChatRateLimiter, getClientIp, getClientUserAgent } from '@/lib/chat-security';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication token required' },
        { status: 401 }
      );
    }

    // Verify visitor token
    const ipAddress = getClientIp(request);
    const userAgent = getClientUserAgent(request);

    const verification = ChatSecurity.verifyVisitorToken(token, ipAddress, userAgent);

    if (!verification.valid) {
      return NextResponse.json(
        { error: verification.error || 'Invalid token' },
        { status: 401 }
      );
    }

    const visitorId = verification.visitorId!;

    // Rate limit message loading
    const rateCheck = ChatRateLimiter.check(visitorId, 'loadMessages');

    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: 'Too many requests',
          resetIn: rateCheck.resetIn
        },
        { status: 429 }
      );
    }

    // Get messages from database (now secured - only for verified visitor)
    const messages = dbHelpers.getChatMessages(visitorId);

    // Increment rate limit
    ChatRateLimiter.increment(visitorId, 'loadMessages');

    // Format messages for frontend
    const formattedMessages = messages.map((msg: any) => ({
      id: msg.id.toString(),
      text: msg.text,
      sender: msg.sender,
      timestamp: new Date(msg.created_at),
      category: msg.category
    }));

    return NextResponse.json({
      messages: formattedMessages,
      visitorId
    });

  } catch (error) {
    console.error('Error fetching chat messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

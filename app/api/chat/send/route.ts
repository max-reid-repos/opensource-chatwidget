/**
 * Chat Message Send Endpoint
 *
 * SECURITY FIX: Verify visitor token and apply rate limiting
 * - Prevents sending messages as other visitors
 * - Rate limiting to prevent spam
 * - Token verification with fingerprint matching
 * - Input validation and sanitization
 * - Telegram notification for admin
 */

import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { dbHelpers } from '@/lib/db';
import { ChatSecurity, ChatRateLimiter, getClientIp, getClientUserAgent } from '@/lib/chat-security';
import {
  isTelegramEnabled,
  notifyNewConversation,
  notifyFollowUpMessage
} from '@/lib/telegram';

interface ChatMessage {
  token: string;
  text: string;
  category?: string;
}

// Maximum message length to prevent abuse
const MAX_MESSAGE_LENGTH = 2000;

/**
 * Send notification to Telegram admin chat
 * Handles both new conversations and follow-up messages
 */
async function notifyTelegram(visitorId: string, message: string, category?: string): Promise<void> {
  // Check if this visitor already has a Telegram conversation
  const existingConversation = dbHelpers.getTelegramConversation(visitorId);

  if (existingConversation) {
    // Follow-up message to existing conversation
    const result = await notifyFollowUpMessage(
      visitorId,
      message,
      existingConversation.telegram_thread_id ? parseInt(existingConversation.telegram_thread_id) : undefined
    );

    if (result.ok) {
      // Update last message timestamp
      dbHelpers.upsertTelegramConversation(
        visitorId,
        existingConversation.telegram_chat_id,
        existingConversation.telegram_thread_id || undefined,
        category
      );
    }
  } else {
    // New conversation
    const result = await notifyNewConversation(visitorId, message, category);

    if (result.ok) {
      // Store the conversation mapping
      dbHelpers.upsertTelegramConversation(
        visitorId,
        process.env.TELEGRAM_CHAT_ID || '',
        result.threadId?.toString(),
        category
      );
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatMessage = await request.json();
    const { token, text, category } = body;

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication token required' },
        { status: 401 }
      );
    }

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Message text required' },
        { status: 400 }
      );
    }

    // Validate message length
    if (text.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `Message too long (max ${MAX_MESSAGE_LENGTH} characters)` },
        { status: 400 }
      );
    }

    // Sanitize text (trim whitespace)
    const sanitizedText = text.trim();

    if (sanitizedText.length === 0) {
      return NextResponse.json(
        { error: 'Message cannot be empty' },
        { status: 400 }
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

    // Rate limit message sending (most important to prevent spam)
    const rateCheck = ChatRateLimiter.check(visitorId, 'sendMessage');

    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: 'Too many messages sent. Please wait before sending more.',
          resetIn: rateCheck.resetIn
        },
        { status: 429 }
      );
    }

    // Store the message in database
    const messageId = dbHelpers.createChatMessage(visitorId, sanitizedText, 'visitor', category);

    // Increment rate limit
    ChatRateLimiter.increment(visitorId, 'sendMessage');

    // Send notification to Telegram (async, don't block response)
    if (isTelegramEnabled()) {
      notifyTelegram(visitorId, sanitizedText, category).catch((error) => {
        console.error('[Chat Send] Telegram notification failed:', error);
      });
    }

    const messagesAfterInsert = dbHelpers.getChatMessages(visitorId) as any[];
    const visitorMessageCount = messagesAfterInsert.filter((msg: any) => msg.sender === 'visitor').length;
    const isFirstVisitorMessage = visitorMessageCount === 1;

    let autoResponse: string | null = null;

    if (isFirstVisitorMessage) {
      // Default auto-response - customize this for your use case
      autoResponse = "Thanks for your message! We'll get back to you as soon as possible.";

      // Store the auto-response in database as well
      if (autoResponse) {
        dbHelpers.createChatMessage(visitorId, autoResponse, 'admin', category);
      }
    }

    return NextResponse.json({
      success: true,
      messageId: messageId.toString(),
      autoResponse,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error sending chat message:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}

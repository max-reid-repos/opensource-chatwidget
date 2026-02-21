# Chat Widget (Open Source)

A secure, embeddable chat widget for Next.js applications with real-time messaging and admin notifications.

## Features

- 🔒 **Secure visitor sessions** - Server-issued signed tokens (no spoofable client IDs)
- ⚡ **Real-time polling** - New messages appear automatically
- 🎯 **Category selection** - Route conversations by topic
- 📱 **Responsive design** - Works on all screen sizes
- 🔔 **Notification sound** - Audio alert for new admin messages
- 🚦 **Rate limiting** - Built-in abuse protection
- 📲 **Telegram notifications** - Optional admin alerts (see setup)

## Project Structure

```
chat-widget-oss/
├── components/
│   └── ChatWidget.tsx      # React component (client-side)
├── lib/
│   └── chat-security.ts    # Token signing & rate limiting
├── app/api/chat/
│   ├── init/route.ts       # POST - Create visitor session
│   ├── messages/route.ts   # GET - Fetch messages
│   ├── send/route.ts       # POST - Send message
│   └── status/route.ts     # GET - Check online status
└── README.md
```

## Requirements

- Next.js 13+ (App Router)
- SQLite database (better-sqlite3)
- `lucide-react` for icons

## Database Schema

You'll need these tables:

```sql
-- Visitor sessions
CREATE TABLE chat_visitor_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visitor_id TEXT UNIQUE NOT NULL,
  ip_address TEXT NOT NULL,
  user_agent TEXT,
  fingerprint TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL
);

-- Chat messages
CREATE TABLE chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visitor_id TEXT NOT NULL,
  text TEXT NOT NULL,
  sender TEXT NOT NULL CHECK (sender IN ('visitor', 'admin')),
  category TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Rate limiting
CREATE TABLE chat_rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visitor_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  count INTEGER DEFAULT 1,
  reset_at DATETIME NOT NULL,
  UNIQUE(visitor_id, endpoint)
);

-- Telegram conversations (optional)
CREATE TABLE telegram_conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visitor_id TEXT UNIQUE NOT NULL,
  telegram_chat_id TEXT NOT NULL,
  telegram_thread_id TEXT,
  category TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Environment Variables

```env
# Required: Secret for signing visitor tokens
CHAT_TOKEN_SECRET=your-32-byte-secret-here

# Optional: Telegram notifications
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=your-chat-id
```

## Installation

1. Copy the files to your Next.js project
2. Create the database tables
3. Implement `lib/db.ts` with your database helpers
4. Implement `lib/telegram.ts` (optional) for admin notifications
5. Add the widget to your layout:

```tsx
import ChatWidget from '@/components/ChatWidget';

export default function Layout({ children }) {
  return (
    <html>
      <body>
        {children}
        <ChatWidget />
      </body>
    </html>
  );
}
```

## TODO for Open Source Release

- [ ] Remove MenuCapture-specific branding from component
- [ ] Make categories configurable via props
- [ ] Make localStorage keys configurable
- [ ] Extract Telegram notification as optional plugin
- [ ] Add proper TypeScript interfaces for db helpers
- [ ] Create standalone npm package with db adapter interface
- [ ] Add WebSocket option for real-time (instead of polling)
- [ ] Add theming/styling options

## Security Notes

- Visitor tokens are HMAC-signed and tied to IP + User-Agent fingerprint
- Rate limiting prevents spam and session enumeration
- All messages are scoped to verified visitor sessions
- No client-side visitor ID generation (prevents spoofing)

## License

MIT (adjust as needed)

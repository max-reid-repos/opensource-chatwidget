# Chat Widget (Open Source)

A secure, **stack-agnostic** embeddable chat widget with real-time messaging and admin notifications.

## Quick Start (Any Stack)

```html
<script src="https://cdn.yoursite.com/chat-widget.umd.js"></script>
<script>
  ChatWidget.init({
    apiUrl: 'https://yoursite.com/api/chat',
    teamName: 'Acme Support',
    avatarInitials: 'AC',
    categories: [
      { id: 'sales', label: 'Sales', icon: '💰', description: 'Pricing questions' },
      { id: 'support', label: 'Support', icon: '🛠️', description: 'Get help' },
    ]
  });
</script>
```

That's it. Works with any backend: Express, Fastify, Hono, Django, Rails, Go, Rust, whatever.

## Features

- 🔒 **Secure visitor sessions** - Server-issued signed tokens (no spoofable client IDs)
- ⚡ **Real-time polling** - New messages appear automatically
- 🎯 **Category selection** - Route conversations by topic
- 📱 **Responsive design** - Works on all screen sizes
- 🔔 **Notification sound** - Audio alert for new admin messages
- 🚦 **Rate limiting** - Built-in abuse protection
- 📲 **Telegram notifications** - Optional admin alerts
- 🎨 **Zero dependencies** - Single JS file, no React/Vue/etc required

## Project Structure

```
chat-widget-oss/
├── packages/
│   └── widget/               # Frontend widget (vanilla JS)
│       ├── src/
│       └── dist/
│           ├── chat-widget.umd.js    # For <script> tags
│           ├── chat-widget.es.js     # For ES modules
│           └── *.d.ts                # TypeScript types
│
├── components/
│   └── ChatWidget.tsx        # React component (for Next.js users)
├── lib/
│   └── chat-security.ts      # Token signing & rate limiting
├── app/api/chat/             # Next.js API routes (reference impl)
│   ├── init/route.ts
│   ├── messages/route.ts
│   ├── send/route.ts
│   └── status/route.ts
│
└── examples/
    └── vanilla-html/         # Plain HTML demo
```

## Installation

### Option 1: Script Tag (Recommended)

```html
<script src="https://cdn.yoursite.com/chat-widget.umd.js"></script>
```

### Option 2: npm (for bundlers)

```bash
npm install @chat-widget/embed
```

```js
import { ChatWidget } from '@chat-widget/embed';

const widget = new ChatWidget({
  apiUrl: '/api/chat',
  teamName: 'My Team',
});
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiUrl` | string | **required** | Base URL for chat API endpoints |
| `teamName` | string | "Support Team" | Name shown in the widget |
| `avatarInitials` | string | "ST" | 2-letter initials in avatar |
| `headerTitle` | string | "Support" | Title in chat header |
| `welcomeMessage` | string | "Welcome!..." | Message shown before categories |
| `categories` | array | default list | Category buttons to show |
| `storageKeyPrefix` | string | "chat-widget" | localStorage key prefix |
| `pollIntervalMs` | number | 5000 | Polling interval in ms |
| `position` | string | "bottom-right" | "bottom-right" or "bottom-left" |
| `zIndex` | number | 50 | z-index of widget container |

## API Endpoints

Your backend needs to implement these endpoints:

### `POST /api/chat/init`
Create a new visitor session. Returns a signed token.

**Response:**
```json
{
  "success": true,
  "visitorId": "visitor_abc123...",
  "token": "eyJhbGciOi...",
  "expiresIn": 604800
}
```

### `GET /api/chat/messages?token=...`
Get messages for a visitor session.

**Response:**
```json
{
  "messages": [
    { "id": "1", "text": "Hello", "sender": "visitor", "timestamp": "2024-..." },
    { "id": "2", "text": "Hi there!", "sender": "admin", "timestamp": "2024-..." }
  ]
}
```

### `POST /api/chat/send`
Send a message from the visitor.

**Body:**
```json
{
  "token": "eyJhbGciOi...",
  "text": "Hello!",
  "category": "support"
}
```

### `GET /api/chat/status`
Check if support is online.

**Response:**
```json
{ "online": true }
```

## Backend Implementation

See `lib/chat-security.ts` for the reference implementation of:
- Token generation with HMAC signatures
- Fingerprint verification (IP + User-Agent)
- Rate limiting

You can port this logic to any language/framework.

## Database Schema

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
```

## JavaScript API

```js
// Initialize
ChatWidget.init({ apiUrl: '/api/chat', ... });

// Programmatic control
ChatWidget.open();   // Open the chat window
ChatWidget.close();  // Close the chat window
ChatWidget.destroy(); // Remove widget completely

// Or use the class directly
import { ChatWidget } from '@chat-widget/embed';
const widget = new ChatWidget({ ... });
widget.open();
widget.close();
widget.destroy();
```

## Building from Source

```bash
cd packages/widget
npm install
npm run build
```

Output will be in `packages/widget/dist/`.

## Customization

The widget uses CSS classes prefixed with `.chat-widget-`. Override them in your own stylesheet:

```css
/* Change primary color */
.chat-widget-header,
.chat-widget-chat-btn,
.chat-widget-send-btn,
.chat-widget-message.visitor .chat-widget-message-bubble {
  background: #2563eb !important;
}

/* Change avatar gradient */
.chat-widget-avatar {
  background: linear-gradient(135deg, #3b82f6, #1d4ed8) !important;
}
```

## Security Notes

- Visitor tokens are HMAC-signed and tied to IP + User-Agent fingerprint
- Rate limiting prevents spam and session enumeration
- All messages are scoped to verified visitor sessions
- No client-side visitor ID generation (prevents spoofing)

## License

MIT

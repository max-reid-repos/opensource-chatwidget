# Express.js Chat Widget Example

A complete, working backend for the chat widget using Express.js and SQLite.

## Quick Start

```bash
npm install
npm start
```

Open http://localhost:3000 in your browser.

## What's Included

- **server.js** — Express backend with all chat endpoints
- **public/index.html** — Demo page with the widget
- **public/chat-widget.umd.js** — The widget bundle
- **chat.db** — SQLite database (created on first run)

## API Endpoints

### Visitor Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat/init` | Create visitor session |
| GET | `/api/chat/messages?token=...` | Get messages |
| POST | `/api/chat/send` | Send message |
| GET | `/api/chat/status` | Check online status |

### Admin Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/conversations` | List all conversations |
| POST | `/api/admin/reply` | Send admin reply |

## Testing Admin Reply

```bash
# List conversations
curl http://localhost:3000/api/admin/conversations

# Send a reply (replace VISITOR_ID)
curl -X POST http://localhost:3000/api/admin/reply \
  -H "Content-Type: application/json" \
  -d '{"visitorId": "visitor_abc123...", "text": "Hello from admin!"}'
```

## Environment Variables

- `PORT` — Server port (default: 3000)
- `CHAT_TOKEN_SECRET` — Secret for signing tokens (auto-generated if not set)

## Integrating with Your App

Copy the relevant parts from `server.js` into your existing Express app, or use it as a reference for implementing in other frameworks.

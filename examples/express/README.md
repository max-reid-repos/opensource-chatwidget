# Express.js Chat Widget Example

A complete, working backend for the chat widget using Express.js and SQLite.

## Quick Start

```bash
npm install
cp .env.example .env
npm start
```

Open `http://localhost:3000` in your browser.

## What's Included

- `server.js`: Express backend with all chat endpoints.
- `public/index.html`: Demo page with the widget.
- `public/chat-widget.umd.js`: The widget bundle.
- `chat.db`: SQLite database (created on first run).

## API Endpoints

### Visitor Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat/init` | Create visitor session |
| GET | `/api/chat/messages?token=...` | Get messages |
| POST | `/api/chat/email` | Save visitor email |
| POST | `/api/chat/send` | Send message |
| GET | `/api/chat/status` | Check online status |

### Optional Telegram Endpoint

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/telegram/webhook` | Ingest Telegram admin replies into chat |

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
  -d '{"visitorId":"visitor_abc123...","text":"Hello from admin!"}'
```

## Telegram Reply Flow (Optional)

When Telegram env vars are configured, visitor messages are forwarded to Telegram.
Admins can reply in either of these ways:

- Reply directly to the visitor message in Telegram.
- Use `/reply visitor_xxx your message` in Telegram.

The webhook endpoint stores that reply as an admin chat message so it appears in the widget.

## Telegram Webhook Setup (Optional)

Use your public, canonical domain in webhook setup. Avoid redirects (for example `https://example.com`
redirecting to `https://www.example.com`), because Telegram expects a direct `200` response from the exact URL.

```bash
APP_URL="https://your-domain.com"

curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"${APP_URL}/api/telegram/webhook\",\"secret_token\":\"${TELEGRAM_WEBHOOK_SECRET}\",\"allowed_updates\":[\"message\"]}"

curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
```

## Environment Variables

- `PORT`: Server port (default `3000`).
- `CHAT_TOKEN_SECRET`: Secret for signing tokens (auto-generated if not set).
- `CHAT_STRICT_FINGERPRINT`: Optional (`true` or `false`). If `true`, enforce exact IP + User-Agent matching.
- `TELEGRAM_BOT_TOKEN`: Optional bot token for outgoing notifications.
- `TELEGRAM_CHAT_ID`: Optional target chat ID for outgoing notifications.
- `TELEGRAM_WEBHOOK_SECRET`: Optional secret for validating Telegram webhook requests.

## Integrating with Your App

Copy the relevant parts from `server.js` into your existing Express app, or use it as a reference for implementing in other frameworks.

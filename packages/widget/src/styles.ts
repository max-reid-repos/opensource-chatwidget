// Inline styles to avoid external CSS dependency
// Users can override with their own CSS targeting .chat-widget-* classes

export const styles = `
.chat-widget-container {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  box-sizing: border-box;
}

.chat-widget-container *, .chat-widget-container *::before, .chat-widget-container *::after {
  box-sizing: inherit;
}

/* Bubble (closed state) */
.chat-widget-bubble {
  display: flex;
  align-items: center;
  gap: 12px;
}

.chat-widget-bubble-card {
  background: white;
  border-radius: 9999px;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
  padding: 8px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.chat-widget-bubble-info {
  text-align: right;
}

.chat-widget-bubble-name {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.chat-widget-bubble-status {
  font-size: 12px;
  color: #6b7280;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
}

.chat-widget-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #9ca3af;
}

.chat-widget-status-dot.online {
  background: #22c55e;
  animation: chat-widget-pulse 2s infinite;
}

@keyframes chat-widget-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.chat-widget-chat-btn {
  background: #111827;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 9999px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background 0.2s;
}

.chat-widget-chat-btn:hover {
  background: #1f2937;
}

.chat-widget-avatar-btn {
  position: relative;
  cursor: pointer;
  border: none;
  background: none;
  padding: 0;
  transition: transform 0.2s;
}

.chat-widget-avatar-btn:hover {
  transform: scale(1.1);
}

.chat-widget-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #374151, #111827);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 700;
  font-size: 20px;
  border: 2px solid white;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
}

.chat-widget-avatar-status {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #9ca3af;
  border: 2px solid white;
}

.chat-widget-avatar-status.online {
  background: #22c55e;
}

.chat-widget-unread {
  position: absolute;
  top: -8px;
  right: -8px;
  background: #ef4444;
  color: white;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
}

/* Chat Window */
.chat-widget-window {
  background: white;
  border-radius: 16px;
  box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
  width: 380px;
  height: 600px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-widget-header {
  background: #111827;
  color: white;
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.chat-widget-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.chat-widget-header-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255,255,255,0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

.chat-widget-header-title {
  font-weight: 600;
}

.chat-widget-header-status {
  font-size: 12px;
  opacity: 0.9;
  display: flex;
  align-items: center;
  gap: 4px;
}

.chat-widget-header-status .chat-widget-status-dot {
  width: 8px;
  height: 8px;
}

.chat-widget-close-btn {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  padding: 4px;
  border-radius: 8px;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chat-widget-close-btn:hover {
  background: rgba(255,255,255,0.2);
}

/* Error Banner */
.chat-widget-error {
  background: #fef2f2;
  border-bottom: 1px solid #fecaca;
  padding: 8px 16px;
  color: #b91c1c;
  font-size: 13px;
}

/* Messages Area */
.chat-widget-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: #f9fafb;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Category Selection */
.chat-widget-welcome {
  padding: 16px 0;
  text-align: center;
}

.chat-widget-welcome-text {
  color: #374151;
  font-weight: 500;
  margin-bottom: 16px;
}

.chat-widget-categories {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chat-widget-category-btn {
  width: 100%;
  text-align: left;
  padding: 12px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
  display: flex;
  align-items: center;
  gap: 12px;
}

.chat-widget-category-btn:hover {
  border-color: #6b7280;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.chat-widget-category-icon {
  font-size: 24px;
}

.chat-widget-category-label {
  font-weight: 500;
  color: #111827;
}

.chat-widget-category-desc {
  font-size: 12px;
  color: #6b7280;
}

/* Empty State */
.chat-widget-empty {
  text-align: center;
  padding: 32px 0;
  color: #9ca3af;
}

.chat-widget-empty-icon {
  margin-bottom: 12px;
}

/* Messages */
.chat-widget-message {
  display: flex;
}

.chat-widget-message.visitor {
  justify-content: flex-end;
}

.chat-widget-message.admin {
  justify-content: flex-start;
}

.chat-widget-message-bubble {
  max-width: 70%;
  padding: 8px 16px;
  border-radius: 16px;
}

.chat-widget-message.visitor .chat-widget-message-bubble {
  background: #111827;
  color: white;
  border-bottom-right-radius: 4px;
}

.chat-widget-message.admin .chat-widget-message-bubble {
  background: white;
  color: #1f2937;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  border-bottom-left-radius: 4px;
}

.chat-widget-message-text {
  font-size: 14px;
  white-space: pre-wrap;
  word-break: break-word;
}

.chat-widget-message-time {
  font-size: 11px;
  margin-top: 4px;
  opacity: 0.7;
}

/* Input Form */
.chat-widget-input-form {
  padding: 16px;
  border-top: 1px solid #e5e7eb;
  background: white;
}

.chat-widget-input-row {
  display: flex;
  gap: 8px;
}

.chat-widget-input {
  flex: 1;
  padding: 8px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 9999px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.chat-widget-input:focus {
  border-color: #6b7280;
}

.chat-widget-input:disabled {
  background: #f9fafb;
  cursor: not-allowed;
}

.chat-widget-send-btn {
  background: #111827;
  color: white;
  border: none;
  padding: 8px;
  border-radius: 50%;
  cursor: pointer;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
}

.chat-widget-send-btn:hover:not(:disabled) {
  background: #1f2937;
}

.chat-widget-send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.chat-widget-input-hint {
  font-size: 12px;
  color: #9ca3af;
  text-align: center;
  margin-top: 8px;
}

/* Icons (SVG inline) */
.chat-widget-icon {
  width: 20px;
  height: 20px;
}
`;

export function injectStyles(): void {
  if (document.getElementById('chat-widget-styles')) return;
  
  const styleEl = document.createElement('style');
  styleEl.id = 'chat-widget-styles';
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);
}

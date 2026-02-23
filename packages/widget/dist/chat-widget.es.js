class f {
  constructor(e) {
    this.baseUrl = e, this.baseUrl = e.replace(/\/$/, "");
  }
  async request(e, t = {}) {
    try {
      const i = await fetch(`${this.baseUrl}${e}`, {
        ...t,
        headers: {
          "Content-Type": "application/json",
          ...t.headers
        }
      }), s = await i.json();
      return i.ok ? {
        ok: !0,
        status: i.status,
        data: s
      } : {
        ok: !1,
        status: i.status,
        error: s.error || `HTTP ${i.status}`
      };
    } catch (i) {
      return {
        ok: !1,
        status: 0,
        error: i instanceof Error ? i.message : "Network error"
      };
    }
  }
  async init() {
    return this.request("/init", { method: "POST" });
  }
  async getMessages(e) {
    return this.request(
      `/messages?token=${encodeURIComponent(e)}`
    );
  }
  async send(e, t, i) {
    return this.request("/send", {
      method: "POST",
      body: JSON.stringify({ token: e, text: t, category: i })
    });
  }
  async saveEmail(e, t) {
    return this.request("/email", {
      method: "POST",
      body: JSON.stringify({ token: e, email: t })
    });
  }
  async getStatus() {
    return this.request("/status");
  }
}
function b(l) {
  let e = { ...l };
  const t = /* @__PURE__ */ new Set();
  return {
    getState: () => e,
    setState: (i) => {
      e = { ...e, ...i }, t.forEach((s) => s(e));
    },
    subscribe: (i) => (t.add(i), () => t.delete(i))
  };
}
const x = {
  isOpen: !1,
  isOnline: !0,
  isLoading: !1,
  messages: [],
  selectedCategory: null,
  showCategories: !0,
  showEmailStep: !1,
  emailSubmitted: !1,
  error: null,
  unreadCount: 0,
  session: null
}, d = {
  messageCircle: '<svg class="chat-widget-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>',
  send: '<svg class="chat-widget-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>',
  mail: '<svg class="chat-widget-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v16H4z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>',
  x: '<svg class="chat-widget-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'
}, y = [
  { id: "general", label: "General Question", icon: "💬", description: "Ask us anything" },
  { id: "support", label: "Support", icon: "🛠️", description: "Get help with your account" },
  { id: "feedback", label: "Feedback", icon: "💡", description: "Share your thoughts" }
];
class v {
  constructor(e, t) {
    this.inputRef = null, this.messagesRef = null, this.config = {
      apiUrl: e.apiUrl,
      teamName: e.teamName ?? "Support Team",
      avatarInitials: e.avatarInitials ?? "ST",
      headerTitle: e.headerTitle ?? "Support",
      welcomeMessage: e.welcomeMessage ?? "Welcome! How can we help you today?",
      categories: e.categories ?? y,
      requireEmail: e.requireEmail ?? !0,
      storageKeyPrefix: e.storageKeyPrefix ?? "chat-widget",
      pollIntervalMs: e.pollIntervalMs ?? 5e3,
      position: e.position ?? "bottom-right",
      zIndex: e.zIndex ?? 50
    }, this.callbacks = t, this.container = document.createElement("div"), this.container.className = "chat-widget-container", this.container.style.cssText = `
      position: fixed;
      ${this.config.position === "bottom-left" ? "left" : "right"}: 16px;
      bottom: 16px;
      z-index: ${this.config.zIndex};
    `, document.body.appendChild(this.container);
  }
  render(e) {
    e.isOpen ? this.renderWindow(e) : this.renderBubble(e);
  }
  renderBubble(e) {
    const t = e.isOnline ? "online" : "";
    this.container.innerHTML = `
      <div class="chat-widget-bubble">
        <div class="chat-widget-bubble-card">
          <div class="chat-widget-bubble-info">
            <div class="chat-widget-bubble-name">${this.escape(this.config.teamName)}</div>
            <div class="chat-widget-bubble-status">
              <span class="chat-widget-status-dot ${t}"></span>
              ${e.isOnline ? "Online now" : "Leave a message"}
            </div>
          </div>
          <button class="chat-widget-chat-btn" data-action="toggle">
            ${d.messageCircle}
            Chat
          </button>
        </div>
        <button class="chat-widget-avatar-btn" data-action="toggle">
          <div class="chat-widget-avatar">${this.escape(this.config.avatarInitials)}</div>
          <div class="chat-widget-avatar-status ${t}"></div>
          ${e.unreadCount > 0 ? `<div class="chat-widget-unread">${e.unreadCount}</div>` : ""}
        </button>
      </div>
    `, this.bindEvents();
  }
  renderWindow(e) {
    const t = e.isOnline ? "online" : "";
    this.container.innerHTML = `
      <div class="chat-widget-window">
        <div class="chat-widget-header">
          <div class="chat-widget-header-left">
            <div class="chat-widget-header-avatar">${this.escape(this.config.avatarInitials)}</div>
            <div>
              <div class="chat-widget-header-title">${this.escape(this.config.headerTitle)}</div>
              <div class="chat-widget-header-status">
                <span class="chat-widget-status-dot ${t}"></span>
                ${e.isOnline ? "We are online" : "Leave a message"}
              </div>
            </div>
          </div>
          <button class="chat-widget-close-btn" data-action="toggle">${d.x}</button>
        </div>
        
        ${e.error ? `<div class="chat-widget-error">${this.escape(e.error)}</div>` : ""}
        
        <div class="chat-widget-messages" data-ref="messages">
          ${this.renderMessagesContent(e)}
        </div>
        
        <form class="chat-widget-input-form" data-action="send">
          <div class="chat-widget-input-row">
            <input 
              type="text" 
              class="chat-widget-input" 
              data-ref="input"
              placeholder="${this.getInputPlaceholder(e)}"
              maxlength="2000"
              ${this.isInputDisabled(e) ? "disabled" : ""}
            >
            <button 
              type="submit" 
              class="chat-widget-send-btn"
              ${this.isInputDisabled(e) || e.isLoading || e.error ? "disabled" : ""}
            >
              ${d.send}
            </button>
          </div>
          <div class="chat-widget-input-hint">
            ${e.selectedCategory ? e.showEmailStep && !e.emailSubmitted && e.messages.length === 0 ? "Enter your email to continue" : "Typically replies within a few hours" : "Please select a topic to start chatting"}
          </div>
        </form>
      </div>
    `, this.inputRef = this.container.querySelector('[data-ref="input"]'), this.messagesRef = this.container.querySelector('[data-ref="messages"]'), this.bindEvents(), this.scrollToBottom(), this.focusInput();
  }
  renderMessagesContent(e) {
    return e.messages.length === 0 && e.showCategories ? `
        <div class="chat-widget-welcome">
          <div class="chat-widget-welcome-text">${this.escape(this.config.welcomeMessage)}</div>
          <div class="chat-widget-categories">
            ${this.config.categories.map((t) => `
              <button class="chat-widget-category-btn" data-action="category" data-category="${this.escape(t.id)}">
                <span class="chat-widget-category-icon">${t.icon}</span>
                <div>
                  <div class="chat-widget-category-label">${this.escape(t.label)}</div>
                  <div class="chat-widget-category-desc">${this.escape(t.description)}</div>
                </div>
              </button>
            `).join("")}
          </div>
        </div>
      ` : e.messages.length === 0 && e.showEmailStep && !e.emailSubmitted ? this.renderEmailCapture() : e.messages.length === 0 ? `
        <div class="chat-widget-empty">
          <div class="chat-widget-empty-icon">${d.messageCircle}</div>
          <div>Start typing your message below...</div>
        </div>
      ` : e.messages.map((t) => this.renderMessage(t)).join("");
  }
  renderMessage(e) {
    const t = new Date(e.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
    return `
      <div class="chat-widget-message ${e.sender}">
        <div class="chat-widget-message-bubble">
          <div class="chat-widget-message-text">${this.escape(e.text)}</div>
          <div class="chat-widget-message-time">${t}</div>
        </div>
      </div>
    `;
  }
  renderEmailCapture() {
    return `
      <div class="chat-widget-email-step">
        <div class="chat-widget-email-icon">${d.mail}</div>
        <div class="chat-widget-email-title">Before we start</div>
        <div class="chat-widget-email-text">
          Enter your email so we can follow up with you.
        </div>
        <form class="chat-widget-email-form" data-action="email">
          <input
            type="email"
            class="chat-widget-email-input"
            data-ref="email-input"
            placeholder="you@example.com"
            maxlength="254"
            required
          >
          <button type="submit" class="chat-widget-email-submit">
            Continue
          </button>
        </form>
      </div>
    `;
  }
  isEmailValid(e) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  }
  getInputPlaceholder(e) {
    return e.selectedCategory ? e.showEmailStep && !e.emailSubmitted && e.messages.length === 0 ? "Enter email first..." : e.isOnline ? "Type your message..." : "Leave a message..." : "Select a topic first...";
  }
  isInputDisabled(e) {
    return e.isLoading || !e.selectedCategory && e.messages.length === 0 || e.showEmailStep && !e.emailSubmitted && e.messages.length === 0 || !!e.error;
  }
  bindEvents() {
    this.container.querySelectorAll('[data-action="toggle"]').forEach((i) => {
      i.addEventListener("click", () => this.callbacks.onToggle());
    }), this.container.querySelectorAll('[data-action="category"]').forEach((i) => {
      i.addEventListener("click", () => {
        const s = i.dataset.category;
        s && this.callbacks.onCategorySelect(s);
      });
    });
    const e = this.container.querySelector('[data-action="send"]');
    e && e.addEventListener("submit", (i) => {
      i.preventDefault();
      const s = this.inputRef;
      s && s.value.trim() && (this.callbacks.onSendMessage(s.value.trim()), s.value = "");
    });
    const t = this.container.querySelector('[data-action="email"]');
    t && t.addEventListener("submit", (i) => {
      i.preventDefault();
      const s = this.container.querySelector('[data-ref="email-input"]'), o = (s == null ? void 0 : s.value.trim().toLowerCase()) ?? "";
      o && this.isEmailValid(o) && this.callbacks.onEmailSubmit(o);
    });
  }
  scrollToBottom() {
    this.messagesRef && (this.messagesRef.scrollTop = this.messagesRef.scrollHeight);
  }
  focusInput() {
    this.inputRef && !this.inputRef.disabled && this.inputRef.focus();
  }
  escape(e) {
    const t = document.createElement("div");
    return t.textContent = e, t.innerHTML;
  }
  destroy() {
    this.container.remove();
  }
}
const S = `
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

/* Email Capture Step */
.chat-widget-email-step {
  padding: 16px 0;
}

.chat-widget-email-icon {
  width: 40px;
  height: 40px;
  color: #d1d5db;
  margin: 0 auto 12px;
}

.chat-widget-email-title {
  text-align: center;
  color: #374151;
  font-weight: 600;
  margin-bottom: 8px;
}

.chat-widget-email-text {
  text-align: center;
  color: #6b7280;
  font-size: 13px;
  margin-bottom: 12px;
}

.chat-widget-email-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chat-widget-email-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.chat-widget-email-input:focus {
  border-color: #6b7280;
}

.chat-widget-email-submit {
  width: 100%;
  background: #111827;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.chat-widget-email-submit:hover {
  background: #1f2937;
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
function k() {
  if (document.getElementById("chat-widget-styles")) return;
  const l = document.createElement("style");
  l.id = "chat-widget-styles", l.textContent = S, document.head.appendChild(l);
}
const E = "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUafi", I = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
class w {
  constructor(e) {
    if (this.pollInterval = null, !e.apiUrl)
      throw new Error("ChatWidget: apiUrl is required");
    this.config = e, this.api = new f(e.apiUrl), this.store = b(x), k(), this.ui = new v(e, {
      onToggle: () => this.toggle(),
      onCategorySelect: (t) => this.selectCategory(t),
      onEmailSubmit: (t) => this.submitEmail(t),
      onSendMessage: (t) => this.sendMessage(t)
    }), this.store.subscribe((t) => {
      this.ui.render(t);
    }), this.ui.render(this.store.getState()), this.initSession();
  }
  async initSession() {
    const e = this.config.storageKeyPrefix ?? "chat-widget", t = `${e}-token`, i = `${e}-visitor-id`, s = `${e}-email`, o = `${e}-email-visitor-id`;
    try {
      const r = localStorage.getItem(s) ?? "", a = this.normalizeEmail(r), g = this.isValidEmail(a);
      g ? (this.store.setState({ emailSubmitted: !0 }), r !== a && localStorage.setItem(s, a)) : (localStorage.removeItem(s), localStorage.removeItem(o), this.store.setState({ emailSubmitted: !1 }));
      const h = localStorage.getItem(t), c = localStorage.getItem(i);
      if (h && c) {
        this.store.setState({
          session: { token: h, visitorId: c }
        }), await this.loadMessages(), g && localStorage.getItem(o) !== c && await this.syncEmailToSession(h, c, a);
        return;
      }
      const u = await this.api.init();
      if (u.ok && u.data) {
        const { token: p, visitorId: m } = u.data;
        localStorage.setItem(t, p), localStorage.setItem(i, m), this.store.setState({
          session: { token: p, visitorId: m }
        }), g && await this.syncEmailToSession(p, m, a);
      } else
        this.store.setState({
          error: "Failed to initialize chat. Please refresh the page."
        });
    } catch (r) {
      console.error("[ChatWidget] Init error:", r), this.store.setState({
        error: "Failed to initialize chat. Please refresh the page."
      });
    } finally {
      this.checkOnlineStatus();
    }
  }
  async loadMessages() {
    var i;
    const { session: e } = this.store.getState();
    if (!e) return;
    const t = await this.api.getMessages(e.token);
    if (t.ok && t.data) {
      const s = t.data.messages || [], r = this.store.getState().selectedCategory || ((i = s[0]) == null ? void 0 : i.category) || null;
      this.store.setState({
        messages: s,
        selectedCategory: r,
        showCategories: s.length === 0 && !r
      });
    } else t.status === 401 ? (this.clearSession(), await this.initSession()) : t.status === 429 && this.store.setState({ error: "Too many requests. Please wait." });
  }
  async checkOnlineStatus() {
    const e = await this.api.getStatus();
    e.ok && e.data && this.store.setState({ isOnline: e.data.online });
  }
  clearSession() {
    const e = this.config.storageKeyPrefix ?? "chat-widget";
    localStorage.removeItem(`${e}-token`), localStorage.removeItem(`${e}-visitor-id`), this.store.setState({ session: null });
  }
  toggle() {
    const { isOpen: e } = this.store.getState();
    e ? (this.store.setState({ isOpen: !1 }), this.stopPolling()) : (this.store.setState({ isOpen: !0, unreadCount: 0, error: null }), this.startPolling());
  }
  selectCategory(e) {
    const t = this.config.requireEmail ?? !0, { emailSubmitted: i, messages: s } = this.store.getState();
    this.store.setState({
      selectedCategory: e,
      showCategories: !1,
      showEmailStep: t && !i && s.length === 0,
      error: null
    });
  }
  normalizeEmail(e) {
    return e.trim().toLowerCase();
  }
  isValidEmail(e) {
    return I.test(e);
  }
  async syncEmailToSession(e, t, i, s = !1) {
    const o = this.normalizeEmail(i);
    if (!this.isValidEmail(o))
      return s && this.store.setState({ error: "Please enter a valid email address." }), !1;
    const r = await this.api.saveEmail(e, o);
    if (!r.ok)
      return s && this.store.setState({
        error: r.error || "Failed to save email. Please try again."
      }), !1;
    const a = this.config.storageKeyPrefix ?? "chat-widget";
    return localStorage.setItem(`${a}-email`, o), localStorage.setItem(`${a}-email-visitor-id`, t), !0;
  }
  async submitEmail(e) {
    const { session: t } = this.store.getState();
    if (!t) {
      this.store.setState({ error: "Session not initialized. Please refresh the page." });
      return;
    }
    this.store.setState({ error: null }), await this.syncEmailToSession(t.token, t.visitorId, e, !0) && this.store.setState({
      emailSubmitted: !0,
      showEmailStep: !1,
      error: null
    });
  }
  async sendMessage(e) {
    const t = this.store.getState();
    if (!t.session) {
      this.store.setState({ error: "Session not initialized. Please refresh the page." });
      return;
    }
    if (!t.selectedCategory) {
      this.store.setState({ showCategories: !0 });
      return;
    }
    const i = this.config.requireEmail ?? !0;
    if (i && !t.emailSubmitted && t.messages.length === 0) {
      this.store.setState({ showEmailStep: !0, error: null });
      return;
    }
    const s = this.config.storageKeyPrefix ?? "chat-widget", o = this.normalizeEmail(localStorage.getItem(`${s}-email`) ?? "");
    i && t.emailSubmitted && this.isValidEmail(o) && localStorage.getItem(`${s}-email-visitor-id`) !== t.session.visitorId && await this.syncEmailToSession(t.session.token, t.session.visitorId, o);
    const r = {
      id: Date.now().toString(),
      text: e,
      sender: "visitor",
      timestamp: /* @__PURE__ */ new Date(),
      category: t.selectedCategory
    };
    this.store.setState({
      messages: [...t.messages, r],
      isLoading: !0,
      error: null
    });
    const a = await this.api.send(
      t.session.token,
      e,
      t.selectedCategory
    );
    a.ok ? await this.loadMessages() : a.status === 401 ? (this.store.setState({ error: "Session expired. Refreshing..." }), this.clearSession(), await this.initSession()) : a.status === 429 ? this.store.setState({
      error: "Please wait before sending more messages."
    }) : this.store.setState({
      error: a.error || "Failed to send message"
    }), this.store.setState({ isLoading: !1 });
  }
  startPolling() {
    if (this.pollInterval) return;
    const e = this.config.pollIntervalMs ?? 5e3;
    this.pollInterval = window.setInterval(async () => {
      const t = this.store.getState();
      if (!t.isOpen || !t.session) return;
      const i = await this.api.getMessages(t.session.token);
      if (i.ok && i.data) {
        const s = i.data.messages || [], o = new Set(t.messages.map((a) => a.id)), r = s.filter((a) => !o.has(a.id));
        r.length > 0 && (this.store.setState({ messages: s }), r.some((a) => a.sender === "admin") && this.playNotificationSound());
      }
    }, e);
  }
  stopPolling() {
    this.pollInterval && (clearInterval(this.pollInterval), this.pollInterval = null);
  }
  playNotificationSound() {
    try {
      new Audio(E).play().catch(() => {
      });
    } catch {
    }
  }
  // Public API
  open() {
    this.store.getState().isOpen || this.toggle();
  }
  close() {
    this.store.getState().isOpen && this.toggle();
  }
  destroy() {
    this.stopPolling(), this.ui.destroy();
  }
}
let n = null;
function C(l) {
  return n ? (console.warn("[ChatWidget] Already initialized. Call destroy() first to reinitialize."), n) : (n = new w(l), n);
}
function $() {
  n && (n.destroy(), n = null);
}
function z() {
  n == null || n.open();
}
function A() {
  n == null || n.close();
}
typeof window < "u" && (window.ChatWidget = {
  init: C,
  destroy: $,
  open: z,
  close: A,
  ChatWidget: w
});
export {
  w as ChatWidget,
  A as close,
  $ as destroy,
  C as init,
  z as open
};
//# sourceMappingURL=chat-widget.es.js.map

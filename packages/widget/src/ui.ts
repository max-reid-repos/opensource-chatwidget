import type { ChatWidgetConfig, ChatMessage, ChatCategory } from './types';
import type { WidgetState } from './state';
import { icons } from './icons';

const DEFAULT_CATEGORIES: ChatCategory[] = [
  { id: 'general', label: 'General Question', icon: '💬', description: 'Ask us anything' },
  { id: 'support', label: 'Support', icon: '🛠️', description: 'Get help with your account' },
  { id: 'feedback', label: 'Feedback', icon: '💡', description: 'Share your thoughts' },
];

export interface UICallbacks {
  onToggle: () => void;
  onCategorySelect: (categoryId: string) => void;
  onEmailSubmit: (email: string) => void;
  onSendMessage: (text: string) => void;
}

export class WidgetUI {
  private container: HTMLElement;
  private config: Required<Omit<ChatWidgetConfig, 'apiUrl'>> & { apiUrl: string };
  private callbacks: UICallbacks;
  private inputRef: HTMLInputElement | null = null;
  private messagesRef: HTMLElement | null = null;

  constructor(
    config: ChatWidgetConfig,
    callbacks: UICallbacks
  ) {
    this.config = {
      apiUrl: config.apiUrl,
      teamName: config.teamName ?? 'Support Team',
      avatarInitials: config.avatarInitials ?? 'ST',
      headerTitle: config.headerTitle ?? 'Support',
      welcomeMessage: config.welcomeMessage ?? 'Welcome! How can we help you today?',
      categories: config.categories ?? DEFAULT_CATEGORIES,
      requireEmail: config.requireEmail ?? true,
      storageKeyPrefix: config.storageKeyPrefix ?? 'chat-widget',
      pollIntervalMs: config.pollIntervalMs ?? 5000,
      position: config.position ?? 'bottom-right',
      zIndex: config.zIndex ?? 50,
    };
    this.callbacks = callbacks;

    // Create container
    this.container = document.createElement('div');
    this.container.className = 'chat-widget-container';
    this.container.style.cssText = `
      position: fixed;
      ${this.config.position === 'bottom-left' ? 'left' : 'right'}: 16px;
      bottom: 16px;
      z-index: ${this.config.zIndex};
    `;
    document.body.appendChild(this.container);
  }

  render(state: WidgetState): void {
    if (state.isOpen) {
      this.renderWindow(state);
    } else {
      this.renderBubble(state);
    }
  }

  private renderBubble(state: WidgetState): void {
    const onlineClass = state.isOnline ? 'online' : '';
    
    this.container.innerHTML = `
      <div class="chat-widget-bubble">
        <div class="chat-widget-bubble-card">
          <div class="chat-widget-bubble-info">
            <div class="chat-widget-bubble-name">${this.escape(this.config.teamName)}</div>
            <div class="chat-widget-bubble-status">
              <span class="chat-widget-status-dot ${onlineClass}"></span>
              ${state.isOnline ? 'Online now' : 'Leave a message'}
            </div>
          </div>
          <button class="chat-widget-chat-btn" data-action="toggle">
            ${icons.messageCircle}
            Chat
          </button>
        </div>
        <button class="chat-widget-avatar-btn" data-action="toggle">
          <div class="chat-widget-avatar">${this.escape(this.config.avatarInitials)}</div>
          <div class="chat-widget-avatar-status ${onlineClass}"></div>
          ${state.unreadCount > 0 ? `<div class="chat-widget-unread">${state.unreadCount}</div>` : ''}
        </button>
      </div>
    `;

    this.bindEvents();
  }

  private renderWindow(state: WidgetState): void {
    const onlineClass = state.isOnline ? 'online' : '';
    
    this.container.innerHTML = `
      <div class="chat-widget-window">
        <div class="chat-widget-header">
          <div class="chat-widget-header-left">
            <div class="chat-widget-header-avatar">${this.escape(this.config.avatarInitials)}</div>
            <div>
              <div class="chat-widget-header-title">${this.escape(this.config.headerTitle)}</div>
              <div class="chat-widget-header-status">
                <span class="chat-widget-status-dot ${onlineClass}"></span>
                ${state.isOnline ? 'We are online' : 'Leave a message'}
              </div>
            </div>
          </div>
          <button class="chat-widget-close-btn" data-action="toggle">${icons.x}</button>
        </div>
        
        ${state.error ? `<div class="chat-widget-error">${this.escape(state.error)}</div>` : ''}
        
        <div class="chat-widget-messages" data-ref="messages">
          ${this.renderMessagesContent(state)}
        </div>
        
        <form class="chat-widget-input-form" data-action="send">
          <div class="chat-widget-input-row">
            <input 
              type="text" 
              class="chat-widget-input" 
              data-ref="input"
              placeholder="${this.getInputPlaceholder(state)}"
              maxlength="2000"
              ${this.isInputDisabled(state) ? 'disabled' : ''}
            >
            <button 
              type="submit" 
              class="chat-widget-send-btn"
              ${this.isInputDisabled(state) || state.isLoading || state.error ? 'disabled' : ''}
            >
              ${icons.send}
            </button>
          </div>
          <div class="chat-widget-input-hint">
            ${state.selectedCategory
              ? state.showEmailStep && !state.emailSubmitted && state.messages.length === 0
                ? 'Enter your email to continue'
                : 'Typically replies within a few hours'
              : 'Please select a topic to start chatting'}
          </div>
        </form>
      </div>
    `;

    this.inputRef = this.container.querySelector('[data-ref="input"]');
    this.messagesRef = this.container.querySelector('[data-ref="messages"]');
    
    this.bindEvents();
    this.scrollToBottom();
    this.focusInput();
  }

  private renderMessagesContent(state: WidgetState): string {
    // Show categories if no messages and should show categories
    if (state.messages.length === 0 && state.showCategories) {
      return `
        <div class="chat-widget-welcome">
          <div class="chat-widget-welcome-text">${this.escape(this.config.welcomeMessage)}</div>
          <div class="chat-widget-categories">
            ${this.config.categories.map(cat => `
              <button class="chat-widget-category-btn" data-action="category" data-category="${this.escape(cat.id)}">
                <span class="chat-widget-category-icon">${cat.icon}</span>
                <div>
                  <div class="chat-widget-category-label">${this.escape(cat.label)}</div>
                  <div class="chat-widget-category-desc">${this.escape(cat.description)}</div>
                </div>
              </button>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Show email capture step before first message (when enabled)
    if (state.messages.length === 0 && state.showEmailStep && !state.emailSubmitted) {
      return this.renderEmailCapture();
    }

    // Show empty state if no messages and category selected
    if (state.messages.length === 0) {
      return `
        <div class="chat-widget-empty">
          <div class="chat-widget-empty-icon">${icons.messageCircle}</div>
          <div>Start typing your message below...</div>
        </div>
      `;
    }

    // Render messages
    return state.messages.map(msg => this.renderMessage(msg)).join('');
  }

  private renderMessage(msg: ChatMessage): string {
    const time = new Date(msg.timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    return `
      <div class="chat-widget-message ${msg.sender}">
        <div class="chat-widget-message-bubble">
          <div class="chat-widget-message-text">${this.escape(msg.text)}</div>
          <div class="chat-widget-message-time">${time}</div>
        </div>
      </div>
    `;
  }

  private renderEmailCapture(): string {
    return `
      <div class="chat-widget-email-step">
        <div class="chat-widget-email-icon">${icons.mail}</div>
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

  private isEmailValid(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private getInputPlaceholder(state: WidgetState): string {
    if (!state.selectedCategory) return 'Select a topic first...';
    if (state.showEmailStep && !state.emailSubmitted && state.messages.length === 0) return 'Enter email first...';
    return state.isOnline ? 'Type your message...' : 'Leave a message...';
  }

  private isInputDisabled(state: WidgetState): boolean {
    return state.isLoading || 
           (!state.selectedCategory && state.messages.length === 0) || 
           (state.showEmailStep && !state.emailSubmitted && state.messages.length === 0) ||
           !!state.error;
  }

  private bindEvents(): void {
    // Toggle button(s)
    this.container.querySelectorAll('[data-action="toggle"]').forEach(el => {
      el.addEventListener('click', () => this.callbacks.onToggle());
    });

    // Category buttons
    this.container.querySelectorAll('[data-action="category"]').forEach(el => {
      el.addEventListener('click', () => {
        const categoryId = (el as HTMLElement).dataset.category;
        if (categoryId) this.callbacks.onCategorySelect(categoryId);
      });
    });

    // Send form
    const form = this.container.querySelector('[data-action="send"]');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = this.inputRef;
        if (input && input.value.trim()) {
          this.callbacks.onSendMessage(input.value.trim());
          input.value = '';
        }
      });
    }

    // Email capture form
    const emailForm = this.container.querySelector('[data-action="email"]');
    if (emailForm) {
      emailForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = this.container.querySelector('[data-ref="email-input"]') as HTMLInputElement | null;
        const normalizedEmail = input?.value.trim().toLowerCase() ?? '';
        if (normalizedEmail && this.isEmailValid(normalizedEmail)) {
          this.callbacks.onEmailSubmit(normalizedEmail);
        }
      });
    }
  }

  private scrollToBottom(): void {
    if (this.messagesRef) {
      this.messagesRef.scrollTop = this.messagesRef.scrollHeight;
    }
  }

  private focusInput(): void {
    if (this.inputRef && !this.inputRef.disabled) {
      this.inputRef.focus();
    }
  }

  private escape(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  destroy(): void {
    this.container.remove();
  }
}

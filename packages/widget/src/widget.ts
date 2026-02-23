import type { ChatWidgetConfig, ChatMessage } from './types';
import { ChatApi } from './api';
import { createStore, initialState, Store } from './state';
import { WidgetUI } from './ui';
import { injectStyles } from './styles';

// Notification sound (short beep, base64 encoded)
const NOTIFICATION_SOUND = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUafi';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class ChatWidget {
  private api: ChatApi;
  private store: Store;
  private ui: WidgetUI;
  private pollInterval: number | null = null;
  private config: ChatWidgetConfig;

  constructor(config: ChatWidgetConfig) {
    if (!config.apiUrl) {
      throw new Error('ChatWidget: apiUrl is required');
    }

    this.config = config;
    this.api = new ChatApi(config.apiUrl);
    this.store = createStore(initialState);

    // Inject styles
    injectStyles();

    // Create UI
    this.ui = new WidgetUI(config, {
      onToggle: () => this.toggle(),
      onCategorySelect: (id) => this.selectCategory(id),
      onEmailSubmit: (email) => this.submitEmail(email),
      onSendMessage: (text) => this.sendMessage(text),
    });

    // Subscribe to state changes
    this.store.subscribe((state) => {
      this.ui.render(state);
    });

    // Initial render
    this.ui.render(this.store.getState());

    // Initialize session
    this.initSession();
  }

  private async initSession(): Promise<void> {
    const storagePrefix = this.config.storageKeyPrefix ?? 'chat-widget';
    const tokenKey = `${storagePrefix}-token`;
    const visitorIdKey = `${storagePrefix}-visitor-id`;
    const emailKey = `${storagePrefix}-email`;
    const emailVisitorIdKey = `${storagePrefix}-email-visitor-id`;

    try {
      // Load stored email and keep it normalized
      const storedEmailRaw = localStorage.getItem(emailKey) ?? '';
      const storedEmail = this.normalizeEmail(storedEmailRaw);
      const hasValidStoredEmail = this.isValidEmail(storedEmail);

      if (hasValidStoredEmail) {
        this.store.setState({ emailSubmitted: true });
        if (storedEmailRaw !== storedEmail) {
          localStorage.setItem(emailKey, storedEmail);
        }
      } else {
        localStorage.removeItem(emailKey);
        localStorage.removeItem(emailVisitorIdKey);
        this.store.setState({ emailSubmitted: false });
      }

      // Check for existing session
      const storedToken = localStorage.getItem(tokenKey);
      const storedVisitorId = localStorage.getItem(visitorIdKey);

      if (storedToken && storedVisitorId) {
        this.store.setState({
          session: { token: storedToken, visitorId: storedVisitorId },
        });
        await this.loadMessages();

        if (
          hasValidStoredEmail &&
          localStorage.getItem(emailVisitorIdKey) !== storedVisitorId
        ) {
          await this.syncEmailToSession(storedToken, storedVisitorId, storedEmail);
        }

        return;
      }

      // Create new session
      const result = await this.api.init();

      if (result.ok && result.data) {
        const { token, visitorId } = result.data;
        localStorage.setItem(tokenKey, token);
        localStorage.setItem(visitorIdKey, visitorId);
        this.store.setState({
          session: { token, visitorId },
        });

        if (hasValidStoredEmail) {
          await this.syncEmailToSession(token, visitorId, storedEmail);
        }
      } else {
        this.store.setState({
          error: 'Failed to initialize chat. Please refresh the page.',
        });
      }
    } catch (error) {
      console.error('[ChatWidget] Init error:', error);
      this.store.setState({
        error: 'Failed to initialize chat. Please refresh the page.',
      });
    } finally {
      // Keep status indicator fresh even on early returns.
      this.checkOnlineStatus();
    }
  }

  private async loadMessages(): Promise<void> {
    const { session } = this.store.getState();
    if (!session) return;

    const result = await this.api.getMessages(session.token);

    if (result.ok && result.data) {
      const messages = result.data.messages || [];
      const current = this.store.getState();
      const inferredCategory = current.selectedCategory || messages[0]?.category || null;

      this.store.setState({
        messages,
        selectedCategory: inferredCategory,
        showCategories: messages.length === 0 && !inferredCategory,
      });
    } else if (result.status === 401) {
      // Token expired, reinitialize
      this.clearSession();
      await this.initSession();
    } else if (result.status === 429) {
      this.store.setState({ error: `Too many requests. Please wait.` });
    }
  }

  private async checkOnlineStatus(): Promise<void> {
    const result = await this.api.getStatus();
    if (result.ok && result.data) {
      this.store.setState({ isOnline: result.data.online });
    }
  }

  private clearSession(): void {
    const storagePrefix = this.config.storageKeyPrefix ?? 'chat-widget';
    localStorage.removeItem(`${storagePrefix}-token`);
    localStorage.removeItem(`${storagePrefix}-visitor-id`);
    this.store.setState({ session: null });
  }

  private toggle(): void {
    const { isOpen } = this.store.getState();
    
    if (!isOpen) {
      // Opening
      this.store.setState({ isOpen: true, unreadCount: 0, error: null });
      this.startPolling();
    } else {
      // Closing
      this.store.setState({ isOpen: false });
      this.stopPolling();
    }
  }

  private selectCategory(categoryId: string): void {
    const requiresEmail = this.config.requireEmail ?? true;
    const { emailSubmitted, messages } = this.store.getState();

    this.store.setState({
      selectedCategory: categoryId,
      showCategories: false,
      showEmailStep: requiresEmail && !emailSubmitted && messages.length === 0,
      error: null,
    });
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private isValidEmail(email: string): boolean {
    return EMAIL_REGEX.test(email);
  }

  private async syncEmailToSession(
    token: string,
    visitorId: string,
    email: string,
    showError: boolean = false
  ): Promise<boolean> {
    const normalized = this.normalizeEmail(email);

    if (!this.isValidEmail(normalized)) {
      if (showError) {
        this.store.setState({ error: 'Please enter a valid email address.' });
      }
      return false;
    }

    const result = await this.api.saveEmail(token, normalized);

    if (!result.ok) {
      if (showError) {
        this.store.setState({
          error: result.error || 'Failed to save email. Please try again.',
        });
      }
      return false;
    }

    const storagePrefix = this.config.storageKeyPrefix ?? 'chat-widget';
    localStorage.setItem(`${storagePrefix}-email`, normalized);
    localStorage.setItem(`${storagePrefix}-email-visitor-id`, visitorId);
    return true;
  }

  private async submitEmail(email: string): Promise<void> {
    const { session } = this.store.getState();
    if (!session) {
      this.store.setState({ error: 'Session not initialized. Please refresh the page.' });
      return;
    }

    this.store.setState({ error: null });
    const saved = await this.syncEmailToSession(session.token, session.visitorId, email, true);
    if (!saved) return;

    this.store.setState({
      emailSubmitted: true,
      showEmailStep: false,
      error: null,
    });
  }

  private async sendMessage(text: string): Promise<void> {
    const state = this.store.getState();
    
    if (!state.session) {
      this.store.setState({ error: 'Session not initialized. Please refresh the page.' });
      return;
    }

    if (!state.selectedCategory) {
      this.store.setState({ showCategories: true });
      return;
    }

    const requiresEmail = this.config.requireEmail ?? true;
    if (requiresEmail && !state.emailSubmitted && state.messages.length === 0) {
      this.store.setState({ showEmailStep: true, error: null });
      return;
    }

    // Ensure stored email remains linked after session churn.
    const storagePrefix = this.config.storageKeyPrefix ?? 'chat-widget';
    const storedEmail = this.normalizeEmail(localStorage.getItem(`${storagePrefix}-email`) ?? '');
    if (
      requiresEmail &&
      state.emailSubmitted &&
      this.isValidEmail(storedEmail) &&
      localStorage.getItem(`${storagePrefix}-email-visitor-id`) !== state.session.visitorId
    ) {
      await this.syncEmailToSession(state.session.token, state.session.visitorId, storedEmail);
    }

    // Optimistic update
    const tempMessage: ChatMessage = {
      id: Date.now().toString(),
      text,
      sender: 'visitor',
      timestamp: new Date(),
      category: state.selectedCategory,
    };

    this.store.setState({
      messages: [...state.messages, tempMessage],
      isLoading: true,
      error: null,
    });

    const result = await this.api.send(
      state.session.token,
      text,
      state.selectedCategory
    );

    if (result.ok) {
      // Reload messages to get server-confirmed state
      await this.loadMessages();
    } else if (result.status === 401) {
      this.store.setState({ error: 'Session expired. Refreshing...' });
      this.clearSession();
      await this.initSession();
    } else if (result.status === 429) {
      this.store.setState({ 
        error: 'Please wait before sending more messages.' 
      });
    } else {
      this.store.setState({ 
        error: result.error || 'Failed to send message' 
      });
    }

    this.store.setState({ isLoading: false });
  }

  private startPolling(): void {
    if (this.pollInterval) return;

    const pollMs = this.config.pollIntervalMs ?? 5000;

    this.pollInterval = window.setInterval(async () => {
      const state = this.store.getState();
      if (!state.isOpen || !state.session) return;

      const result = await this.api.getMessages(state.session.token);

      if (result.ok && result.data) {
        const newMessages = result.data.messages || [];
        const existingIds = new Set(state.messages.map(m => m.id));
        const newlyAdded = newMessages.filter(m => !existingIds.has(m.id));

        if (newlyAdded.length > 0) {
          this.store.setState({ messages: newMessages });

          // Play sound for new admin messages
          if (newlyAdded.some(m => m.sender === 'admin')) {
            this.playNotificationSound();
          }
        }
      }
    }, pollMs);
  }

  private stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  private playNotificationSound(): void {
    try {
      const audio = new Audio(NOTIFICATION_SOUND);
      audio.play().catch(() => {}); // Ignore autoplay errors
    } catch {
      // Ignore errors
    }
  }

  // Public API
  open(): void {
    if (!this.store.getState().isOpen) {
      this.toggle();
    }
  }

  close(): void {
    if (this.store.getState().isOpen) {
      this.toggle();
    }
  }

  destroy(): void {
    this.stopPolling();
    this.ui.destroy();
  }
}

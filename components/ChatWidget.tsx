'use client';

/**
 * Chat Widget Component
 *
 * A secure, embeddable chat widget with server-issued signed tokens.
 * - Tokens are cryptographically signed by server
 * - Tied to IP address and User-Agent (fingerprinting)
 * - Cannot be spoofed or used to read other visitors' messages
 * - Includes rate limiting protection
 */

import { useState, useEffect, useRef } from 'react';
import { X, Send, MessageCircle } from 'lucide-react';

interface Message {
  id: string;
  text: string;
  sender: 'visitor' | 'admin';
  timestamp: Date;
  category?: string;
}

export type ChatCategory = {
  id: string;
  label: string;
  icon: string;
  description: string;
};

export interface ChatWidgetConfig {
  /** Your brand/team name shown in the widget */
  teamName?: string;
  /** Short identifier shown in avatar (e.g. "MC", "AB") */
  avatarInitials?: string;
  /** Title shown in chat header */
  headerTitle?: string;
  /** Welcome message shown before categories */
  welcomeMessage?: string;
  /** Categories for routing conversations */
  categories?: ChatCategory[];
  /** localStorage key prefix for storing tokens */
  storageKeyPrefix?: string;
  /** Polling interval in ms (default: 5000) */
  pollIntervalMs?: number;
}

const DEFAULT_CATEGORIES: ChatCategory[] = [
  { id: 'general', label: 'General Question', icon: '💬', description: 'Ask us anything' },
  { id: 'support', label: 'Need Support', icon: '🛠️', description: 'Get help with your account' },
  { id: 'feedback', label: 'Feedback', icon: '💡', description: 'Share your thoughts' },
];

const DEFAULT_CONFIG: Required<ChatWidgetConfig> = {
  teamName: 'Support Team',
  avatarInitials: 'ST',
  headerTitle: 'Support',
  welcomeMessage: 'Welcome! How can we help you today?',
  categories: DEFAULT_CATEGORIES,
  storageKeyPrefix: 'chat-widget',
  pollIntervalMs: 5000,
};

export default function ChatWidget(props: ChatWidgetConfig = {}) {
  const config = { ...DEFAULT_CONFIG, ...props };
  
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [visitorToken, setVisitorToken] = useState('');
  const [visitorId, setVisitorId] = useState('');
  const [isOnline, setIsOnline] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCategories, setShowCategories] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const storageKeys = {
    token: `${config.storageKeyPrefix}-token`,
    visitorId: `${config.storageKeyPrefix}-visitor-id`,
  };

  // Initialize visitor session with server-issued token
  useEffect(() => {
    initializeSession();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Poll for new admin messages when chat is open
  useEffect(() => {
    if (!isOpen || !visitorToken) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/chat/messages?token=${encodeURIComponent(visitorToken)}`);
        if (response.ok) {
          const data = await response.json();
          const newMessages = data.messages || [];

          // Find truly new messages (ones we don't have yet)
          const existingIds = new Set(messages.map((m: Message) => m.id));
          const newlyAdded = newMessages.filter((m: Message) => !existingIds.has(m.id));

          if (newlyAdded.length > 0) {
            setMessages(newMessages);

            // Play notification sound for new admin messages
            if (newlyAdded.some((m: Message) => m.sender === 'admin')) {
              playNotificationSound();
            }
          }
        }
      } catch (error) {
        console.error('Error polling for messages:', error);
      }
    }, config.pollIntervalMs);

    return () => clearInterval(pollInterval);
  }, [isOpen, visitorToken, messages]);

  const initializeSession = async () => {
    try {
      // Check if we have a valid token in localStorage
      const storedToken = localStorage.getItem(storageKeys.token);
      const storedVisitorId = localStorage.getItem(storageKeys.visitorId);

      if (storedToken && storedVisitorId) {
        // Try to use existing token
        setVisitorToken(storedToken);
        setVisitorId(storedVisitorId);
        await loadMessages(storedToken);
        return;
      }

      // No valid token - create new session
      const response = await fetch('/api/chat/init', {
        method: 'POST'
      });

      if (response.ok) {
        const data = await response.json();
        setVisitorToken(data.token);
        setVisitorId(data.visitorId);

        // Store token securely in localStorage
        localStorage.setItem(storageKeys.token, data.token);
        localStorage.setItem(storageKeys.visitorId, data.visitorId);

        // Load any existing messages
        await loadMessages(data.token);
      } else {
        console.error('Failed to initialize chat session');
        setError('Failed to initialize chat. Please refresh the page.');
      }
    } catch (error) {
      console.error('Error initializing session:', error);
      setError('Failed to initialize chat. Please refresh the page.');
    }

    // Check online status
    checkOnlineStatus();
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async (token: string) => {
    try {
      const response = await fetch(`/api/chat/messages?token=${encodeURIComponent(token)}`);

      if (response.status === 401) {
        // Token invalid or expired - create new session
        localStorage.removeItem(storageKeys.token);
        localStorage.removeItem(storageKeys.visitorId);
        await initializeSession();
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      } else if (response.status === 429) {
        const data = await response.json();
        setError(`Too many requests. Please wait ${data.resetIn} seconds.`);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const checkOnlineStatus = async () => {
    try {
      const response = await fetch('/api/chat/status');
      if (response.ok) {
        const data = await response.json();
        setIsOnline(data.online);
      }
    } catch (error) {
      // Default to online if can't check
      setIsOnline(true);
    }
  };

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setShowCategories(false);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputText.trim() || isLoading) return;

    // If no category selected, prompt for category first
    if (!selectedCategory) {
      setShowCategories(true);
      return;
    }

    // Check if we have a valid token
    if (!visitorToken) {
      setError('Session not initialized. Please refresh the page.');
      return;
    }

    const newMessage: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      sender: 'visitor',
      timestamp: new Date(),
      category: selectedCategory
    };

    // Optimistically add message
    setMessages(prev => [...prev, newMessage]);
    setInputText('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: visitorToken,
          text: newMessage.text,
          category: selectedCategory
        })
      });

      if (response.status === 401) {
        // Token invalid - reinitialize session
        setError('Session expired. Refreshing...');
        localStorage.removeItem(storageKeys.token);
        localStorage.removeItem(storageKeys.visitorId);
        await initializeSession();
        return;
      }

      if (response.status === 429) {
        const data = await response.json();
        setError(`Please wait ${data.resetIn} seconds before sending more messages.`);
        return;
      }

      if (response.ok) {
        await loadMessages(visitorToken);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const playNotificationSound = () => {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUafi');
    audio.play().catch(() => {}); // Ignore errors if autoplay is blocked
  };

  const toggleChat = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setUnreadCount(0);
      setError(null);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Chat Bubble */}
      {!isOpen && (
        <div className="flex items-center gap-3">
          {/* Message Button */}
          <div className="bg-white rounded-full shadow-lg px-4 py-2 flex items-center gap-2">
            <div className="text-right">
              <div className="text-sm font-semibold text-gray-900">{config.teamName}</div>
              <div className="text-xs text-gray-500 flex items-center justify-end gap-1">
                <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                {isOnline ? 'Online now' : 'Leave a message'}
              </div>
            </div>
            <button
              onClick={toggleChat}
              className="bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-full font-medium text-sm transition-colors flex items-center gap-2"
              aria-label="Open chat"
            >
              <MessageCircle size={16} />
              Chat
            </button>
          </div>

          {/* Profile Picture */}
          <button
            onClick={toggleChat}
            className="relative group transition-transform hover:scale-110"
            aria-label="Open chat"
          >
            <div className="relative">
              <div className="w-14 h-14 rounded-full shadow-lg bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center text-white font-bold text-xl border-2 border-white">
                {config.avatarInitials}
              </div>

              {/* Online Status Indicator */}
              <div className={`absolute bottom-0 right-0 w-4 h-4 ${isOnline ? 'bg-green-500' : 'bg-gray-400'} border-2 border-white rounded-full`} />

              {/* Unread Badge */}
              {unreadCount > 0 && (
                <div className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                  {unreadCount}
                </div>
              )}
            </div>
          </button>
        </div>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="bg-white rounded-2xl shadow-2xl w-[380px] h-[600px] flex flex-col">
          {/* Header */}
          <div className="bg-gray-900 text-white p-4 rounded-t-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold">
                {config.avatarInitials}
              </div>
              <div>
                <div className="font-semibold">{config.headerTitle}</div>
                <div className="text-xs opacity-90 flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-gray-400'}`} />
                  {isOnline ? "We are online" : "Leave a message"}
                </div>
              </div>
            </div>
            <button
              onClick={toggleChat}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors"
              aria-label="Close chat"
            >
              <X size={20} />
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="bg-red-50 border-b border-red-200 px-4 py-2">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {messages.length === 0 && showCategories ? (
              <div className="py-4">
                <p className="text-gray-700 text-center mb-4 font-medium">
                  {config.welcomeMessage}
                </p>
                <div className="space-y-2">
                  {config.categories.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => handleCategorySelect(category.id)}
                      className="w-full text-left p-3 bg-white rounded-lg border border-gray-200 hover:border-gray-500 hover:shadow-sm transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{category.icon}</span>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 group-hover:text-gray-700">
                            {category.label}
                          </div>
                          <div className="text-xs text-gray-500">
                            {category.description}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : messages.length === 0 && !showCategories ? (
              <div className="text-center py-8">
                <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">
                  Start typing your message below...
                </p>
              </div>
            ) : null}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'visitor' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                    message.sender === 'visitor'
                      ? 'bg-gray-900 text-white rounded-br-sm'
                      : message.category ? 'bg-gray-100 text-gray-800 border border-gray-300 rounded-bl-sm' : 'bg-white text-gray-800 shadow-sm rounded-bl-sm'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
                  <p className={`text-xs mt-1 ${message.sender === 'visitor' ? 'text-gray-400' : message.category ? 'text-gray-600' : 'text-gray-400'}`}>
                    {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          <form onSubmit={sendMessage} className="p-4 border-t bg-white rounded-b-2xl">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={!selectedCategory ? "Select a topic first..." : isOnline ? "Type your message..." : "Leave a message..."}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-full text-sm focus:outline-none focus:border-gray-500 transition-colors"
                disabled={isLoading || (!selectedCategory && messages.length === 0) || !!error}
                maxLength={2000}
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isLoading || !!error}
                className="bg-gray-900 text-white p-2 rounded-full hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Send message"
              >
                <Send size={20} />
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">
              {selectedCategory ? 'Typically replies within a few hours' : 'Please select a topic to start chatting'}
            </p>
          </form>
        </div>
      )}
    </div>
  );
}

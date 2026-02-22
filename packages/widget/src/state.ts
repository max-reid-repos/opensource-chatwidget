import type { ChatMessage, SessionData } from './types';

export interface WidgetState {
  isOpen: boolean;
  isOnline: boolean;
  isLoading: boolean;
  messages: ChatMessage[];
  selectedCategory: string | null;
  showCategories: boolean;
  error: string | null;
  unreadCount: number;
  session: SessionData | null;
}

export type StateListener = (state: WidgetState) => void;

export function createStore(initial: WidgetState) {
  let state = { ...initial };
  const listeners = new Set<StateListener>();

  return {
    getState: () => state,
    
    setState: (partial: Partial<WidgetState>) => {
      state = { ...state, ...partial };
      listeners.forEach(fn => fn(state));
    },
    
    subscribe: (fn: StateListener) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

export type Store = ReturnType<typeof createStore>;

export const initialState: WidgetState = {
  isOpen: false,
  isOnline: true,
  isLoading: false,
  messages: [],
  selectedCategory: null,
  showCategories: true,
  error: null,
  unreadCount: 0,
  session: null,
};

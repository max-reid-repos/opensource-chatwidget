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
export declare function createStore(initial: WidgetState): {
    getState: () => {
        isOpen: boolean;
        isOnline: boolean;
        isLoading: boolean;
        messages: ChatMessage[];
        selectedCategory: string | null;
        showCategories: boolean;
        error: string | null;
        unreadCount: number;
        session: SessionData | null;
    };
    setState: (partial: Partial<WidgetState>) => void;
    subscribe: (fn: StateListener) => () => boolean;
};
export type Store = ReturnType<typeof createStore>;
export declare const initialState: WidgetState;

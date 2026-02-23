import type { ChatWidgetConfig } from './types';
import type { WidgetState } from './state';
export interface UICallbacks {
    onToggle: () => void;
    onCategorySelect: (categoryId: string) => void;
    onEmailSubmit: (email: string) => void;
    onSendMessage: (text: string) => void;
}
export declare class WidgetUI {
    private container;
    private config;
    private callbacks;
    private inputRef;
    private messagesRef;
    constructor(config: ChatWidgetConfig, callbacks: UICallbacks);
    render(state: WidgetState): void;
    private renderBubble;
    private renderWindow;
    private renderMessagesContent;
    private renderMessage;
    private renderEmailCapture;
    private isEmailValid;
    private getInputPlaceholder;
    private isInputDisabled;
    private bindEvents;
    private scrollToBottom;
    private focusInput;
    private escape;
    destroy(): void;
}

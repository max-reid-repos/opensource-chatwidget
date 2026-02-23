import type { ChatWidgetConfig } from './types';
export declare class ChatWidget {
    private api;
    private store;
    private ui;
    private pollInterval;
    private config;
    constructor(config: ChatWidgetConfig);
    private initSession;
    private loadMessages;
    private checkOnlineStatus;
    private clearSession;
    private toggle;
    private selectCategory;
    private normalizeEmail;
    private isValidEmail;
    private syncEmailToSession;
    private submitEmail;
    private sendMessage;
    private startPolling;
    private stopPolling;
    private playNotificationSound;
    open(): void;
    close(): void;
    destroy(): void;
}

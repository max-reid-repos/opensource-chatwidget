export interface ChatCategory {
    id: string;
    label: string;
    icon: string;
    description: string;
}
export interface ChatMessage {
    id: string;
    text: string;
    sender: 'visitor' | 'admin';
    timestamp: Date;
    category?: string;
}
export interface ChatWidgetConfig {
    /** API base URL (e.g., 'https://yoursite.com/api/chat') */
    apiUrl: string;
    /** Your brand/team name shown in the widget */
    teamName?: string;
    /** Short identifier shown in avatar (e.g., "MC", "AB") */
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
    /** Position of the widget */
    position?: 'bottom-right' | 'bottom-left';
    /** Z-index for the widget container */
    zIndex?: number;
}
export interface SessionData {
    token: string;
    visitorId: string;
}
export interface ApiResponse<T = unknown> {
    ok: boolean;
    status: number;
    data?: T;
    error?: string;
}
export interface InitResponse {
    success: boolean;
    visitorId: string;
    token: string;
    expiresIn: number;
}
export interface MessagesResponse {
    messages: ChatMessage[];
}
export interface SendResponse {
    success: boolean;
    messageId: string;
    autoResponse?: string;
    timestamp: string;
}
export interface StatusResponse {
    online: boolean;
}

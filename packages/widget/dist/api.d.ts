import type { ApiResponse, EmailResponse, InitResponse, MessagesResponse, SendResponse, StatusResponse } from './types';
export declare class ChatApi {
    private baseUrl;
    constructor(baseUrl: string);
    private request;
    init(): Promise<ApiResponse<InitResponse>>;
    getMessages(token: string): Promise<ApiResponse<MessagesResponse>>;
    send(token: string, text: string, category?: string): Promise<ApiResponse<SendResponse>>;
    saveEmail(token: string, email: string): Promise<ApiResponse<EmailResponse>>;
    getStatus(): Promise<ApiResponse<StatusResponse>>;
}

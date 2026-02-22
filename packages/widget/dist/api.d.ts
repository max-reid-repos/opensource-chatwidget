import type { ApiResponse, InitResponse, MessagesResponse, SendResponse, StatusResponse } from './types';
export declare class ChatApi {
    private baseUrl;
    constructor(baseUrl: string);
    private request;
    init(): Promise<ApiResponse<InitResponse>>;
    getMessages(token: string): Promise<ApiResponse<MessagesResponse>>;
    send(token: string, text: string, category?: string): Promise<ApiResponse<SendResponse>>;
    getStatus(): Promise<ApiResponse<StatusResponse>>;
}

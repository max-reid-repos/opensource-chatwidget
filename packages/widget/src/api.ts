import type { 
  ApiResponse, 
  InitResponse, 
  MessagesResponse, 
  SendResponse, 
  StatusResponse 
} from './types';

export class ChatApi {
  constructor(private baseUrl: string) {
    // Normalize URL (remove trailing slash)
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          error: data.error || `HTTP ${response.status}`,
        };
      }

      return {
        ok: true,
        status: response.status,
        data,
      };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  async init(): Promise<ApiResponse<InitResponse>> {
    return this.request<InitResponse>('/init', { method: 'POST' });
  }

  async getMessages(token: string): Promise<ApiResponse<MessagesResponse>> {
    return this.request<MessagesResponse>(
      `/messages?token=${encodeURIComponent(token)}`
    );
  }

  async send(
    token: string, 
    text: string, 
    category?: string
  ): Promise<ApiResponse<SendResponse>> {
    return this.request<SendResponse>('/send', {
      method: 'POST',
      body: JSON.stringify({ token, text, category }),
    });
  }

  async getStatus(): Promise<ApiResponse<StatusResponse>> {
    return this.request<StatusResponse>('/status');
  }
}

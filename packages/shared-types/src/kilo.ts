export interface KiloConfig {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly model: string;
  readonly maxTokensPerRequest: number;
}

export interface KiloUsage {
  readonly used: number;
  readonly limit: number;
  readonly resetAt: string;
  readonly percentage: number;
}

export interface KiloRequest {
  readonly model?: string;
  readonly messages: readonly KiloMessage[];
  readonly maxTokens?: number;
  readonly temperature?: number;
  readonly stream?: boolean;
}

export interface KiloMessage {
  readonly role: 'user' | 'assistant' | 'system';
  readonly content: string;
}

export interface KiloResponse {
  readonly id: string;
  readonly model: string;
  readonly content: string;
  readonly usage: {
    readonly promptTokens: number;
    readonly completionTokens: number;
    readonly totalTokens: number;
  };
  readonly finishReason: string;
}

export interface KiloConnectionStatus {
  readonly connected: boolean;
  readonly model: string;
  readonly usage?: KiloUsage;
  readonly lastCheckedAt: string;
}

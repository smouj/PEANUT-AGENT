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

// ─── MCP (Model Context Protocol) Types ───────────────────────────────────

export interface McpServerInfo {
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly protocolVersion: string;
  readonly capabilities: {
    readonly tools: { readonly listChanged: boolean };
    readonly resources: { readonly subscribe: boolean; readonly listChanged: boolean };
    readonly prompts: { readonly listChanged: boolean };
    readonly logging: Record<string, unknown>;
  };
}

export interface McpTool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: {
    readonly type: 'object';
    readonly properties: Record<string, unknown>;
    readonly required?: readonly string[];
  };
}

export interface McpResource {
  readonly uri: string;
  readonly name: string;
  readonly description?: string;
  readonly mimeType?: string;
}

export interface McpPrompt {
  readonly name: string;
  readonly description?: string;
  readonly arguments?: ReadonlyArray<{
    readonly name: string;
    readonly description?: string;
    readonly required?: boolean;
  }>;
}

export interface McpToolCallResult {
  readonly content: ReadonlyArray<{
    readonly type: string;
    readonly text: string;
  }>;
  readonly isError?: boolean;
}

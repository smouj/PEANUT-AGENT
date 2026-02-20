export type AgentStatus = 'online' | 'offline' | 'degraded' | 'maintenance';
export type AgentType = 'ollama' | 'kilo' | 'openai' | 'anthropic' | 'custom';

export interface AgentConfig {
  readonly id: string;
  readonly name: string;
  readonly type: AgentType;
  readonly endpoint: string;
  readonly model: string;
  readonly maxTokens: number;
  readonly temperature: number;
  readonly priority: number;
  readonly weight: number;
  readonly tags: readonly string[];
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AgentHealth {
  readonly agentId: string;
  readonly status: AgentStatus;
  readonly latencyMs: number;
  readonly successRate: number;
  readonly requestCount: number;
  readonly errorCount: number;
  readonly lastCheckedAt: string;
  readonly details: string;
}

export interface AgentSession {
  readonly id: string;
  readonly agentId: string;
  readonly userId: string;
  readonly messages: readonly ChatMessage[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ChatMessage {
  readonly role: 'user' | 'assistant' | 'system';
  readonly content: string;
  readonly timestamp: string;
  readonly tokens?: number;
}

export interface AgentRequest {
  readonly agentId?: string;
  readonly sessionId?: string;
  readonly message: string;
  readonly context?: readonly ChatMessage[];
  readonly stream?: boolean;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface AgentResponse {
  readonly requestId: string;
  readonly agentId: string;
  readonly sessionId: string;
  readonly message: string;
  readonly model: string;
  readonly tokensUsed: number;
  readonly latencyMs: number;
  readonly timestamp: string;
}

export interface CreateAgentDto {
  readonly name: string;
  readonly type: AgentType;
  readonly endpoint: string;
  readonly model: string;
  readonly maxTokens?: number;
  readonly temperature?: number;
  readonly priority?: number;
  readonly weight?: number;
  readonly tags?: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface UpdateAgentDto {
  readonly name?: string;
  readonly endpoint?: string;
  readonly model?: string;
  readonly maxTokens?: number;
  readonly temperature?: number;
  readonly priority?: number;
  readonly weight?: number;
  readonly tags?: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

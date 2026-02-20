export interface ApiResponse<T = unknown> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: ApiError;
  readonly requestId: string;
  readonly timestamp: string;
}

export interface ApiError {
  readonly code: string;
  readonly message: string;
  readonly details?: unknown;
}

export interface PaginatedResponse<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly pages: number;
}

export interface HealthStatus {
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
  readonly version: string;
  readonly uptime: number;
  readonly timestamp: string;
  readonly services: Readonly<Record<string, ServiceHealth>>;
}

export interface ServiceHealth {
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
  readonly latencyMs?: number;
  readonly message?: string;
}

export interface RateLimitInfo {
  readonly limit: number;
  readonly remaining: number;
  readonly resetAt: string;
  readonly retryAfter?: number;
}

export interface WebSocketMessage {
  readonly type: string;
  readonly payload: unknown;
  readonly timestamp: string;
}

export interface TerminalMessage {
  readonly type: 'input' | 'output' | 'error' | 'resize' | 'ping' | 'pong';
  readonly data?: string;
  readonly cols?: number;
  readonly rows?: number;
}

export interface BackupRecord {
  readonly id: string;
  readonly name: string;
  readonly sizeMb: number;
  readonly encrypted: boolean;
  readonly createdAt: string;
  readonly expiresAt?: string;
  readonly checksum: string;
}

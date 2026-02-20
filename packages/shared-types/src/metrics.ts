export interface GatewayMetrics {
  readonly requestsTotal: number;
  readonly requestsPerSecond: number;
  readonly errorRate: number;
  readonly averageLatencyMs: number;
  readonly p50LatencyMs: number;
  readonly p95LatencyMs: number;
  readonly p99LatencyMs: number;
  readonly activeConnections: number;
  readonly timestamp: string;
}

export interface AgentMetrics {
  readonly agentId: string;
  readonly requestsTotal: number;
  readonly successRate: number;
  readonly averageLatencyMs: number;
  readonly tokensUsedTotal: number;
  readonly tokensUsedToday: number;
  readonly activeSessionsCount: number;
  readonly timestamp: string;
}

export interface TraceSpan {
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId?: string;
  readonly name: string;
  readonly service: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly durationMs: number;
  readonly status: 'ok' | 'error';
  readonly attributes: Readonly<Record<string, string | number | boolean>>;
}

export interface MetricsTimeSeries {
  readonly metric: string;
  readonly unit: string;
  readonly points: readonly TimeSeriesPoint[];
}

export interface TimeSeriesPoint {
  readonly timestamp: string;
  readonly value: number;
}

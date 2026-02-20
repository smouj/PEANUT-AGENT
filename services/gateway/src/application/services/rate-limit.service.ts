import { getDb } from '../../infrastructure/database/db.js';
import { RateLimitError } from '../../domain/errors.js';

interface RateLimitConfig {
  readonly maxRequests: number;
  readonly windowMs: number;
  readonly exponentialBackoff: boolean;
  readonly maxBackoffMs: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 100,
  windowMs: 60_000,
  exponentialBackoff: true,
  maxBackoffMs: 300_000, // 5 minutes
};

// Adaptive rate limiter with exponential backoff windows
export class RateLimitService {
  private readonly config: RateLimitConfig;

  constructor(config?: Partial<RateLimitConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  check(key: string, config?: Partial<RateLimitConfig>): { remaining: number; resetAt: Date; limit: number } {
    const cfg = config ? { ...this.config, ...config } : this.config;
    const now = Date.now();
    const windowStart = Math.floor(now / cfg.windowMs) * cfg.windowMs;
    const windowKey = `${key}:${windowStart}`;
    const db = getDb();

    // Clean old windows
    const cutoff = new Date(now - cfg.windowMs * 10).toISOString();
    db.prepare('DELETE FROM rate_limit_windows WHERE window_start < ?').run(cutoff);

    const existing = db.prepare(
      'SELECT count FROM rate_limit_windows WHERE key = ? AND window_start = ?'
    ).get(windowKey, new Date(windowStart).toISOString()) as { count: number } | undefined;

    const count = (existing?.count ?? 0) + 1;
    const remaining = Math.max(0, cfg.maxRequests - count);
    const resetAt = new Date(windowStart + cfg.windowMs);

    if (count > cfg.maxRequests) {
      let retryAfter = cfg.windowMs;
      if (cfg.exponentialBackoff) {
        const overCount = count - cfg.maxRequests;
        retryAfter = Math.min(
          cfg.maxBackoffMs,
          cfg.windowMs * Math.pow(2, Math.floor(overCount / 10)),
        );
      }
      db.prepare(`
        INSERT INTO rate_limit_windows (key, window_start, count) VALUES (?, ?, ?)
        ON CONFLICT(key, window_start) DO UPDATE SET count = count + 1
      `).run(windowKey, new Date(windowStart).toISOString(), count);
      throw new RateLimitError(Math.ceil(retryAfter / 1000));
    }

    db.prepare(`
      INSERT INTO rate_limit_windows (key, window_start, count) VALUES (?, ?, 1)
      ON CONFLICT(key, window_start) DO UPDATE SET count = count + 1
    `).run(windowKey, new Date(windowStart).toISOString());

    return { remaining, resetAt, limit: cfg.maxRequests };
  }

  reset(key: string): void {
    const db = getDb();
    db.prepare("DELETE FROM rate_limit_windows WHERE key LIKE ?").run(`${key}:%`);
  }
}

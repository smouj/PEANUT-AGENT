import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimitService } from '../../src/application/services/rate-limit.service.js';
import { RateLimitError } from '../../src/domain/errors.js';

// In-memory store for the mock DB
const store = new Map<string, number>();

// Mock the DB module with a proper in-memory store
vi.mock('../../src/infrastructure/database/db.js', () => {
  const db = {
    prepare: (sql: string) => ({
      run: (...args: unknown[]) => {
        if (sql.includes('DELETE')) return;
        // INSERT INTO rate_limit_windows (key, window_start, count) VALUES (?, ?, 1)
        // ON CONFLICT DO UPDATE SET count = count + 1
        const windowKey = `${String(args[0])}|${String(args[1])}`;
        const existing = store.get(windowKey) ?? 0;
        store.set(windowKey, existing + 1);
      },
      get: (...args: unknown[]) => {
        if (sql.includes('COUNT')) return { count: 0 };
        // SELECT count FROM rate_limit_windows WHERE key = ? AND window_start = ?
        const windowKey = `${String(args[0])}|${String(args[1])}`;
        const count = store.get(windowKey);
        return count !== undefined ? { count } : undefined;
      },
    }),
  };
  return { getDb: () => db };
});

describe('RateLimitService', () => {
  const svc = new RateLimitService({
    maxRequests: 3,
    windowMs: 60_000,
    exponentialBackoff: false,
    maxBackoffMs: 300_000,
  });

  beforeEach(() => {
    store.clear();
  });

  it('allows requests within limit', () => {
    for (let i = 0; i < 3; i++) {
      const result = svc.check('test-key');
      expect(result.limit).toBe(3);
    }
  });

  it('throws RateLimitError when limit exceeded', () => {
    // Make 4 requests: first 3 succeed, 4th throws
    svc.check('overkey');
    svc.check('overkey');
    svc.check('overkey');
    expect(() => svc.check('overkey')).toThrow(RateLimitError);
  });

  it('returns correct remaining count', () => {
    const result = svc.check('remaining-key');
    expect(result.remaining).toBe(2); // 3 max - 1 used = 2 remaining
  });

  it('returns reset time in the future', () => {
    const result = svc.check('reset-key');
    expect(result.resetAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('provides limit in result', () => {
    const result = svc.check('limit-key');
    expect(result.limit).toBe(3);
  });
});

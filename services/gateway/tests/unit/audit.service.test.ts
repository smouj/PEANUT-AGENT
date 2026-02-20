import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditService } from '../../src/application/services/audit.service.js';
import { AuditEntry } from '../../src/domain/audit/audit.entity.js';
import type { AuditAction } from '@peanut/shared-types';

function makeRepo() {
  const entries: AuditEntry[] = [];
  let latestFingerprint = '';
  return {
    findLatestFingerprint: vi.fn(async () => latestFingerprint),
    save: vi.fn(async (e: AuditEntry) => {
      entries.push(e);
      latestFingerprint = e.fingerprint;
    }),
    findById: vi.fn(async (id: string) => entries.find(e => e.id === id) ?? null),
    query: vi.fn(async (params: { page: number; limit: number }) => ({
      entries: entries.slice((params.page - 1) * params.limit, params.page * params.limit),
      total: entries.length,
    })),
    entries,
  };
}

const BASE_PARAMS = {
  userId: 'u1',
  userEmail: 'u@test.com',
  ipAddress: '127.0.0.1',
  userAgent: 'ua',
  resourceType: 'user',
  resourceId: 'u1',
  details: {},
};

describe('AuditService', () => {
  let repo: ReturnType<typeof makeRepo>;
  let svc: AuditService;

  beforeEach(() => {
    repo = makeRepo();
    svc = new AuditService(repo as never);
    vi.clearAllMocks();
  });

  describe('log', () => {
    it('persists an audit entry with a fingerprint', async () => {
      await svc.log({ action: 'auth.login' as AuditAction, ...BASE_PARAMS });
      expect(repo.save).toHaveBeenCalledOnce();
      const saved = repo.entries[0]!;
      expect(saved.fingerprint).toBeTruthy();
      expect(saved.action).toBe('auth.login');
    });

    it('chains fingerprints across sequential log entries', async () => {
      await svc.log({ action: 'auth.login' as AuditAction, ...BASE_PARAMS });
      await svc.log({ action: 'agent.created' as AuditAction, ...BASE_PARAMS, resourceType: 'agent', resourceId: 'a1' });
      const first = repo.entries[0]!;
      const second = repo.entries[1]!;
      expect(second.previousFingerprint).toBe(first.fingerprint);
    });

    it('first entry has empty previousFingerprint', async () => {
      await svc.log({ action: 'auth.login' as AuditAction, ...BASE_PARAMS });
      expect(repo.entries[0]!.previousFingerprint).toBe('');
    });
  });

  describe('query', () => {
    it('returns mapped entries with integrity flag', async () => {
      await svc.log({ action: 'auth.login' as AuditAction, ...BASE_PARAMS });
      const result = await svc.query({ page: 1, limit: 10 });
      expect(result.entries.length).toBe(1);
      expect(result.integrityValid).toBe(true);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it('detects tampered entry and sets integrityValid to false', async () => {
      await svc.log({ action: 'auth.login' as AuditAction, ...BASE_PARAMS });
      // Replace entry with tampered fingerprint
      const orig = repo.entries[0]!;
      repo.entries[0] = AuditEntry.reconstitute({
        ...orig.toObject(),
        fingerprint: 'tampered-fingerprint',
      });
      const result = await svc.query({ page: 1, limit: 10 });
      expect(result.integrityValid).toBe(false);
    });
  });
});

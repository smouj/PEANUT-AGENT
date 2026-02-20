import { describe, it, expect } from 'vitest';
import { AuditEntry } from '../../src/domain/audit/audit.entity.js';

describe('AuditEntry', () => {
  const baseProps = {
    id: 'test-id-1',
    action: 'auth.login' as const,
    userId: 'user-1',
    userEmail: 'user@example.com',
    ipAddress: '127.0.0.1',
    userAgent: 'TestAgent/1.0',
    resourceType: 'user',
    resourceId: 'user-1',
    details: { method: 'password' },
    previousFingerprint: 'GENESIS',
  };

  describe('create', () => {
    it('creates an entry with a valid fingerprint', () => {
      const entry = AuditEntry.create(baseProps, 'GENESIS');
      expect(entry.fingerprint).toBeTruthy();
      expect(entry.fingerprint).toHaveLength(64); // SHA-256 hex
      expect(entry.previousFingerprint).toBe('GENESIS');
    });

    it('creates entries with chained fingerprints', () => {
      const entry1 = AuditEntry.create(baseProps, 'GENESIS');
      const entry2 = AuditEntry.create(
        { ...baseProps, id: 'test-id-2', action: 'auth.logout' },
        entry1.fingerprint,
      );
      expect(entry2.previousFingerprint).toBe(entry1.fingerprint);
    });

    it('different inputs produce different fingerprints', () => {
      const e1 = AuditEntry.create(baseProps, 'GENESIS');
      const e2 = AuditEntry.create({ ...baseProps, id: 'different-id', userId: 'user-2' }, 'GENESIS');
      expect(e1.fingerprint).not.toBe(e2.fingerprint);
    });
  });

  describe('recomputeAndVerify', () => {
    it('returns true for a valid entry', () => {
      const entry = AuditEntry.create(baseProps, 'GENESIS');
      expect(entry.recomputeAndVerify()).toBe(true);
    });

    it('returns false for a tampered entry', () => {
      const entry = AuditEntry.create(baseProps, 'GENESIS');
      // Reconstitute with tampered details
      const tampered = AuditEntry.reconstitute({
        ...entry.toObject(),
        details: { method: 'hacked' },
      });
      expect(tampered.recomputeAndVerify()).toBe(false);
    });
  });

  describe('verifyIntegrity', () => {
    it('verifies the chain link', () => {
      const entry1 = AuditEntry.create(baseProps, 'GENESIS');
      const entry2 = AuditEntry.create(
        { ...baseProps, id: 'test-id-2' },
        entry1.fingerprint,
      );
      expect(entry2.verifyIntegrity(entry1.fingerprint)).toBe(true);
      expect(entry2.verifyIntegrity('WRONG_FINGERPRINT')).toBe(false);
    });
  });
});

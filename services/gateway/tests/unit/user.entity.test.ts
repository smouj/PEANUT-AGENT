import { describe, it, expect } from 'vitest';
import { User } from '../../src/domain/auth/user.entity.js';
import { ValidationError } from '../../src/domain/errors.js';

const validProps = {
  id: 'user-1',
  email: 'admin@example.com',
  name: 'Admin User',
  passwordHash: 'hashed:password',
  role: 'admin' as const,
  totpSecret: null,
  totpEnabled: false,
  backupCodes: [],
};

describe('User Entity', () => {
  describe('create', () => {
    it('creates a valid user', () => {
      const user = User.create(validProps);
      expect(user.id).toBe('user-1');
      expect(user.email).toBe('admin@example.com');
      expect(user.totpEnabled).toBe(false);
      expect(user.lastLoginAt).toBeNull();
    });

    it('throws for invalid email', () => {
      expect(() => User.create({ ...validProps, email: 'not-an-email' }))
        .toThrow(ValidationError);
    });
  });

  describe('enableTotp', () => {
    it('enables TOTP with secret and backup codes', () => {
      const user = User.create(validProps);
      const updated = user.enableTotp('SECRET123', ['CODE1', 'CODE2']);
      expect(updated.totpEnabled).toBe(true);
      expect(updated.totpSecret).toBe('SECRET123');
      expect(updated.backupCodes).toHaveLength(2);
      expect(user.totpEnabled).toBe(false); // immutable
    });
  });

  describe('disableTotp', () => {
    it('clears TOTP data', () => {
      const user = User.create({ ...validProps, totpSecret: 'SECRET', totpEnabled: true });
      const updated = user.disableTotp();
      expect(updated.totpEnabled).toBe(false);
      expect(updated.totpSecret).toBeNull();
    });
  });

  describe('useBackupCode', () => {
    it('removes used backup code', () => {
      const user = User.create({ ...validProps })
        .enableTotp('SECRET', ['CODE1', 'CODE2', 'CODE3']);
      const updated = user.useBackupCode('CODE2');
      expect(updated.backupCodes).toEqual(['CODE1', 'CODE3']);
    });
  });

  describe('recordLogin', () => {
    it('sets lastLoginAt', () => {
      const user = User.create(validProps);
      const before = Date.now();
      const updated = user.recordLogin();
      expect(updated.lastLoginAt).not.toBeNull();
      expect(updated.lastLoginAt!.getTime()).toBeGreaterThanOrEqual(before);
    });
  });

  describe('updatePassword', () => {
    it('updates password hash immutably', () => {
      const user = User.create(validProps);
      const updated = user.updatePassword('new:hash');
      expect(updated.passwordHash).toBe('new:hash');
      expect(user.passwordHash).toBe('hashed:password');
    });
  });
});

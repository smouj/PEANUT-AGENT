import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '../../src/application/services/auth.service.js';
import { CryptoService } from '../../src/application/services/crypto.service.js';
import { User } from '../../src/domain/auth/user.entity.js';
import {
  ConflictError,
  ValidationError,
  UnauthorizedError,
  NotFoundError,
} from '../../src/domain/errors.js';

// Minimal mock UserRepository
function makeMockRepo() {
  const store = new Map<string, User>();
  return {
    findByEmail: vi.fn(async (email: string) => {
      for (const u of store.values()) {
        if (u.email === email) return u;
      }
      return null;
    }),
    findById: vi.fn(async (id: string) => store.get(id) ?? null),
    save: vi.fn(async (user: User) => { store.set(user.id, user); }),
    store,
  };
}

// Minimal mock AuditService
const mockAudit = { log: vi.fn(async () => {}) };

describe('AuthService', () => {
  let repo: ReturnType<typeof makeMockRepo>;
  let crypto: CryptoService;
  let svc: AuthService;

  beforeEach(() => {
    repo = makeMockRepo();
    crypto = new CryptoService();
    svc = new AuthService(repo as never, crypto, mockAudit as never, 'test-jwt-secret');
    vi.clearAllMocks();
  });

  describe('createUser', () => {
    it('creates a user successfully', async () => {
      const user = await svc.createUser('alice@example.com', 'Alice', 'ValidPass123!', 'viewer');
      expect(user.email).toBe('alice@example.com');
      expect(user.name).toBe('Alice');
      expect(user.role).toBe('viewer');
      expect(repo.save).toHaveBeenCalledOnce();
    });

    it('throws ConflictError if email exists', async () => {
      await svc.createUser('bob@example.com', 'Bob', 'ValidPass123!', 'viewer');
      await expect(svc.createUser('bob@example.com', 'Bob2', 'ValidPass456!', 'viewer'))
        .rejects.toThrow(ConflictError);
    });

    it('throws ValidationError for short password', async () => {
      await expect(svc.createUser('carol@example.com', 'Carol', 'short', 'viewer'))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('login', () => {
    const ip = '127.0.0.1';
    const ua = 'test-agent';

    it('returns requireTotp: false on valid login', async () => {
      await svc.createUser('dave@example.com', 'Dave', 'ValidPass123!', 'viewer');
      const result = await svc.login({ email: 'dave@example.com', password: 'ValidPass123!' }, ip, ua);
      expect(result.requireTotp).toBe(false);
      expect(result.userId).toBeTruthy();
    });

    it('throws UnauthorizedError for wrong password', async () => {
      await svc.createUser('eve@example.com', 'Eve', 'ValidPass123!', 'viewer');
      await expect(svc.login({ email: 'eve@example.com', password: 'WrongPass!' }, ip, ua))
        .rejects.toThrow(UnauthorizedError);
    });

    it('throws UnauthorizedError for unknown email', async () => {
      await expect(svc.login({ email: 'ghost@example.com', password: 'anything' }, ip, ua))
        .rejects.toThrow(UnauthorizedError);
    });

    it('returns requireTotp: true when TOTP is enabled', async () => {
      await svc.createUser('frank@example.com', 'Frank', 'ValidPass123!', 'admin');
      await svc.setupTotp((repo.store.values().next().value as User).id);
      const result = await svc.login({ email: 'frank@example.com', password: 'ValidPass123!' }, ip, ua);
      expect(result.requireTotp).toBe(true);
      expect(result.tempToken).toBeTruthy();
    });
  });

  describe('changePassword', () => {
    it('changes password successfully', async () => {
      await svc.createUser('grace@example.com', 'Grace', 'OldPassword123!', 'viewer');
      const user = [...repo.store.values()][0] as User;
      await svc.changePassword(user.id, 'OldPassword123!', 'NewPassword456!');
      const updatedUser = repo.store.get(user.id) as User;
      const valid = await crypto.verifyPassword('NewPassword456!', updatedUser.passwordHash);
      expect(valid).toBe(true);
    });

    it('throws NotFoundError for unknown userId', async () => {
      await expect(svc.changePassword('no-such-id', 'old', 'newpassword123!'))
        .rejects.toThrow(NotFoundError);
    });

    it('throws ValidationError for short new password', async () => {
      await svc.createUser('henry@example.com', 'Henry', 'ValidPass123!', 'viewer');
      const user = [...repo.store.values()][0] as User;
      await expect(svc.changePassword(user.id, 'ValidPass123!', 'short'))
        .rejects.toThrow(ValidationError);
    });

    it('throws UnauthorizedError for wrong current password', async () => {
      await svc.createUser('iris@example.com', 'Iris', 'ValidPass123!', 'viewer');
      const user = [...repo.store.values()][0] as User;
      await expect(svc.changePassword(user.id, 'WrongCurrent!', 'NewPassword456!'))
        .rejects.toThrow(UnauthorizedError);
    });
  });

  describe('getUserById', () => {
    it('returns user by id', async () => {
      await svc.createUser('jack@example.com', 'Jack', 'ValidPass123!', 'operator');
      const user = [...repo.store.values()][0] as User;
      const found = await svc.getUserById(user.id);
      expect(found.email).toBe('jack@example.com');
    });

    it('throws NotFoundError for unknown id', async () => {
      await expect(svc.getUserById('no-such-id')).rejects.toThrow(NotFoundError);
    });
  });

  describe('verifyTotp', () => {
    it('throws UnauthorizedError with expired temp token', async () => {
      await expect(svc.verifyTotp({ tempToken: 'invalid-base64', totpCode: '123456' }, '127.0.0.1', 'ua'))
        .rejects.toThrow(UnauthorizedError);
    });

    it('verifies backup code successfully', async () => {
      await svc.createUser('kate@example.com', 'Kate', 'ValidPass123!', 'viewer');
      const setupResp = await svc.setupTotp([...repo.store.values()][0]!.id);
      const loginResult = await svc.login({ email: 'kate@example.com', password: 'ValidPass123!' }, '127.0.0.1', 'ua');
      const backupCode = setupResp.backupCodes[0]!;
      const result = await svc.verifyTotp({ tempToken: loginResult.tempToken!, totpCode: backupCode }, '127.0.0.1', 'ua');
      expect(result.userId).toBeTruthy();
    });
  });
});
